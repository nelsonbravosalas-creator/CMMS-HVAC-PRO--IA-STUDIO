// CMMS HVAC PRO — sync API
// Consolida: api/sync/push.ts + api/sync/pull.ts + api/sync/[table].ts + api/sync/status.ts
// Vercel function: /api/sync
// Tablas Neon: assets, users, preventive_maintenance, work_orders, clientes, sucursal, reports, events, catalog_asset_types, settings, ordenes_servicio, inventory, calendar, audit_logs

import { getDb } from '../db.js';
import { canWrite, canWriteResource, requireAuth } from '../auth.js';

const ALLOWED_TABLES = [
  'assets',
  'users',
  'preventive_maintenance',
  'work_orders',
  'clientes',
  'sucursales',
  'reports',
  'events',
  'catalog_asset_types',
  'settings',
  'ordenes_servicio',
  'inventory',
  'calendar',
  'audit_logs'
];

const SYNC_WRITABLE_TABLES = new Set([
  'assets',
  'preventive_maintenance',
  'work_orders',
  'reports',
  'events',
  'catalog_asset_types',
  'ordenes_servicio',
  'inventory',
  'calendar'
]);

function sanitizeRows(table: string, rows: any[]) {
  if (table !== 'users') return rows;
  return rows.map((row) => {
    const { pin, pin_hash, ...safeRow } = row;
    if (safeRow.data && typeof safeRow.data === 'object') {
      const { pin: _pin, ...safeData } = safeRow.data;
      safeRow.data = safeData;
    }
    return safeRow;
  });
}

