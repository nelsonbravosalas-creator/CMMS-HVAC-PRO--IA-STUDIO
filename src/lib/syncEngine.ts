import { db } from '../db/database';
import { useSyncStore } from '../store/useSyncStore';
import { useAppStore } from '../store/useAppStore';
import { logger } from '../lib/logger';
import { syncQueue } from '../sync/syncQueue';
import { networkMonitor } from '../sync/networkMonitor';

// Mapeo canónico exacto coincidente con ALLOWED_TABLES del backend
export const ENTITY_TYPE_MAP = {
  assets:                 'assets',
  workOrders:             'work_orders',
  preventive_maintenance: 'preventive_maintenance',
  inventory:              'inventory',
  users:                  'users',
  calendar:               'calendar',
} as const;

export class SyncEngine {
  private processing = false;
  private syncTimer: any = null;
  private lastSync: number = 0;
  private cooldownUntil: number = 0;

  init() {
    networkMonitor.init();
    window.addEventListener('network-reconnected', () => this.fullSync(true));
    
    // Intenta sincronización cada 15s en background
    this.syncTimer = setInterval(() => {
      this.fullSync();
    }, 15000);
    
    const val = localStorage.getItem('last_sync_timestamp');
    this.lastSync = val ? Number(val) : 0;

    this.fullSync();
  }

