import { ALLOWED_TABLES, normalizeSyncTable, type SyncTable } from './_schema';

type OperationName = 'insert' | 'update' | 'delete';
type OperationResultStatus = 'applied' | 'noop' | 'error';

export interface SyncOperationResult {
  queue_id?: number;
  uuid_sync?: string;
  table?: SyncTable | string;
  operation: OperationName;
  status: OperationResultStatus;
  folio_oficial?: string;
  error?: string;
}

export interface SyncApplyResult {
  success: boolean;
  results: {
    inserts: SyncOperationResult[];
    updates: SyncOperationResult[];
    deletes: SyncOperationResult[];
  };
  serverChanges: Record<string, any[]>;
  serverTime: number;
}

export async function applySyncOperations(sql: any, body: any): Promise<SyncApplyResult> {
  const { inserts = [], updates = [], deletes = [], lastSync = 0 } = body || {};
  const results = { inserts: [] as SyncOperationResult[], updates: [] as SyncOperationResult[], deletes: [] as SyncOperationResult[] };

  for (const operation of inserts) {
    results.inserts.push(await applyInsert(sql, operation));
  }

  for (const operation of updates) {
    results.updates.push(await applyUpdate(sql, operation));
  }

  for (const operation of deletes) {
    results.deletes.push(await applyDelete(sql, operation));
  }

  const serverChanges: Record<string, any[]> = {};
  for (const table of ALLOWED_TABLES) {
    const rows = await sql(`SELECT * FROM ${table} WHERE updated_at > $1 ORDER BY updated_at ASC LIMIT 1000`, [Number(lastSync) || 0]);
    if (rows.length > 0) serverChanges[table] = rows;
  }

  const allResults = [...results.inserts, ...results.updates, ...results.deletes];
  return {
    success: allResults.every((result) => result.status !== 'error'),
    results,
    serverChanges,
    serverTime: Date.now()
  };
}

async function applyInsert(sql: any, operation: any): Promise<SyncOperationResult> {
  const table = normalizeSyncTable(operation?.table);
  const base = baseResult(operation, 'insert', table || operation?.table);
  if (!table) return { ...base, status: 'error', error: `Tabla no permitida: ${operation?.table}` };
  if (!operation?.uuid_sync) return { ...base, status: 'error', error: 'uuid_sync requerido' };

  try {
    if (table === 'assets') {
      await upsertAsset(sql, operation, false);
    } else if (table === 'users') {
      await upsertUser(sql, operation);
    } else {
      await upsertGeneric(sql, table, operation);
    }
    return { ...base, table, status: 'applied', folio_oficial: operation.data?.tag || operation.data?.id };
  } catch (error: any) {
    return { ...base, table, status: 'error', error: error.message };
  }
}

async function applyUpdate(sql: any, operation: any): Promise<SyncOperationResult> {
  const table = normalizeSyncTable(operation?.table);
  const base = baseResult(operation, 'update', table || operation?.table);
  if (!table) return { ...base, status: 'error', error: `Tabla no permitida: ${operation?.table}` };
  if (!operation?.uuid_sync) return { ...base, status: 'error', error: 'uuid_sync requerido' };

  try {
    if (table === 'assets') {
      await upsertAsset(sql, operation, true);
    } else if (table === 'users') {
      await upsertUser(sql, operation);
    } else {
      await upsertGeneric(sql, table, operation);
    }
    return { ...base, table, status: 'applied' };
  } catch (error: any) {
    return { ...base, table, status: 'error', error: error.message };
  }
}

