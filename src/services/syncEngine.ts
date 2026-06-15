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
  private lastSeqByTable: Record<string, number> = {};
  private cooldownUntil: number = 0;

  init() {
    networkMonitor.init();
    window.addEventListener('network-reconnected', () => this.fullSync(true));

    // Attempt full sync every 15s in background
    this.syncTimer = setInterval(() => {
      this.fullSync();
    }, 15000);

    // Read last sync timestamp and per-table seq cursors
    const val = localStorage.getItem('last_sync_timestamp');
    this.lastSync = val ? Number(val) : 0;
    const seqVal = localStorage.getItem('cmms_last_seq_by_table');
    this.lastSeqByTable = seqVal ? JSON.parse(seqVal) : {};

    this.fullSync();
  }

  async fullSync(force: boolean = false): Promise<{ success: boolean; pulled: number; pushed: number; error?: string }> {
    if (this.processing || !networkMonitor.isOnline()) {
      return { success: false, pulled: 0, pushed: 0, error: 'Sin conexión o sincronización en progreso' };
    }
    if (!force && this.cooldownUntil && Date.now() < this.cooldownUntil) {
      return { success: false, pulled: 0, pushed: 0, error: 'Cooldown activo' };
    }

    this.processing = true;
    const store = useSyncStore.getState();
    store.setSyncing(true);

    let syncResult: { success: boolean; pulled: number; pushed: number; error?: string } = { success: false, pulled: 0, pushed: 0 };

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
        const activeClientId = localStorage.getItem('active_client');
        const clientFilteredPending = activeClientId
          ? allPending.filter(item => !item.cliente_id || item.cliente_id === activeClientId)
          : allPending;

        const deadItems = clientFilteredPending.filter(item => (item.retry_count || 0) >= 3);
        for (const dead of deadItems) {
          const tableRef = db[dead.table as keyof typeof db] as any;
          if (tableRef && dead.operation !== 'delete') {
            await tableRef.update(dead.uuid_sync, { sync_status: 'failed' });
          }
        }

        pendingItems = clientFilteredPending.filter((item) => {
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
        // No token — cannot authenticate with the server. Stop here instead of getting a 401.
        logger.warn('SyncEngine', 'Sin token JWT. Se requiere sesión online para sincronizar con el servidor.');
        syncResult = { success: false, pulled: 0, pushed: 0, error: 'Sesión sin token — inicia sesión online para sincronizar' };
        return syncResult;
      }

      logger.info('SyncEngine', `Ejecutando sync: ${inserts.length} ins, ${updates.length} upd, ${deletes.length} del. Pulling desde ${this.lastSync}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Incluir idempotencyKey por op para que el servidor pueda deduplicar
      const opsWithKey = (ops: any[]) => ops.map(op => ({
        ...op,
        idempotencyKey: op.idempotencyKey || crypto.randomUUID()
      }));

      const batchKey = crypto.randomUUID();
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { ...headers, 'Idempotency-Key': batchKey },
        body: JSON.stringify({
          inserts: opsWithKey(inserts),
          updates: opsWithKey(updates),
          deletes: opsWithKey(deletes),
          seqs: this.lastSeqByTable
        })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          useAuthStore.getState().logout();
          localStorage.removeItem('auth_token');
          localStorage.removeItem('cmms_token');
          this.cooldownUntil = Date.now() + 24 * 60 * 60 * 1000;
          logger.warn('SyncEngine', `Token rechazado por el servidor (${response.status}). Sesión limpiada — requiere nuevo login.`);
          throw new Error(`Sesión expirada o inválida (${response.status}). Por favor inicia sesión nuevamente.`);
        }
        if (response.status === 409) {
          // Conflicto a nivel de batch — guardar todas las ops como conflictos y continuar
          let conflictBody: any = {};
          try { conflictBody = await response.json(); } catch {}
          const conflictOps = [...inserts, ...updates];
          for (const op of conflictOps) {
            await db.conflicts.add({
              entityType: op.table,
              entityId: op.uuid_sync,
              clienteId: op.cliente_id,
              localData: op.data,
              serverData: conflictBody.serverEntity || null,
              detectedAt: Date.now(),
              resolved: false
            });
            const tableRef = db[op.table as keyof typeof db] as any;
            if (tableRef) await tableRef.update(op.uuid_sync, { sync_status: 'conflicted' });
          }
          store.addError(`Conflicto de sincronización: ${conflictOps.length} registros en conflicto. Revisa el indicador de sync.`);
          logger.warn('SyncEngine', `409 batch conflict: ${conflictOps.length} ops guardadas en db.conflicts`);
          syncResult = { success: false, pulled: 0, pushed: 0, error: 'Conflicto 409 detectado' };
          return syncResult;
        }
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
        let pushedOk = 0;
        if (token && results) {
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
              pushedOk++;
            } else {
              if (table && item.operation !== 'delete') {
                const isConflict = rStatus === 'conflict';
                const errMsg = result?.error || 'Error desconocido';
                logger.error('SyncEngine', `Registro ${item.uuid_sync} falló en servidor: ${errMsg}`);
                store.addError(`[${item.table}] ${errMsg}`);
                await table.update(item.uuid_sync, {
                  sync_status: isConflict ? 'conflicted' : 'failed',
                  last_synced_at: Date.now()
                });
                if (isConflict) {
                  await db.conflicts.add({
                    entityType: item.table,
                    entityId: item.uuid_sync,
                    clienteId: item.cliente_id,
                    localData: item.data,
                    serverData: result?.serverEntity || null,
                    detectedAt: Date.now(),
                    resolved: false
                  });
                }
              }
              await syncQueue.markFailed(item.id!, result?.error || 'Error desconocido');
            }
          }
        }

        const failedInQueue = await db.sync_queue.where('retry_count').aboveOrEqual(3).count();
        store.setFailedCount(failedInQueue);
        store.setPendingCount(await db.sync_queue.count());

        // Handle incoming server changes (PULL)
        let pulledCount = 0;
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
                  mergedRecord = { ...remoteRecord, uuid_sync: remoteUuid };
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
                  const localUserRecord = await db.users.get(remoteUuid);
                  const remotePin = remoteRecord.pin || extraData.pin || null;
                  mergedRecord = {
                    id: remoteRecord.id || remoteUuid,
                    nombre: remoteRecord.nombre || extraData.nombre || '',
                    correo: remoteRecord.correo || extraData.correo || '',
                    perfil: remoteRecord.perfil || extraData.perfil || 'tecnico',
                    // Preservar hash local si el servidor no trae PIN válido
                    pin: remotePin || (localUserRecord ? localUserRecord.pin : ''),
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
                pulledCount++;
              }
            }

            // Actualizar cursor server_seq para esta tabla
            const tableRows = rows as any[];
            const maxSeq = tableRows.reduce((m: number, r: any) => Math.max(m, r.server_seq || 0), 0);
            if (maxSeq > 0) {
              this.lastSeqByTable[tableName] = Math.max(this.lastSeqByTable[tableName] || 0, maxSeq);
            }
          }
          localStorage.setItem('cmms_last_seq_by_table', JSON.stringify(this.lastSeqByTable));
        }

        this.lastSync = Date.now();
        this.cooldownUntil = 0;
        localStorage.setItem('last_sync_timestamp', this.lastSync.toString());
        useSyncStore.getState().setLastSync(this.lastSync);

        await useAppStore.getState().hydrate();
        syncResult = { success: true, pulled: pulledCount, pushed: pushedOk };
      }

    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      syncResult = { success: false, pulled: 0, pushed: 0, error: errorMsg };
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

    return syncResult;
  }

  async triggerSync(force: boolean = false) {
    if (force) {
      this.cooldownUntil = 0;
      useSyncStore.getState().clearErrors();
    }
    return this.fullSync(force);
  }

  async retryFailed() {
    const dead = await db.sync_queue.filter(item => (item.retry_count || 0) >= 3).toArray();
    for (const item of dead) {
      await db.sync_queue.update(item.id!, { retry_count: 0, next_retry_at: undefined, last_error: undefined });
      const tableRef = db[item.table as keyof typeof db] as any;
      if (tableRef && item.operation !== 'delete') {
        const statusMap: Record<string, SyncStatus> = {
          insert: 'pending_insert',
          update: 'pending_update',
          delete: 'pending_delete'
        };
        await tableRef.update(item.uuid_sync, {
          sync_status: statusMap[item.operation] || 'pending_insert'
        });
      }
    }
    useSyncStore.getState().clearErrors();
    useSyncStore.getState().setFailedCount(0);
    logger.info('SyncEngine', `Reintentando ${dead.length} items fallidos`);
    return this.fullSync(true);
  }
}

export const syncEngine = new SyncEngine();
export default syncEngine;