  async fullSync(force: boolean = false) {
    if (this.processing || !networkMonitor.isOnline()) return;
    if (!force && this.cooldownUntil && Date.now() < this.cooldownUntil) {
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

      // Obtener el cliente activo del Auth Store para inyección de Tenant
      const activeUserStr = localStorage.getItem('cmms_active_user') || localStorage.getItem('user');
      let activeClienteId = 'cliente-default-001';
      
      if (activeUserStr) {
        try {
          const parsed = JSON.parse(activeUserStr);
          if (parsed.cliente_id || parsed.tenantId) {
             activeClienteId = parsed.cliente_id || parsed.tenantId;
          }
        } catch (e) {}
      }

      for (const item of pendingItems) {
        // Mapear de Dexie a estructura de tabla física en la base de datos de Postgres
        let tableMapped = item.table;
        if (item.table === 'work_orders' || item.table === 'ordenes_trabajo') {
          tableMapped = 'work_orders';
        } else if (item.table === 'preventive_maintenance' || item.table === 'mantenimiento_preventivo') {
          tableMapped = 'preventive_maintenance';
        } else if (item.table === 'inventory' || item.table === 'inventario') {
          tableMapped = 'inventory';
        } else if (item.table === 'technicians' || item.table === 'tecnicos' || item.table === 'users') {
          tableMapped = 'users';
        }

        // Estructura de payload canónica acordada Front -> server.ts
        const originalData = item.data || {};
        const dataPayload = {
          ...originalData,
          cliente_id: originalData.cliente_id || activeClienteId
        };

        const mappedItem = {
          id: item.uuid_sync || item.id,
          uuid_sync: item.uuid_sync,
          table: tableMapped,
          data: dataPayload,
          updated_at: (item as any).updated_at || Date.now(),
          timestamp: (item as any).updated_at || Date.now()
        };

        if (item.operation === 'insert') inserts.push(mappedItem);
        else if (item.operation === 'update') updates.push(mappedItem);
        else if (item.operation === 'delete') deletes.push(mappedItem);
      }

      logger.info('SyncEngine', `Iniciando empuje masivo: ${inserts.length} ins, ${updates.length} upd, ${deletes.length} del. Pulling desde timestamp ${this.lastSync}`);

      const response = await fetch(`/api/sync?clienteId=${activeClienteId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-client-id': activeClienteId,
          'x-cliente-id': activeClienteId
        },
        body: JSON.stringify({
          inserts,
          updates,
          deletes,
          lastSync: this.lastSync,
          clienteId: activeClienteId,
          cliente_id: activeClienteId
        })
      });

      if (!response.ok) {
         let errorDetail = response.statusText;
         try {
           const text = await response.text();
           if (text.trim().startsWith('<')) {
               errorDetail = 'El servidor devolvió HTML (error proxy Vercel)';
           } else {
               const body = JSON.parse(text);
               if (body && body.error) errorDetail = body.error;
           }
         } catch(e) {}
         throw new Error(`Error en Sincronización Express: ${errorDetail} (Código: ${response.status})`);
      }

      const responseText = await response.text();
      const { success, results, serverChanges, serverTime } = JSON.parse(responseText);

      if (success) {
         const resultList = [...(results.inserts || []), ...(results.updates || []), ...(results.deletes || [])];
         const resultMap = new Map(resultList.map((r: any) => [r.uuid_sync, r]));

         for (const item of pendingItems) {
           const table = db[item.table as keyof typeof db] as any;
           const result = resultMap.get(item.uuid_sync);
           const rStatus = result ? result.result : 'error';
           const rSuccess = rStatus === 'applied' || rStatus === 'noop' || (result && result.success);

           if (rSuccess) {
              if (table && item.operation !== 'delete') {
                await table.update(item.uuid_sync, {
                  sync_status: 'synced',
                  last_synced_at: Date.now(),
                  retry_count: 0
                });
              }
              await syncQueue.remove(item.id!);
           } else {
              if (table && item.operation !== 'delete') {
                const isConflict = rStatus === 'conflict';
                logger.error('SyncEngine', `Fila ${item.uuid_sync} rechazada por el servidor: ${result?.error}`);
                await table.update(item.uuid_sync, {
                  sync_status: isConflict ? 'conflicted' : 'failed',
                  last_synced_at: Date.now()
                });
              }
              await syncQueue.markFailed(item.id!, result?.error || 'Rechazo del motor.');
           }
         }

         store.setPendingCount(await db.sync_queue.count());

         // Fase pulling: guardar datos del servidor filtrados por cliente_id
         if (serverChanges) {
           for (const [tableName, rows] of Object.entries(serverChanges)) {
             let localTableName = tableName;
             if (tableName === 'work_orders' || tableName === 'ordenes_trabajo') {
               localTableName = 'work_orders';
             } else if (tableName === 'preventive_maintenance' || tableName === 'mantenimiento_preventivo') {
               localTableName = 'preventive_maintenance';
             } else if (tableName === 'inventory' || tableName === 'inventario') {
               localTableName = 'inventory';
             } else if (tableName === 'users' || tableName === 'tecnicos') {
               localTableName = 'users';
             }

             const table = db[localTableName as keyof typeof db] as any;
             if (!table) continue;

             for (const remoteRecord of rows as any[]) {
               const remoteUuid = remoteRecord.uuid_sync;
               if (!remoteUuid) continue;

               const local = await table.get(remoteUuid);
               if (!local || (remoteRecord.updated_at || 0) > (local.updated_at || 0)) {
                  let mergedRecord = remoteRecord;
                  if (remoteRecord.data) {
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

         this.lastSync = serverTime || Date.now();
         this.cooldownUntil = 0;
         localStorage.setItem('last_sync_timestamp', this.lastSync.toString());
         
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
        this.cooldownUntil = Date.now() + 50000;
        logger.warn('SyncEngine', `Límite superado (429). Pospone ciclo sync por 50 segundos.`);
      } else if (isFetchError) {
        this.cooldownUntil = Date.now() + 25000;
        logger.warn('SyncEngine', `Servidor inaccesible. Pospone ciclo sync por 25 segundos.`);
      } else {
        logger.error('SyncEngine', 'Sync Engine error no manejado:', e);
      }
    } finally {
      store.setSyncing(false);
      this.processing = false;
    }
  }

  async triggerSync(force: boolean = false) {
    if (force) {
      this.cooldownUntil = 0;
    }
    return this.fullSync(force);
  }
}

export const syncEngine = new SyncEngine();
export default syncEngine;