async function applyDelete(sql: any, operation: any): Promise<SyncOperationResult> {
  const table = normalizeSyncTable(operation?.table);
  const base = baseResult(operation, 'delete', table || operation?.table);
  if (!table) return { ...base, status: 'error', error: `Tabla no permitida: ${operation?.table}` };
  if (!operation?.uuid_sync) return { ...base, status: 'error', error: 'uuid_sync requerido' };

  const timestamp = Number(operation.updated_at || operation.data?.deleted_at || operation.deleted_at || Date.now());

  try {
    if (table === 'assets') {
      await sql`
        INSERT INTO assets (uuid_sync, tag, nombre, estado, updated_at, created_at, deleted_at)
        VALUES (${operation.uuid_sync}, ${operation.data?.tag || operation.uuid_sync}, ${operation.data?.nombre || 'Registro eliminado'}, 'baja', ${timestamp}, ${timestamp}, ${timestamp})
        ON CONFLICT (uuid_sync) DO UPDATE SET
          estado = 'baja',
          deleted_at = EXCLUDED.deleted_at,
          updated_at = EXCLUDED.updated_at
        WHERE EXCLUDED.updated_at > assets.updated_at OR assets.updated_at IS NULL
      `;
    } else if (table === 'users') {
      await sql`
        INSERT INTO users (id, nombre, correo, perfil, pin, activo, data, uuid_sync, updated_at, created_at, deleted_at)
        VALUES (${operation.data?.id || operation.uuid_sync}, ${operation.data?.nombre || ''}, ${operation.data?.correo || operation.data?.email || ''}, ${operation.data?.perfil || operation.data?.rol || 'Técnico'}, ${operation.data?.pin || ''}, false, ${JSON.stringify({ uuid_sync: operation.uuid_sync, deleted_at: timestamp })}, ${operation.uuid_sync}, ${timestamp}, ${timestamp}, ${timestamp})
        ON CONFLICT (uuid_sync) DO UPDATE SET
          activo = false,
          deleted_at = EXCLUDED.deleted_at,
          updated_at = EXCLUDED.updated_at,
          data = users.data || EXCLUDED.data
        WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL
      `;
    } else {
      await sql(`
        INSERT INTO ${table} (id, data, uuid_sync, updated_at, created_at, deleted_at)
        VALUES ($1, $2::jsonb, $3, $4, $5, $6)
        ON CONFLICT (uuid_sync) DO UPDATE SET
          deleted_at = EXCLUDED.deleted_at,
          updated_at = EXCLUDED.updated_at,
          data = ${table}.data || EXCLUDED.data
        WHERE EXCLUDED.updated_at > ${table}.updated_at OR ${table}.updated_at IS NULL
      `, [operation.data?.id || operation.uuid_sync, JSON.stringify({ uuid_sync: operation.uuid_sync, deleted_at: timestamp }), operation.uuid_sync, timestamp, timestamp, timestamp]);
    }

    return { ...base, table, status: 'applied' };
  } catch (error: any) {
    return { ...base, table, status: 'error', error: error.message };
  }
}

