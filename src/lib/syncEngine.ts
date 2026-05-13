import { db, SyncStatus } from './dbLocal';

export const processSyncQueue = async () => {
  if (!navigator.onLine) return;

  const queue = await db.sync_queue.orderBy('id').toArray();
  if (queue.length === 0) return;

  console.log(`[SyncEngine] Procesando cola de sincronización (${queue.length} items)...`);

  for (const item of queue) {
    try {
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
        if (result.success) {
          // Si el servidor confirma, actualizamos el estado del registro original
          const table = db[item.table as keyof typeof db] as any;
          if (table) {
            if (item.operation === 'delete') {
              // Realmente eliminar si es un borrado confirmado por la nube
              await table.delete(item.uuid_sincro);
            } else {
              await table.update(item.uuid_sincro, {
                sync_status: 'synced' as SyncStatus
              });
            }
          }
          // Eliminar de la cola
          await db.sync_queue.delete(item.id!);
        } else {
           console.error(`[SyncEngine] Fallo en registro ${item.uuid_sincro}:`, result.error);
           // Podríamos implementar un sistema de reintentos con contador aquí
        }
      }
    } catch (error) {
      console.error(`[SyncEngine] Error de red procesando item ${item.id}:`, error);
      break; // Detener procesamiento si hay error de red
    }
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
