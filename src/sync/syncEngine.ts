import { db, SyncStatus } from '../db/database';
import { useSyncStore } from '../store/useSyncStore';
import { useAppStore } from '../store/useAppStore';
import { logger } from '../lib/logger';
import { syncQueue } from './syncQueue';
import { networkMonitor } from './networkMonitor';
import { latencyManager } from './latencyManager';
import { retryManager } from './retryManager';

class SyncEngine {
  private processing = false;
  private syncTimer: any = null;

  init() {
    networkMonitor.init();
    window.addEventListener('network-reconnected', () => this.fullSync());
    
    // Start background sync loop
    this.syncTimer = setInterval(() => {
      this.fullSync();
    }, 15000); // Check every 15 seconds
    
    this.fullSync();
  }

  async fullSync() {
    if (this.processing || !networkMonitor.isOnline()) return;
    this.processing = true;
    try {
      await this.triggerPush();
      await this.triggerPull();
    } finally {
      this.processing = false;
    }
  }

  async triggerPush() {
    if (!networkMonitor.isOnline()) return;
    
    const store = useSyncStore.getState();
    const pendingItems = await syncQueue.peekAll();
    store.setPendingCount(pendingItems.length);
    
    if (pendingItems.length === 0) return;
    
    store.setSyncing(true);
    logger.info('SyncEngine', `Starting push for ${pendingItems.length} items.`);

    try {
      for (const item of pendingItems) {
        if (!networkMonitor.isOnline()) break;
        await this.processItem(item);
      }
    } finally {
      store.setSyncing(false);
      store.setPendingCount(await db.sync_queue.count());
    }
  }

  async triggerPull() {
    if (!networkMonitor.isOnline()) return;
    
    const tables = ['activos', 'tickets', 'mantenimientos', 'clientes', 'usuarios', 'sucursales', 'informes', 'eventos'];
    logger.info('SyncEngine', 'Starting pull for all tables.');

    for (const tableName of tables) {
      try {
        const table = db[tableName as keyof typeof db] as any;
        if (!table) continue;

        const lastRecord = await table.orderBy('modificado_en').reverse().first();
        const since = lastRecord ? lastRecord.modificado_en : 0;

        const response = await fetch(`/api/sync/${tableName}?since=${since}`);
        if (response.ok) {
          const { data } = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            for (const remoteRecord of data) {
              const remoteUuid = remoteRecord.uuid_sincro;
              
              if (!remoteUuid || typeof remoteUuid !== 'string') {
                logger.warn('SyncEngine', `Remote record in ${tableName} missing valid uuid_sincro, skipping.`, remoteRecord);
                continue;
              }

              const local = await table.get(remoteUuid);
              
              if (!local || (remoteRecord.modificado_en || 0) > (local.modificado_en || 0)) {
                let mergedRecord = remoteRecord;
                // If it came from a generic table (id, data, modificado_en)
                if (tableName !== 'activos' && remoteRecord.data) {
                  try {
                    const parsed = typeof remoteRecord.data === 'string' ? JSON.parse(remoteRecord.data) : remoteRecord.data;
                    mergedRecord = { 
                      ...parsed, 
                      uuid_sincro: remoteUuid, 
                      modificado_en: remoteRecord.modificado_en || Date.now()
                    };
                  } catch (e) {
                    logger.error('SyncEngine', `Failed to parse data for ${tableName}:${remoteUuid}`, e);
                    continue;
                  }
                }

                await table.put({
                  ...mergedRecord,
                  sync_status: 'synced',
                  last_synced_at: Date.now()
                });
              }
            }
            logger.info('SyncEngine', `Pulled ${data.length} records for ${tableName}`);
          }
        } else {
          const errData = await response.json().catch(() => ({ error: response.statusText }));
          logger.error('SyncEngine', `Pull failed for ${tableName}: ${response.status} ${errData.error || ''}`);
        }
      } catch (error: any) {
        if (error?.message === 'Failed to fetch') {
          logger.warn('SyncEngine', `Pull failed for ${tableName} (Network/Server unavailable)`);
        } else {
          logger.error('SyncEngine', `Pull failed for ${tableName}`, error);
        }
      }
    }
    
    // Refresh local store with newly pulled data
    await useAppStore.getState().hydrate();
  }

  // Renamed triggerSync to fullSync above
  async triggerSync() {
    return this.fullSync();
  }

  private async processItem(item: any) {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), latencyManager.getTimeoutForRequest());
      
      const response = await fetch(`/api/sync/${item.table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          records: [item.data],
          operation: item.operation 
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      latencyManager.recordLatency(Date.now() - startTime);

      if (response.ok) {
        const result = await response.json();
        await this.handleSuccess(item, result);
      } else {
        throw { status: response.status, message: response.statusText };
      }
    } catch (error: any) {
      await this.handleError(item, error);
    }
  }

  private async handleSuccess(item: any, serverResult: any) {
    const table = db[item.table as keyof typeof db] as any;
    if (table) {
      if (item.operation === 'delete') {
        await table.delete(item.uuid_sincro);
      } else {
        const updates: any = { 
          sync_status: 'synced' as SyncStatus,
          last_synced_at: Date.now(),
          retry_count: 0
        };
        
        const officialId = serverResult?.results?.[0]?.folio_oficial || serverResult?.results?.[0]?.id;
        if (officialId) {
          if (item.table === 'activos') updates.tag = officialId;
          else updates.id = officialId;
        }

        await table.update(item.uuid_sincro, updates);
      }
    }
    await syncQueue.remove(item.id!);
    
    useSyncStore.getState().addSyncResult({
      id: crypto.randomUUID(),
      table: item.table,
      operation: item.operation,
      status: 'success',
      timestamp: Date.now()
    });
    
    logger.info('SyncEngine', `Successfully synced ${item.table}:${item.uuid_sincro}`);
  }

  private async handleError(item: any, error: any) {
    logger.error('SyncEngine', `Sync failed for ${item.table}:${item.uuid_sincro}`, error);
    
    const table = db[item.table as keyof typeof db] as any;
    if (table) {
      const record = await table.get(item.uuid_sincro);
      if (record) {
        const currentRetry = record.retry_count || 0;
        
        if (retryManager.shouldRetry(currentRetry, error)) {
          // Leave it in the queue, just update the table status and retry_count
          await table.update(item.uuid_sincro, {
            sync_status: 'failed' as SyncStatus,
            retry_count: currentRetry + 1
          });
        } else {
          // Hard fail, remove from queue
          await table.update(item.uuid_sincro, {
            sync_status: 'conflicted' as SyncStatus
          });
          await syncQueue.remove(item.id!);
          logger.warn('SyncEngine', `Abandoned syncing ${item.table}:${item.uuid_sincro} after ${currentRetry} retries.`);
        }
      }
    }

    useSyncStore.getState().addSyncResult({
      id: crypto.randomUUID(),
      table: item.table,
      operation: item.operation,
      status: 'error',
      error: error.message || String(error),
      timestamp: Date.now()
    });
  }
}

export const syncEngine = new SyncEngine();
