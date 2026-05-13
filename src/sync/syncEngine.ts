import { db, SyncStatus } from '../db/database';
import { useSyncStore } from '../store/useSyncStore';
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
    window.addEventListener('network-reconnected', () => this.triggerSync());
    
    // Start background sync loop
    this.syncTimer = setInterval(() => {
      this.triggerSync();
    }, 15000); // Check every 15 seconds
    
    this.triggerSync();
  }

  async triggerSync() {
    if (this.processing || !networkMonitor.isOnline()) return;
    
    const store = useSyncStore.getState();
    const pendingItems = await syncQueue.peekAll();
    store.setPendingCount(pendingItems.length);
    
    if (pendingItems.length === 0) return;
    
    this.processing = true;
    store.setSyncing(true);
    logger.info('SyncEngine', `Starting processing ${pendingItems.length} items.`);

    try {
      // Process 1 item at a time sequentially to avoid race conditions
      for (const item of pendingItems) {
        if (!networkMonitor.isOnline()) {
          logger.warn('SyncEngine', 'Network lost during sync. Aborting pass.');
          break;
        }
        await this.processItem(item);
      }
    } finally {
      this.processing = false;
      store.setSyncing(false);
      store.setPendingCount(await db.sync_queue.count());
    }
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
