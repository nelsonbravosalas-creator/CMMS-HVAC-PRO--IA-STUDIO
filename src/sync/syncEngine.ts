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

  init() {
    networkMonitor.init();
    window.addEventListener('network-reconnected', () => this.fullSync());
    
    // Attempt full sync every 15s in background
    this.syncTimer = setInterval(() => {
      this.fullSync();
    }, 15000);
    
    // Read last sync timestamp
    const val = localStorage.getItem('last_sync_timestamp');
    this.lastSync = val ? Number(val) : 0;

    this.fullSync();
  }

  async fullSync() {
    if (this.processing || !networkMonitor.isOnline()) return;
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
        if (item.operation === 'insert') inserts.push(item);
        else if (item.operation === 'update') updates.push(item);
        else if (item.operation === 'delete') deletes.push(item);
      }

      logger.info('SyncEngine', `Pushing bulk: ${inserts.length} ins, ${updates.length} upd, ${deletes.length} del. Pulling since ${this.lastSync}`);

      const response = await fetch('/api/sync', {
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

      const { success, results, serverChanges } = await response.json();

      if (success) {
         // Resolve processed queue items
         for (const item of pendingItems) {
           const table = db[item.table as keyof typeof db] as any;
           if (table && item.operation !== 'delete') {
              // mark as synced
              await table.update(item.uuid_sync, {
                sync_status: 'synced',
                last_synced_at: Date.now(),
                retry_count: 0
              });
           }
           await syncQueue.remove(item.id!);
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

  async triggerSync() {
    return this.fullSync();
  }
}

export const syncEngine = new SyncEngine();
