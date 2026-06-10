import { db, SyncStatus } from '../db/database';
import { useSyncStore } from '../store/useSyncStore';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { logger } from '../lib/logger';
import { syncQueue } from '../sync/syncQueue';
import { networkMonitor } from '../sync/networkMonitor';

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
      return;
    }
    
    this.processing = true;
    const store = useSyncStore.getState();
    store.setSyncing(true);

    try {
      // Fuente canónica: AuthStore (Zustand persist). Fallback a keys legacy por compatibilidad.
      const token = useAuthStore.getState().token
        || localStorage.getItem('cmms_token')
        || localStorage.getItem('auth_token');
      
      let inserts: any[] = [];
      let updates: any[] = [];
      let deletes: any[] = [];
      let pendingItems: any[] = [];

      // Check push queue ONLY if token is available
      if (token) {
        const allPending = await syncQueue.peekAll();
        const now = Date.now();
        
        const deadItems = allPending.filter(item => (item.retry_count || 0) >= 3);
        for (const dead of deadItems) {
          const tableRef = db[dead.table as keyof typeof db] as any;
          if (tableRef && dead.operation !== 'delete') {
            await tableRef.update(dead.uuid_sync, { sync_status: 'failed' });
          }
          // Dejar el item en la queue con retry_count >= 3 para que
          // un eventual "reintentar todo" manual lo pueda resetear.
        }

        pendingItems = allPending.filter((item) => {
          if ((item.retry_count || 0) >= 3) return false;
          if (item.next_retry_at && item.next_retry_at > now) return false;
          return true;
        });

        store.setPendingCount(pendingItems.length);

        for (const item of pendingItems) {
          if (item.operation === 'insert') inserts.push(item);
          else if (item.operation === 'update') updates.push(item);
          else if (item.operation === 'delete') deletes.push(item);
        }
      } else {
        logger.warn('SyncEngine', 'Sin token JWT disponible, omitiendo push local. Se intentará solo pull.');
        store.setPendingCount(0);
      }

      logger.info('SyncEngine', `Ejecutando sync: ${inserts.length} ins, ${updates.length} upd, ${deletes.length} del. Pulling desde ${this.lastSync}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers,
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
               errorDetail = 'El servidor devolvió HTML (posible waking up de contenedor)';
           } else {
               const body = JSON.parse(text);
               if (body && body.error) errorDetail = body.error;
           }
         } catch(e) {}
         throw new Error(`Error en endpoint sync: ${errorDetail || 'Error de red'} (Status: ${response.status})`);
      }

      const responseText = await response.text();
      if (responseText.trim().startsWith('<')) {
         throw new Error(`Respuesta de servidor inválida (HTML). Reintentar después.`);
      }
      
      const { success, results, serverChanges } = JSON.parse(responseText);

      if (success) {
         if (token && results) {
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
                  logger.error('SyncEngine', `Registro ${item.uuid_sync} falló en servidor: ${result?.error}`);
                  await table.update(item.uuid_sync, {
                    sync_status: isConflict ? 'conflicted' : 'failed',
                    last_synced_at: Date.now()
                  });
                }
                await syncQueue.markFailed(item.id!, result?.error || 'Error desconocido');
             }
           }
         }

         store.setPendingCount(await db.sync_queue.count());

         // Handle incoming server changes (PULL)
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
                  
                  if (tableName === 'clientes' || tableName === 'sucursales') {
                     // Spread data to flat fields for easier UI binding
                     if (remoteRecord.data) {
                       try {
                         const parsed = typeof remoteRecord.data === 'string' ? JSON.parse(remoteRecord.data) : remoteRecord.data;
                         mergedRecord = { 
                           ...mergedRecord,
                           ...parsed, 
                           uuid_sync: remoteUuid, 
                           updated_at: remoteRecord.updated_at
                         };
                       } catch(e) {}
                     }
                  } else if (tableName === 'preventive_maintenance') {
                     let extraData: any = {};
                     if (remoteRecord.data) {
                       try {
                         extraData = typeof remoteRecord.data === 'string' ? JSON.parse(remoteRecord.data) : remoteRecord.data;
                       } catch(e) {}
                     }
                     mergedRecord = {
                       id: remoteRecord.id,
                       equipo_tag: remoteRecord.equipo_tag,
                       tecnico: extraData.tecnico || remoteRecord.tecnico || 'Técnico',
                       tecnico_id: remoteRecord.tecnico_id,
                       tipo: remoteRecord.tipo,
                       fecha: remoteRecord.fecha,
                       proxima_fecha: remoteRecord.proxima_fecha || extraData.proxima_fecha || '',
                       estado: remoteRecord.estado || extraData.estado || 'Planificado',
                       hallazgos: remoteRecord.hallazgos || '',
                       // Canónico: acciones (alineado con Neon y LocalMantenimiento)
                       acciones: remoteRecord.acciones || extraData.acciones || '',
                       repuestos: remoteRecord.repuestos || '',
                       cliente_id: remoteRecord.cliente_id || extraData.cliente_id || 'cliente-default-001',
                       uuid_sync: remoteUuid,
                       updated_at: Number(remoteRecord.updated_at || Date.now()),
                       ubicacionGeografica: extraData.ubicacionGeografica
                     };
                  } else if (tableName === 'inventory') {
                     let extraData: any = {};
                     if (remoteRecord.data) {
                       try {
                         extraData = typeof remoteRecord.data === 'string' ? JSON.parse(remoteRecord.data) : remoteRecord.data;
                       } catch(e) {}
                     }
                     mergedRecord = {
                       id: remoteRecord.id,
                       categoria: remoteRecord.categoria || extraData.categoria || '',
                       codigo: remoteRecord.codigo || extraData.codigo || '',
                       nombre: remoteRecord.nombre || extraData.nombre || '',
                       // Canónico: cantidad / unidad_medida (alineado con Neon)
                       cantidad: remoteRecord.cantidad !== undefined ? Number(remoteRecord.cantidad) : (extraData.cantidad !== undefined ? Number(extraData.cantidad) : 0),
                       unidad_medida: remoteRecord.unidad_medida || extraData.unidad_medida || '',
                       cliente_id: remoteRecord.cliente_id || extraData.cliente_id || 'cliente-default-001',
                       marca: remoteRecord.marca || extraData.marca || '',
                       modelo: remoteRecord.modelo || extraData.modelo || '',
                       estado: remoteRecord.estado || extraData.estado || 'disponible',
                       uuid_sync: remoteUuid,
                       updated_at: Number(remoteRecord.updated_at || Date.now())
                     };
                  } else if (tableName === 'users') {
                     let extraData: any = {};
                     if (remoteRecord.data) {
                       try {
                         extraData = typeof remoteRecord.data === 'string'
                           ? JSON.parse(remoteRecord.data)
                           : remoteRecord.data;
                       } catch(e) {}
                     }
                     mergedRecord = {
                       id: remoteRecord.id || remoteUuid,
                       nombre: remoteRecord.nombre || extraData.nombre || '',
                       // Canónico: correo / perfil (alineado con Neon y types.ts)
                       correo: remoteRecord.correo || extraData.correo || '',
                       perfil: remoteRecord.perfil || extraData.perfil || 'tecnico',
                       pin: remoteRecord.pin || extraData.pin || '',
                       activo: remoteRecord.activo !== undefined
                         ? remoteRecord.activo
                         : (extraData.activo !== undefined ? extraData.activo : true),
                       cliente_id: remoteRecord.cliente_id
                         || extraData.cliente_id
                         || 'cliente-default-001',
                       uuid_sync: remoteUuid,
                       updated_at: Number(remoteRecord.updated_at || Date.now())
                     };
                  } else if (tableName === 'assets') {
                     // Specific Dexie field mappings for assets
                     mergedRecord = {
                       uuid_sync: remoteRecord.uuid_sync,
                       tag: remoteRecord.tag,
                       nombre: remoteRecord.nombre,
                       tipo: remoteRecord.tipo,
                       marca: remoteRecord.marca,
                       modelo: remoteRecord.modelo,
                       serie: remoteRecord.serie,
                       ubicacion: remoteRecord.ubicacion,
                       area: remoteRecord.area,
                       capacidad: remoteRecord.capacidad,
                       voltaje: remoteRecord.voltaje,
                       corriente: remoteRecord.corriente,
                       refrigerante: remoteRecord.refrigerante,
                       fecha_instalacion: remoteRecord.fecha_instalacion,
                       vida_util: remoteRecord.vida_util,
                       estado: remoteRecord.estado,
                       ultimo_mantenimiento: remoteRecord.ultimo_mantenimiento,
                       proximo_mantenimiento: remoteRecord.proximo_mantenimiento,
                       frecuencia_mantenimiento: remoteRecord.frecuencia_mantenimiento,
                       horas_operacion: remoteRecord.horas_operacion,
                       tecnicos: typeof remoteRecord.tecnicos === 'string' ? JSON.parse(remoteRecord.tecnicos) : (remoteRecord.tecnicos || []),
                       notas: remoteRecord.notas || '',
                       cliente_id: remoteRecord.cliente_id,
                       sucursal_id: remoteRecord.sucursal_id,
                       latitud: remoteRecord.latitud,
                       longitud: remoteRecord.longitud,
                       updated_at: Number(remoteRecord.updated_at || Date.now())
                     };
                  } else {
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
                  }

                  const hasDirectDeleteAt = remoteRecord.deleted_at !== undefined && remoteRecord.deleted_at !== null;
                  if (hasDirectDeleteAt) {
                     await table.delete(remoteUuid);
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

         this.lastSync = Date.now();
         this.cooldownUntil = 0;
         localStorage.setItem('last_sync_timestamp', this.lastSync.toString());
         // Actualiza el store para que SyncIndicator muestre la hora correcta
         useSyncStore.getState().setLastSync(this.lastSync);

         // Trigger store hydration
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
        logger.warn('SyncEngine', `Sincronización restringida por límites de IP (429). cooldown 50s.`);
      } else if (isFetchError) {
        this.cooldownUntil = Date.now() + 25000;
        logger.warn('SyncEngine', `Servidor inaccesible. cooldown de 25s.`);
      } else {
        logger.error('SyncEngine', 'Fallo de sincronización inesperado:', e);
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
