import { db, SyncStatus } from '../db/database';
import { useSyncStore } from '../store/useSyncStore';
import { useAppStore } from '../store/useAppStore';
import { logger } from '../lib/logger';
import { syncQueue } from './syncQueue';
import { networkMonitor } from './networkMonitor';

class SyncEngine {
  private processing = false;
  private syncTimer: any = null;
  private lastSync: number = 0;
  private cooldownUntil: number = 0;

  init() {
    networkMonitor.init();
    window.addEventListener('network-reconnected', () => this.fullSync(true));
    
    // Attempt full sync every 15s in background
    this.syncTimer = setInterval(() => {
      this.fullSync();
    }, 15000);
    
    // Read last sync timestamp
    const val = localStorage.getItem('last_sync_timestamp');
    this.lastSync = val ? Number(val) : 0;

    this.fullSync();
  }

  async fullSync(force: boolean = false) {
    if (this.processing || !networkMonitor.isOnline()) return;
    if (!force && this.cooldownUntil && Date.now() < this.cooldownUntil) {
      // Gracefully postpone syncing during active cooldown to avoid spamming the server/logs
      return;
    }
    this.processing = true;
    const store = useSyncStore.getState();
    store.setSyncing(true);

    try {
      const allPending = await syncQueue.peekAll();
      const now = Date.now();
      
      const pendingItems = allPending.filter((item) => {
        if ((item.retry_count || 0) >= 3) return false;
        if (item.next_retry_at && item.next_retry_at > now) return false;
        return true;
      });

      store.setPendingCount(pendingItems.length);

      const inserts: any[] = [];
      const updates: any[] = [];
      const deletes: any[] = [];

      for (const item of pendingItems) {
        if (item.operation === 'insert') inserts.push(item);
        else if (item.operation === 'update') updates.push(item);
        else if (item.operation === 'delete') deletes.push(item);
      }

      logger.info('SyncEngine', `Pushing bulk: ${inserts.length} ins, ${updates.length} upd, ${deletes.length} del. Pulling since ${this.lastSync}`);

      const token = sessionStorage.getItem('auth_token');
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          inserts,
          updates,
          deletes,
          lastSync: this.lastSync
        })
      });

      if (!response.ok) {
         let errorDetail = response.statusText;
         try {
           const text = await response.text();
           if (text.trim().startsWith('<')) {
               errorDetail = 'Server returned HTML (possible 502 Bad Gateway)';
           } else {
               const body = JSON.parse(text);
               if (body && body.error) errorDetail = body.error;
           }
         } catch(e) {}
         throw new Error(`Sync Error: ${errorDetail || 'Unknown Server Error'} (Status: ${response.status})`);
      }

      const responseText = await response.text();
      if (responseText.trim().startsWith('<')) {
         throw new Error(`Sync Error: Server returned HTML (likely waking up or proxy loading). Retry later.`);
      }
      const { success, results, serverChanges } = JSON.parse(responseText);

      if (success) {
         // Gather all results
         const resultList = [...(results.inserts || []), ...(results.updates || []), ...(results.deletes || [])];
         const resultMap = new Map(resultList.map((r: any) => [r.uuid_sync, r]));

         // Resolve processed queue items
         for (const item of pendingItems) {
           const table = db[item.table as keyof typeof db] as any;
           const result = resultMap.get(item.uuid_sync);
           const rStatus = result ? result.result : 'error';
           const rSuccess = rStatus === 'applied' || rStatus === 'noop' || (result && result.success);

           if (rSuccess) {
              if (table && item.operation !== 'delete') {
                // mark as synced
                await table.update(item.uuid_sync, {
                  sync_status: 'synced',
                  last_synced_at: Date.now(),
                  retry_count: 0
                });
              }
              await syncQueue.remove(item.id!);
           } else {
              // mark as failed locally
              if (table && item.operation !== 'delete') {
                const isConflict = rStatus === 'conflict';
                logger.error('SyncEngine', `Row ${item.uuid_sync} failed: ${result?.error}`);
                await table.update(item.uuid_sync, {
                  sync_status: isConflict ? 'conflicted' : 'failed',
                  last_synced_at: Date.now()
                });
              }
              // mark failed in queue to trigger retry logic
              await syncQueue.markFailed(item.id!, result?.error || 'Unknown error');
           }
         }

         store.setPendingCount(await db.sync_queue.count());

         // Handle incoming server changes
         if (serverChanges) {
           for (const [tableName, rows] of Object.entries(serverChanges)) {
             const localTableName = tableName === 'clientes'
               ? 'clients'
               : tableName === 'sucursales'
                 ? 'branches'
                 : tableName;
             const table = db[localTableName as keyof typeof db] as any;
             if (!table) continue;

             for (const remoteRecord of rows as any[]) {
               const remoteUuid = remoteRecord.uuid_sync;
               if (!remoteUuid) continue;

               const local = await table.get(remoteUuid);
               if (!local || (remoteRecord.updated_at || 0) > (local.updated_at || 0)) {
                  let mergedRecord = remoteRecord;
                  if (tableName !== 'assets' && remoteRecord.data) {
                    try {
                      const parsed = typeof remoteRecord.data === 'string' ? JSON.parse(remoteRecord.data) : remoteRecord.data;
                      mergedRecord = { 
                        ...parsed, 
                        uuid_sync: remoteUuid, 
                        updated_at: remoteRecord.updated_at
                      };
                    } catch(e) {}
                  }

                  await table.put({
                    ...mergedRecord,
                    sync_status: 'synced',
                    last_synced_at: Date.now()
                  });
               }
             }
           }
         }

         this.lastSync = Date.now();
          this.cooldownUntil = 0; // Clear cooldown on success
         localStorage.setItem('last_sync_timestamp', this.lastSync.toString());
         
         // Refresh views
         await useAppStore.getState().hydrate();
      }

    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      const isRateLimit = errorMsg.includes('429');
      const isFetchError = errorMsg.toLowerCase().includes('failed to fetch') || 
                           errorMsg.toLowerCase().includes('networkerror') || 
                           errorMsg.toLowerCase().includes('load failed') ||
                           errorMsg.toLowerCase().includes('waking up') ||
                           errorMsg.toLowerCase().includes('html') ||
                           errorMsg.toLowerCase().includes('empty response');

      if (isRateLimit) {
        // Respect server limits - Enforce 50-second backoff cooldown
        this.cooldownUntil = Date.now() + 50000;
        logger.warn('SyncEngine', `Sync throttled (Status: 429). Postponing background requests for 50s.`);
      } else if (isFetchError) {
        // Enforce 25-second backoff cooldown for network disconnects/failures
        this.cooldownUntil = Date.now() + 25000;
        logger.warn('SyncEngine', `Server unreachable or network offline (Failed to fetch). Postponing background sync for 25s.`);
      } else {
        // Unexpected fatal errors logged as error
        logger.error('SyncEngine', 'Sync failed with unexpected error', e);
      }
    } finally {
      store.setSyncing(false);
      this.processing = false;
    }
  }

  async triggerSync(force: boolean = false) {
    if (force) {
      this.cooldownUntil = 0; // Reset active cooldown upon manual trigger action
    }
    return this.fullSync(force);
  }
}

export const syncEngine = new SyncEngine();