async function upsertAsset(sql: any, operation: any, allowExistingOnly: boolean) {
  const data = operation.data || {};
  const updatedAt = Number(operation.updated_at || data.updated_at || Date.now());
  if (allowExistingOnly) {
    const existing = await sql`SELECT uuid_sync FROM assets WHERE uuid_sync = ${operation.uuid_sync} LIMIT 1`;
    if (existing.length === 0) {
      // Offline-first: an update can arrive before the insert on flaky networks, so promote it to an idempotent upsert.
      await upsertAsset(sql, operation, false);
      return;
    }
  }

  await sql`
    INSERT INTO assets (
      tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad,
      voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado,
      ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, tecnicos, notas,
      uuid_sync, updated_at, created_at, deleted_at, cliente_id, sucursal_id, lat, lng
    ) VALUES (
      ${data.tag || operation.uuid_sync}, ${data.nombre || ''}, ${data.tipo || ''}, ${data.marca || ''}, ${data.modelo || ''},
      ${data.serie || ''}, ${data.ubicacion || ''}, ${data.area || ''}, ${data.capacidad || ''},
      ${data.voltaje || ''}, ${data.corriente || ''}, ${data.refrigerante || ''}, ${data.fecha_instalacion || ''},
      ${Number(data.vida_util || 0)}, ${data.estado || 'operativo'}, ${data.ultimo_mantenimiento || null},
      ${data.proximo_mantenimiento || null}, ${Number(data.horas_operacion || 0)}, ${JSON.stringify(data.tecnicos || [])}, ${data.notas || ''},
      ${operation.uuid_sync}, ${updatedAt}, ${Number(data.created_at || updatedAt)}, ${data.deleted_at || null}, ${data.cliente_id || ''}, ${data.sucursal_id || ''}, ${data.lat ?? null}, ${data.lng ?? null}
    ) ON CONFLICT (uuid_sync) DO UPDATE SET
      tag = EXCLUDED.tag,
      nombre = EXCLUDED.nombre,
      tipo = EXCLUDED.tipo,
      marca = EXCLUDED.marca,
      modelo = EXCLUDED.modelo,
      serie = EXCLUDED.serie,
      ubicacion = EXCLUDED.ubicacion,
      area = EXCLUDED.area,
      capacidad = EXCLUDED.capacidad,
      voltaje = EXCLUDED.voltaje,
      corriente = EXCLUDED.corriente,
      refrigerante = EXCLUDED.refrigerante,
      fecha_instalacion = EXCLUDED.fecha_instalacion,
      vida_util = EXCLUDED.vida_util,
      estado = EXCLUDED.estado,
      ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento,
      proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
      horas_operacion = EXCLUDED.horas_operacion,
      tecnicos = EXCLUDED.tecnicos,
      notas = EXCLUDED.notas,
      cliente_id = EXCLUDED.cliente_id,
      sucursal_id = EXCLUDED.sucursal_id,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      deleted_at = EXCLUDED.deleted_at,
      updated_at = EXCLUDED.updated_at
    WHERE EXCLUDED.updated_at > assets.updated_at OR assets.updated_at IS NULL
  `;
}


async function upsertUser(sql: any, operation: any) {
  const data = operation.data || {};
  const updatedAt = Number(operation.updated_at || data.updated_at || Date.now());
  await sql`
    INSERT INTO users (id, nombre, correo, perfil, pin, activo, data, uuid_sync, updated_at, created_at, deleted_at)
    VALUES (
      ${data.id || operation.uuid_sync}, ${data.nombre || ''}, ${data.correo || data.email || ''},
      ${data.perfil || data.rol || 'Técnico'}, ${data.pin || ''}, ${data.activo !== false},
      ${JSON.stringify(data)}, ${operation.uuid_sync}, ${updatedAt}, ${Number(data.created_at || updatedAt)}, ${data.deleted_at || null}
    ) ON CONFLICT (uuid_sync) DO UPDATE SET
      id = EXCLUDED.id,
      nombre = EXCLUDED.nombre,
      correo = EXCLUDED.correo,
      perfil = EXCLUDED.perfil,
      pin = EXCLUDED.pin,
      activo = EXCLUDED.activo,
      data = EXCLUDED.data,
      deleted_at = EXCLUDED.deleted_at,
      updated_at = EXCLUDED.updated_at
    WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL
  `;
}

async function upsertGeneric(sql: any, table: Exclude<SyncTable, 'assets'>, operation: any) {
  const data = operation.data || {};
  const updatedAt = Number(operation.updated_at || data.updated_at || Date.now());
  await sql(`
    INSERT INTO ${table} (id, data, uuid_sync, updated_at, created_at, deleted_at)
    VALUES ($1, $2::jsonb, $3, $4, $5, $6)
    ON CONFLICT (uuid_sync) DO UPDATE SET
      id = EXCLUDED.id,
      data = EXCLUDED.data,
      deleted_at = EXCLUDED.deleted_at,
      updated_at = EXCLUDED.updated_at
    WHERE EXCLUDED.updated_at > ${table}.updated_at OR ${table}.updated_at IS NULL
  `, [data.id || operation.uuid_sync, JSON.stringify(data), operation.uuid_sync, updatedAt, Number(data.created_at || updatedAt), data.deleted_at || null]);
}

function baseResult(operation: any, operationName: OperationName, table?: string | null): Omit<SyncOperationResult, 'status'> {
  return {
    queue_id: operation?.id,
    uuid_sync: operation?.uuid_sync,
    table: table || operation?.table,
    operation: operationName
  };
}
