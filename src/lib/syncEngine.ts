import { db, SyncStatus } from './dbLocal';
import { useCMMSStore } from '../store/useCMMSStore';

let isSyncing = false;

export const processSyncQueue = async () => {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;

  try {
    const queue = await db.sync_queue.orderBy('id').toArray();
    if (queue.length === 0) return;

    console.log(`[SyncEngine] Procesando cola de sincronización (${queue.length} items)...`);

    for (const item of queue) {
      try {
        console.log(`[SyncEngine] Sincronizando ${item.table}:${item.uuid_sincro} (${item.operation})`);
        
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
              const serverResult = result.results[0]; // Since we send records: [item.data]
              
              if (item.operation === 'delete') {
                await table.delete(item.uuid_sincro);
              } else {
                const status: SyncStatus = 'synced';
                const updates: any = { sync_status: status };
                
                // Si el servidor asignó un ID oficial (Folio), lo guardamos localmente
                if (serverResult.folio_oficial || serverResult.id) {
                  const officialId = serverResult.folio_oficial || serverResult.id;
                  // Para Activos el ID es 'tag', para otros es 'id'
                  if (item.table === 'activos') updates.tag = officialId;
                  else updates.id = officialId;
                }

                await table.update(item.uuid_sincro, updates);
                
                // Notificar al Store para que el icono de nube cambie y se vea el ID real
                const store = useCMMSStore.getState();
                store.setSyncStatus(item.table, item.uuid_sincro, status);
                
                // Si cambió el ID, necesitamos actualizar el objeto completo en el store
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
            // Eliminar de la cola
            await db.sync_queue.delete(item.id!);
            console.log(`[SyncEngine] OK: ${item.table}:${item.uuid_sincro}`);
          } else {
             console.error(`[SyncEngine] Fallo en registro ${item.uuid_sincro}:`, result.error);
          }
        }
      } catch (error) {
        console.error(`[SyncEngine] Error de red procesando item ${item.id}:`, error);
        break; // Detener procesamiento si hay error de red
      }
    }
  } finally {
    isSyncing = false;
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
