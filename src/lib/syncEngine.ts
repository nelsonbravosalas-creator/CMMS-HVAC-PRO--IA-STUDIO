import { db, SyncStatus } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { logger } from './logger';

export const processSyncQueue = async () => {
  const syncStore = useSyncStore.getState();
  if (syncStore.isSyncing || !navigator.onLine) return;
  
  syncStore.setSyncing(true);
  logger.info('Sync', 'Iniciando proceso de sincronización...');

  try {
    const queue = await db.sync_queue.orderBy('id').toArray();
    syncStore.setPendingCount(queue.length);
    if (queue.length === 0) return;

    console.log(`[SyncEngine] Procesando cola de sincronización (${queue.length} items)...`);

    for (const item of queue) {
      if (!navigator.onLine) break;
      try {
        logger.debug('Sync', `Sincronizando ${item.table}:${item.uuid_sincro}`, { operation: item.operation });
        
        const response = await fetch(`/api/sync/${item.table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            records: [item.data],
            operation: item.operation 
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.results) {
            const table = db[item.table as keyof typeof db] as any;
            if (table) {
              const serverResult = result.results[0];
              
              if (item.operation === 'delete') {
                await table.delete(item.uuid_sincro);
              } else {
                const now = Date.now();
                const updates: any = { 
                  sync_status: 'synced' as SyncStatus,
                  last_synced_at: now,
                  retry_count: 0
                };
                
                if (serverResult.folio_oficial || serverResult.id) {
                  const officialId = serverResult.folio_oficial || serverResult.id;
                  if (item.table === 'activos') updates.tag = officialId;
                  else updates.id = officialId;
                }

                await table.update(item.uuid_sincro, updates);
                
                const store = useAppStore.getState();
                const updatedRecord = await table.get(item.uuid_sincro);
                if (updatedRecord) {
                  const updateAction = `update${item.table.charAt(0).toUpperCase()}${item.table.slice(1, -1)}` as any;
                  const singleUpdate = (store as any)[updateAction];
                  if (typeof singleUpdate === 'function') {
                    singleUpdate(updatedRecord);
                  }
                }
              }
            }
            await db.sync_queue.delete(item.id!);
            logger.info('Sync', `Éxito al sincronizar ${item.table}:${item.uuid_sincro}`);
            syncStore.addSyncResult({
              id: crypto.randomUUID(),
              table: item.table,
              operation: item.operation,
              status: 'success',
              timestamp: Date.now()
            });
          } else {
             throw new Error(result.error || 'Server rejected request');
          }
        } else {
          throw new Error(`HTTP Error ${response.status}`);
        }
      } catch (error) {
        logger.error('Sync', `Error sincronizando ${item.table}:${item.uuid_sincro}, marcando para reintento`, error);
        
        const table = db[item.table as keyof typeof db] as any;
        if (table) {
          const record = await table.get(item.uuid_sincro);
          if (record) {
            await table.update(item.uuid_sincro, {
              sync_status: 'failed' as SyncStatus,
              retry_count: (record.retry_count || 0) + 1
            });
          }
        }

        syncStore.addSyncResult({
          id: crypto.randomUUID(),
          table: item.table,
          operation: item.operation,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        });

        // Optional: delete from queue if max retries reached, or just leave it for next pass
        // For now, we leave it in queue and break to avoid flooding when offline or server down
        break; 
      }
    }
  } finally {
    useSyncStore.getState().setSyncing(false);
    const finalCount = await db.sync_queue.count();
    useSyncStore.getState().setPendingCount(finalCount);
  }
};

export const syncData = processSyncQueue;

export const initSyncEngine = () => {
  window.addEventListener('online', processSyncQueue);
  // Intentar sincro cada 20 segundos
  setInterval(processSyncQueue, 20000);
  // Sincro inicial
  processSyncQueue();
};
