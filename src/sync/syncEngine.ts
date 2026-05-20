import { db, SyncStatus } from '../db/database';
import { useSyncStore } from '../store/useSyncStore';
import { useAppStore } from '../store/useAppStore';
import { logger } from '../lib/logger';
import { syncQueue } from './syncQueue';
import { networkMonitor } from './networkMonitor';
import { SYNC_RULES } from '../domain/businessRules';
import { apiFetch, getAuthToken } from '../lib/apiFetch';

class SyncEngine {
  private processing = false;
  private syncTimer: any = null;
  private lastSync: number = 0;
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;
    networkMonitor.init();
    window.addEventListener('network-reconnected', () => this.fullSync());
    window.addEventListener('auth-token-updated', () => this.fullSync());
    
    // Attempt full sync every 15s in background
    this.syncTimer = setInterval(() => {
      this.fullSync();
    }, SYNC_RULES.intervalMs);
    
    // Read last sync timestamp
    const val = localStorage.getItem('last_sync_timestamp');
    this.lastSync = val ? Number(val) : 0;

    this.fullSync();
  }

  async fullSync() {
    if (this.processing || !networkMonitor.isOnline()) return;
    if (!getAuthToken()) return;
    this.processing = true;
    const store = useSyncStore.getState();
    store.setSyncing(true);

    try {
      const pendingItems = await syncQueue.peekAll();
      store.setPendingCount(pendingItems.length);

      const inserts: any[] = [];
      const updates: any[] = [];
      const deletes: any[] = [];

      for (const item of pendingItems) {
        if (!item.uuid_sync || typeof item.uuid_sync !== 'string') {
          if (item.id !== undefined) await syncQueue.remove(item.id);
          continue;
        }

        if (item.operation === 'insert') inserts.push(item);
        else if (item.operation === 'update') updates.push(item);
        else if (item.operation === 'delete') deletes.push(item);
      }

      logger.info('SyncEngine', `Pushing bulk: ${inserts.length} ins, ${updates.length} upd, ${deletes.length} del. Pulling since ${this.lastSync}`);

      const response = await apiFetch(SYNC_RULES.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inserts,
          updates,
          deletes,
          lastSync: this.lastSync
        })
      });

      if (!response.ok) {
         throw new Error(`Sync Error: ${response.statusText}`);
      }

      const { success, results, serverChanges, serverTime } = await response.json();

      if (success || results) {
         // Resolve only queue items explicitly accepted by the server.
         const acceptedQueueIds = this.getAcceptedQueueIds(results);
         for (const item of pendingItems) {
           if (!item.uuid_sync || typeof item.uuid_sync !== 'string') continue;
           const table = db[item.table as keyof typeof db] as any;
           const accepted = item.id !== undefined && acceptedQueueIds.has(item.id);

           if (accepted) {
             if (table && item.operation !== 'delete') {
                await table.update(item.uuid_sync, {
                  sync_status: 'synced',
                  last_synced_at: Date.now(),
                  retry_count: 0
                });
             }
             await syncQueue.remove(item.id!);
           } else if (table) {
             const existing = await table.get(item.uuid_sync);
             if (existing) {
               await table.update(item.uuid_sync, {
                 sync_status: 'failed',
                 retry_count: (existing.retry_count || 0) + 1
               });
             }
           }
         }

         store.setPendingCount(await db.sync_queue.count());

         // Handle incoming server changes
         if (serverChanges) {
           for (const [tableName, rows] of Object.entries(serverChanges)) {
             const table = db[tableName as keyof typeof db] as any;
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

                  if (remoteRecord.deleted_at) {
                    const localHasPendingWork = local && local.sync_status && local.sync_status !== 'synced';
                    if (!localHasPendingWork) await table.delete(remoteUuid);
                  } else {
                    await table.put({
                      ...mergedRecord,
                      sync_status: 'synced',
                      last_synced_at: Date.now()
                    });
                  }
               }
             }
           }
         }

         this.lastSync = Number(serverTime || Date.now());
         localStorage.setItem('last_sync_timestamp', this.lastSync.toString());
         
         // Refresh views
         await useAppStore.getState().hydrate();
      }

    } catch (e) {
      logger.error('SyncEngine', 'Sync failed', e);
    } finally {
      store.setSyncing(false);
      this.processing = false;
    }
  }


  private getAcceptedQueueIds(results: any): Set<number> {
    const accepted = new Set<number>();
    const statuses = SYNC_RULES.allowedStatusesToDequeue;
    const buckets = [results?.inserts, results?.updates, results?.deletes];
    for (const bucket of buckets) {
      if (!Array.isArray(bucket)) continue;
      for (const result of bucket) {
        if (typeof result?.queue_id === 'number' && statuses.includes(result.status)) {
          accepted.add(result.queue_id);
        }
      }
    }
    return accepted;
  }

  async triggerSync() {
    return this.fullSync();
  }
}

export const syncEngine = new SyncEngine();