function isAdminUser(user: any) {
  const role = String(user?.perfil || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return role.includes('admin');
}

function getTenantId(authUser: any, req: any, res: any) {
  const requestedTenantId =
    req.headers?.['x-client-id']
    || req.headers?.['x-cliente-id']
    || req.query?.cliente_id
    || req.query?.clienteId
    || req.body?.cliente_id;

  if (isAdminUser(authUser)) {
    return requestedTenantId || '__GLOBAL__';
  }

  const allowedTenantIds = Array.isArray(authUser?.cliente_ids) ? authUser.cliente_ids : [];
  const tenantId = requestedTenantId || authUser?.cliente_id || allowedTenantIds[0];
  if (!tenantId) {
    res.status(403).json({ success: false, error: 'Tenant no asociado al token de sesión' });
    return null;
  }
  if (tenantId !== authUser?.cliente_id && !allowedTenantIds.includes(tenantId)) {
    res.status(403).json({ success: false, error: 'Tenant no autorizado para el usuario' });
    return null;
  }
  return tenantId;
}

function assertWritableTable(
  table: string,
  authUser: any,
  operation: 'insert' | 'update' | 'delete'
) {
  if (SYNC_WRITABLE_TABLES.has(table)) {
    return canWriteResource(authUser, table, operation);
  }
  if (isAdminUser(authUser) && (table === 'clientes' || table === 'sucursales')) return true;
  if (isAdminUser(authUser) && table === 'audit_logs') return true;
  return false;
}

const TABLE_ALIAS_MAP: any = {
  'clients': 'clientes',
  'branches': 'sucursales',
  'clientes': 'clientes',
  'sucursales': 'sucursales',
  'equipos': 'assets',
  'usuarios': 'users',
  'mantenimientos': 'preventive_maintenance',
  'tickets': 'work_orders',
  'informes': 'reports',
  'eventos': 'events',
  'inventario': 'inventory',
  'ordenes_trabajo': 'work_orders',
  'mantenimiento_preventivo': 'preventive_maintenance',
  'repuestos': 'inventory'
};

function resolveTable(name: string): string | null {
  if (ALLOWED_TABLES.includes(name)) return name;
  return TABLE_ALIAS_MAP[name] || null;
}

const validateWorkOrderPayload = (data: any) => {
  if (!data) return;
  
  let target = data;
  if (data.data && typeof data.data === 'object') {
    target = data.data;
  } else if (data.data && typeof data.data === 'string') {
    try {
      target = JSON.parse(data.data);
    } catch (e) {}
  }
  
  const estado = String(target.estado || target.status || '').toLowerCase();
  if (['cerrado', 'cerrada', 'firmado', 'firmada'].includes(estado)) {
    const checklist = target.checklist || target.checklists || target.checklist_items;
    const hasChecklist = Array.isArray(checklist) && checklist.length > 0;
    
    const signature =
      target.firma
      || target.firma_conformidad_base64
      || (target.firmas && (target.firmas.tecnico || target.firmas.cliente))
      || (target.signatures && target.signatures.technician)
      || (target.payload && target.payload.firma_conformidad_base64)
      || (target.data && target.data.firma_conformidad_base64)
      || (target.data && target.data.firmas && target.data.firmas.tecnico);
    
    const hasSignature = signature && String(signature).trim().length > 0;
    
    if (!hasSignature) {
      throw new Error("Transacción bloqueada por validación de QA: No es posible pasar a un estado de cierre ('Cerrado'/'Firmada') sin registrar la firma de conformidad (firma_conformidad_base64).");
    }
    if (!hasChecklist) {
      throw new Error("Transacción bloqueada por validación de QA: Se requiere completar y registrar los checklists de verificación técnica antes del cierre de la OT.");
    }
  }
};

export default async function handler(req: any, res: any) {
  try {
    const authUser: any = requireAuth(req, res);
    if (!authUser) return;
    if (req.method === 'POST' && !canWrite(authUser)) {
      return res.status(403).json({ success: false, error: 'No autorizado - rol insuficiente' });
    }

    const sql = getDb();
    const { method, query, body } = req;

    // GET /api/sync?status=1 -> Health check of database
    if (method === 'GET' && query.status) {
      const dbLive = await sql`SELECT NOW()`;
      return res.json({
        success: true,
        status: 'online',
        db: 'connected',
        serverTime: Date.now(),
        dbTime: dbLive[0]?.now
      });
    }

    // GET /api/sync?since=:timestamp -> Pull changes only
    if (method === 'GET' || query.since !== undefined) {
      const since = query.since ? parseInt(query.since as string, 10) : 0;
      const clienteIdSync = getTenantId(authUser, req, res);
      if (!clienteIdSync) return;
      const globalScope = isAdminUser(authUser) && clienteIdSync === '__GLOBAL__';
      const serverChanges: any = {};

      const pullPromises = ALLOWED_TABLES.map(async (table) => {
        try {
          let rows: any[] = [];
          switch (table) {
            case 'assets': rows = globalScope ? await sql`SELECT * FROM assets WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT * FROM assets WHERE cliente_id = ${clienteIdSync} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`; break;
            case 'users': rows = globalScope ? await sql`SELECT * FROM users WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT DISTINCT u.* FROM users u JOIN user_clientes uc ON uc.user_id = u.uuid_sync WHERE uc.cliente_id = ${clienteIdSync} AND (u.updated_at > ${since} OR u.updated_at IS NULL) ORDER BY u.updated_at ASC LIMIT 1000`; break;
            case 'preventive_maintenance': rows = globalScope ? await sql`SELECT * FROM preventive_maintenance WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT * FROM preventive_maintenance WHERE cliente_id = ${clienteIdSync} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`; break;
            case 'work_orders': rows = globalScope ? await sql`SELECT * FROM work_orders WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT * FROM work_orders WHERE cliente_id = ${clienteIdSync} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`; break;
            case 'reports': rows = globalScope ? await sql`SELECT * FROM reports WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT * FROM reports WHERE cliente_id = ${clienteIdSync} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`; break;
            case 'events': rows = globalScope ? await sql`SELECT * FROM events WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT * FROM events WHERE cliente_id = ${clienteIdSync} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`; break;
            case 'clientes':
              rows = globalScope
                ? await sql`SELECT * FROM clientes WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`
                : await sql`SELECT * FROM clientes WHERE (id = ${clienteIdSync} OR uuid_sync = ${clienteIdSync} OR id = 'cliente-default-001') AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`;
              break;
            case 'sucursales':
              rows = globalScope
                ? await sql`SELECT * FROM sucursales WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`
                : await sql`SELECT * FROM sucursales WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`;
              break;
            case 'catalog_asset_types': rows = globalScope ? await sql`SELECT * FROM catalog_asset_types WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT * FROM catalog_asset_types WHERE cliente_id = ${clienteIdSync} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`; break;
            case 'settings': rows = globalScope ? await sql`SELECT * FROM settings WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT * FROM settings WHERE cliente_id = ${clienteIdSync} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`; break;
            case 'ordenes_servicio': rows = globalScope ? await sql`SELECT * FROM ordenes_servicio WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT * FROM ordenes_servicio WHERE cliente_id = ${clienteIdSync} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`; break;
            case 'inventory': rows = globalScope ? await sql`SELECT * FROM inventory WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT * FROM inventory WHERE cliente_id = ${clienteIdSync} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`; break;
            case 'calendar': rows = globalScope ? await sql`SELECT * FROM calendar WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000` : await sql`SELECT * FROM calendar WHERE cliente_id = ${clienteIdSync} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 1000`; break;
            case 'audit_logs': rows = await sql`SELECT * FROM audit_logs WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (timestamp > ${since}) ORDER BY timestamp ASC LIMIT 1000`; break;
          }
          if (rows && rows.length > 0) {
            serverChanges[table] = sanitizeRows(table, rows);
          }
        } catch (e) {
          console.error(`Error pulling ${table}:`, e);
        }
      });

      await Promise.all(pullPromises);
      return res.json({
        success: true,
        serverChanges,
        serverTime: Date.now()
      });
    }

    if (method === 'POST') {
      const { inserts = [], updates = [], deletes = [], lastSync = 0 } = body;
      const results: any = { inserts: [], updates: [], deletes: [] };

      const clienteIdSync = getTenantId(authUser, req, res);
      if (!clienteIdSync) return;

      // 1. Process inserts in parallel
      const insertPromises = inserts.map(async (ins: any) => {
        const rawTable = ins.table;
        const table = resolveTable(rawTable);
        if (!table) return null;
        if (!assertWritableTable(table, authUser, 'insert')) {
          return { uuid_sync: ins.uuid_sync || ins.id, table, result: 'forbidden', error: `Tabla no permitida para sincronización: ${table}` };
        }

        const data = ins.data || {};
        const uuid_sync = ins.uuid_sync || data.uuid_sync || ins.id;
        const updated_at = ins.updated_at || data.updated_at || ins.timestamp || Date.now();

        const recordClienteId = isAdminUser(authUser) && data?.cliente_id ? data.cliente_id : clienteIdSync;

        if (typeof data === 'object' && table !== 'clientes' && table !== 'sucursales') {
          data.cliente_id = recordClienteId;
        }

        let status = 'applied';
        let errorMsg = '';

        try {
          if (table === 'work_orders') {
            validateWorkOrderPayload(data);
          }
          if (table === 'assets') {
            const d = data;
            let final_cliente_id = recordClienteId;
            let final_sucursal_id = d.sucursal_id || 'default-sucursal';

            const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
            if (!clientExists || clientExists.length === 0) {
              final_cliente_id = 'cliente-default-001';
            }

            const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
            if (!branchExists || branchExists.length === 0) {
              final_sucursal_id = 'default-sucursal';
            }

            await sql`
              INSERT INTO assets (
                tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, 
                voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, 
                ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, notas,
                uuid_sync, updated_at, created_at, cliente_id, sucursal_id
              ) VALUES (
                ${d.tag}, ${d.nombre}, ${d.tipo || ''}, ${d.marca || ''}, ${d.modelo || ''}, 
                ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''}, ${d.capacidad || ''}, 
                ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''}, ${d.fecha_instalacion || ''}, 
                ${d.vida_util || 0}, ${d.estado || 'operativo'}, ${d.ultimo_mantenimiento || null}, 
                ${d.proximo_mantenimiento || null}, ${d.horas_operacion || 0}, ${d.notas || ''},
                ${uuid_sync}, ${updated_at}, ${updated_at}, ${final_cliente_id}, ${final_sucursal_id}
              ) ON CONFLICT (uuid_sync) DO UPDATE SET
                tag = EXCLUDED.tag, nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca, modelo = EXCLUDED.modelo,
                serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion, area = EXCLUDED.area, capacidad = EXCLUDED.capacidad,
                voltaje = EXCLUDED.voltaje, corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
                fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util, estado = EXCLUDED.estado,
                ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento, proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
                horas_operacion = EXCLUDED.horas_operacion, notas = EXCLUDED.notas, cliente_id = EXCLUDED.cliente_id, sucursal_id = EXCLUDED.sucursal_id,
                updated_at = EXCLUDED.updated_at
              WHERE assets.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > assets.updated_at OR assets.updated_at IS NULL);
            `;
          } else {
            const id = data.id || uuid_sync;
            const strData = JSON.stringify(data);

            switch (table) {
              case 'preventive_maintenance': await sql`INSERT INTO preventive_maintenance (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${recordClienteId}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE preventive_maintenance.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > preventive_maintenance.updated_at OR preventive_maintenance.updated_at IS NULL)`; break;
              case 'work_orders': await sql`INSERT INTO work_orders (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${recordClienteId}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE work_orders.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > work_orders.updated_at OR work_orders.updated_at IS NULL)`; break;
              case 'reports': await sql`INSERT INTO reports (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${recordClienteId}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE reports.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > reports.updated_at OR reports.updated_at IS NULL)`; break;
              case 'events': await sql`INSERT INTO events (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${recordClienteId}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE events.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > events.updated_at OR events.updated_at IS NULL)`; break;
              case 'calendar': await sql`INSERT INTO calendar (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${recordClienteId}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE calendar.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > calendar.updated_at OR calendar.updated_at IS NULL)`; break;
              case 'catalog_asset_types': await sql`INSERT INTO catalog_asset_types (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${recordClienteId}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE catalog_asset_types.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > catalog_asset_types.updated_at OR catalog_asset_types.updated_at IS NULL)`; break;
              case 'settings': await sql`INSERT INTO settings (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${recordClienteId}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE settings.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > settings.updated_at OR settings.updated_at IS NULL)`; break;
              case 'ordenes_servicio': await sql`INSERT INTO ordenes_servicio (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${recordClienteId}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE ordenes_servicio.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > ordenes_servicio.updated_at OR ordenes_servicio.updated_at IS NULL)`; break;
              case 'inventory': await sql`INSERT INTO inventory (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${recordClienteId}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE inventory.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > inventory.updated_at OR inventory.updated_at IS NULL)`; break;
              case 'clientes': {
                // El id funcional del cliente es la FK usada por sucursales y
                // activos; uuid_sync solo identifica el registro offline.
                const clientRowId = data.id || uuid_sync;
                await sql`
                  INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at)
                  VALUES (${clientRowId}, ${uuid_sync}, ${strData}, ${updated_at}, ${updated_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at
                  WHERE EXCLUDED.updated_at > clientes.updated_at OR clientes.updated_at IS NULL
                `;
                break;
              }
              case 'sucursales': {
                const branchClienteId = data.cliente_id;
                if (!branchClienteId) throw new Error('cliente_id requerido para sincronizar sucursal');
                const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${branchClienteId} OR uuid_sync = ${branchClienteId}`;
                if (!clientExists || clientExists.length === 0) throw new Error(`Cliente ${branchClienteId} no existe para sincronizar sucursal`);
                await sql`INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at) VALUES (${id}, ${branchClienteId}, ${uuid_sync}, ${strData}, ${updated_at}, ${updated_at}) ON CONFLICT (id) DO UPDATE SET cliente_id = EXCLUDED.cliente_id, uuid_sync = EXCLUDED.uuid_sync, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE sucursales.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > sucursales.updated_at OR sucursales.updated_at IS NULL)`;
                break;
              }
              case 'audit_logs':
                await sql`
                  INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id) 
                  VALUES (${id}, ${data.action}, ${data.entity_type}, ${data.entity_id}, ${data.user_id}, ${strData}, ${data.timestamp}, ${clienteIdSync}) 
                  ON CONFLICT (id) DO NOTHING
                `;
                break;
            }
          }
        } catch (err: any) {
          status = err.message?.toLowerCase().includes('unique') ? 'conflict' : 'error';
          errorMsg = 'No fue posible sincronizar el registro';
        }
        return { uuid_sync, table, result: status, error: errorMsg, folio_oficial: data.tag || data.id };
      });

      const resInserts = await Promise.all(insertPromises);
      results.inserts = resInserts.filter(Boolean);

      // 2. Process updates in parallel
      const updatePromises = updates.map(async (upd: any) => {
        const rawTable = upd.table;
        const table = resolveTable(rawTable);
        if (!table) return null;
        if (!assertWritableTable(table, authUser, 'update')) {
          return { uuid_sync: upd.uuid_sync, table, result: 'forbidden', error: `Tabla no permitida para sincronización: ${table}` };
        }

        const data = upd.data || {};
        const uuid_sync = upd.uuid_sync || data.uuid_sync;
        const updated_at = upd.updated_at || data.updated_at || upd.timestamp || Date.now();

        const recordClienteId = isAdminUser(authUser) && data?.cliente_id ? data.cliente_id : clienteIdSync;

        if (typeof data === 'object' && table !== 'clientes' && table !== 'sucursales') {
          data.cliente_id = recordClienteId;
        }

        let status = 'applied';
        let errorMsg = '';

        try {
          if (table === 'work_orders') {
            validateWorkOrderPayload(data);
          }
          if (table === 'assets') {
            const d = data;
            let final_cliente_id = recordClienteId;
            let final_sucursal_id = d.sucursal_id || 'default-sucursal';

            const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
            if (!clientExists || clientExists.length === 0) {
              final_cliente_id = 'cliente-default-001';
            }

            const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
            if (!branchExists || branchExists.length === 0) {
              final_sucursal_id = 'default-sucursal';
            }

            await sql`
              UPDATE assets SET
                tag = ${d.tag}, nombre = ${d.nombre}, tipo = ${d.tipo || ''}, marca = ${d.marca || ''}, modelo = ${d.modelo || ''},
                serie = ${d.serie || ''}, ubicacion = ${d.ubicacion || ''}, area = ${d.area || ''}, capacidad = ${d.capacidad || ''},
                voltaje = ${d.voltaje || ''}, corriente = ${d.corriente || ''}, refrigerante = ${d.refrigerante || ''},
                fecha_instalacion = ${d.fecha_instalacion || ''}, vida_util = ${d.vida_util || 0}, estado = ${d.estado || 'operativo'},
                ultimo_mantenimiento = ${d.ultimo_mantenimiento || null}, proximo_mantenimiento = ${d.proximo_mantenimiento || null},
                horas_operacion = ${d.horas_operacion || 0}, notas = ${d.notas || ''},
                cliente_id = ${final_cliente_id}, sucursal_id = ${final_sucursal_id},
                updated_at = ${updated_at}
              WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${clienteIdSync} AND (updated_at < ${updated_at} OR updated_at IS NULL);
            `;
          } else {
            const id = data.id || uuid_sync;
            const strData = JSON.stringify(data);
            switch (table) {
              case 'preventive_maintenance': await sql`UPDATE preventive_maintenance SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${recordClienteId} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${recordClienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'work_orders': await sql`UPDATE work_orders SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${recordClienteId} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${recordClienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'reports': await sql`UPDATE reports SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${recordClienteId} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${recordClienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'events': await sql`UPDATE events SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${recordClienteId} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${recordClienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'calendar': await sql`UPDATE calendar SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${recordClienteId} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${recordClienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'catalog_asset_types': await sql`UPDATE catalog_asset_types SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${recordClienteId} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${recordClienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'settings': await sql`UPDATE settings SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${recordClienteId} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${recordClienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'ordenes_servicio': await sql`UPDATE ordenes_servicio SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${recordClienteId} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${recordClienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'inventory': await sql`UPDATE inventory SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${recordClienteId} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${recordClienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'clientes': await sql`UPDATE clientes SET data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'sucursales': {
                const branchClienteId = data.cliente_id;
                if (!branchClienteId) throw new Error('cliente_id requerido para sincronizar sucursal');
                await sql`UPDATE sucursales SET id = ${id}, cliente_id = ${branchClienteId}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`;
                break;
              }
            }
          }
        } catch (err: any) {
          status = err.message?.toLowerCase().includes('unique') ? 'conflict' : 'error';
          errorMsg = 'No fue posible sincronizar el registro';
        }
        return { uuid_sync, table, result: status, error: errorMsg };
      });

      const resUpdates = await Promise.all(updatePromises);
      results.updates = resUpdates.filter(Boolean);

      // 3. Process deletes in parallel
      const serverTimeForDelete = Date.now();
      const deletePromises = deletes.map(async (del: any) => {
        const rawTable = del.table;
        const table = resolveTable(rawTable);
        if (!table) return null;
        if (!assertWritableTable(table, authUser, 'delete')) {
          return { uuid_sync: del.uuid_sync, table, result: 'forbidden', error: `Tabla no permitida para sincronización: ${table}` };
        }

        const ts = serverTimeForDelete;
        let status = 'applied';
        let errorMsg = '';
        try {
          switch (table) {
            case 'assets':
              if (isAdminUser(authUser)) {
                // Los administradores pueden sanear activos heredados cuyo
                // cliente_id o uuid_sync fue creado antes del modelo actual.
                const legacyId = del.data?.id || '';
                const legacyTag = del.data?.tag || '';
                await sql`
                  UPDATE assets
                  SET deleted_at = ${ts}, estado = 'baja', updated_at = ${ts}
                  WHERE uuid_sync = ${del.uuid_sync}
                    OR (${legacyId} <> '' AND id = ${legacyId})
                    OR (${legacyTag} <> '' AND tag = ${legacyTag})
                `;
              } else {
                await sql`UPDATE assets SET deleted_at = ${ts}, estado = 'baja', updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync} AND cliente_id = ${clienteIdSync}`;
              }
              break;
            case 'preventive_maintenance': await sql`UPDATE preventive_maintenance SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync} AND cliente_id = ${clienteIdSync}`; break;
            case 'work_orders': await sql`UPDATE work_orders SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync} AND cliente_id = ${clienteIdSync}`; break;
            case 'reports': await sql`UPDATE reports SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync} AND cliente_id = ${clienteIdSync}`; break;
            case 'events': await sql`UPDATE events SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync} AND cliente_id = ${clienteIdSync}`; break;
            case 'calendar': await sql`UPDATE calendar SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync} AND cliente_id = ${clienteIdSync}`; break;
            case 'catalog_asset_types': await sql`UPDATE catalog_asset_types SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync} AND cliente_id = ${clienteIdSync}`; break;
            case 'settings': await sql`UPDATE settings SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync} AND cliente_id = ${clienteIdSync}`; break;
            case 'ordenes_servicio': await sql`UPDATE ordenes_servicio SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync} AND cliente_id = ${clienteIdSync}`; break;
            case 'inventory': await sql`UPDATE inventory SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync} AND cliente_id = ${clienteIdSync}`; break;
            case 'clientes': await sql`UPDATE clientes SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'sucursales': await sql`UPDATE sucursales SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
          }
        } catch (err: any) {
          status = 'error';
          errorMsg = err.message;
        }
        return { uuid_sync: del.uuid_sync, table, result: status, error: errorMsg };
      });

      const resDeletes = await Promise.all(deletePromises);
      results.deletes = resDeletes.filter(Boolean);

      // Las escrituras se confirman sin ejecutar además un pull masivo en la
      // misma invocación. El cliente hará el pull incremental por GET en el
      // siguiente ciclo, evitando timeouts de funciones Hobby.
      if (body.skipPull === true) {
        return res.json({
          success: true,
          results,
          serverChanges: {},
          serverTime: Date.now()
        });
      }

      // 4. Combined Pull changes (from lastSync timestamp)
      const serverChanges: any = {};
      const pullPromises = ALLOWED_TABLES.map(async (table) => {
        try {
          let rows: any[] = [];
          switch (table) {
            case 'assets': rows = await sql`SELECT * FROM assets WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'users': rows = await sql`SELECT * FROM users WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'preventive_maintenance': rows = await sql`SELECT * FROM preventive_maintenance WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'work_orders': rows = await sql`SELECT * FROM work_orders WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'reports': rows = await sql`SELECT * FROM reports WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'events': rows = await sql`SELECT * FROM events WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'clientes':
              rows = isAdminUser(authUser)
                ? await sql`SELECT * FROM clientes WHERE (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`
                : await sql`SELECT * FROM clientes WHERE (id = ${clienteIdSync} OR uuid_sync = ${clienteIdSync} OR id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`;
              break;
            case 'sucursales':
              rows = isAdminUser(authUser)
                ? await sql`SELECT * FROM sucursales WHERE (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`
                : await sql`SELECT * FROM sucursales WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`;
              break;
            case 'catalog_asset_types': rows = await sql`SELECT * FROM catalog_asset_types WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'settings': rows = await sql`SELECT * FROM settings WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'ordenes_servicio': rows = await sql`SELECT * FROM ordenes_servicio WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'inventory': rows = await sql`SELECT * FROM inventory WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'calendar': rows = await sql`SELECT * FROM calendar WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
            case 'audit_logs': rows = await sql`SELECT * FROM audit_logs WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (timestamp > ${lastSync}) LIMIT 200`; break;
          }
            if (rows && rows.length > 0) {
            serverChanges[table] = sanitizeRows(table, rows);
          }
        } catch (e) {
          console.error(`Error pulling ${table}:`, e);
        }
      });

      await Promise.all(pullPromises);
      return res.json({ success: true, results, serverChanges, serverTime: Date.now() });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Unified Sync error:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
