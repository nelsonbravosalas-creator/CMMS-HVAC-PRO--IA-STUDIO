// CMMS HVAC PRO — sync API
// Consolida: api/sync/push.ts + api/sync/pull.ts + api/sync/[table].ts + api/sync/status.ts
// Vercel function: /api/sync
// Tablas Neon: assets, users, preventive_maintenance, work_orders, clientes, sucursal, reports, events, catalog_asset_types, settings, ordenes_servicio, inventory, calendar, audit_logs

import { getDb } from './_db.js';
import { verifyToken } from './_auth.js';

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
    const sql = getDb();
    const { method, query, body } = req;

    // GET /api/sync?status=1 -> Health check (unprotected)
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

    // JWT Verification
    const decoded = verifyToken(req) as any;
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
    }
    const clienteIdSync = decoded.clienteId || decoded.cliente_id || 'cliente-default-001';

    // GET /api/sync?debug=1 -> Diagnostic snapshot (protected)
    if (method === 'GET' && query.debug) {
      const counts: any = {};
      for (const t of ALLOWED_TABLES) {
        try {
          const r = await sql`SELECT COUNT(*)::int as n FROM ${sql(t)}`;
          counts[t] = r[0]?.n ?? 0;
        } catch (e: any) {
          counts[t] = `ERROR: ${e.message}`;
        }
      }
      const clientes = await sql`SELECT id, uuid_sync, updated_at, deleted_at FROM clientes LIMIT 20`;
      const sucursales = await sql`SELECT id, cliente_id, uuid_sync, updated_at FROM sucursales LIMIT 20`;
      return res.json({ success: true, counts, clientes, sucursales, serverTime: Date.now() });
    }

    // GET /api/sync?seqs={"assets":123,...} -> Pull changes only (seqs = cursores server_seq por tabla)
    if (method === 'GET' || query.seqs !== undefined || query.since !== undefined) {
      const seqs: Record<string, number> = {};
      if (query.seqs) {
        try { Object.assign(seqs, JSON.parse(query.seqs as string)); } catch(e) {}
      }
      const serverChanges: any = {};

      const pullPromises = ALLOWED_TABLES.map(async (table) => {
        const seq = seqs[table] || 0;
        try {
          let rows: any[] = [];
          // NOTE: deleted_at IS NULL filter intentionally REMOVED — tombstones must reach clients
          switch (table) {
            case 'assets': rows = await sql`SELECT * FROM assets WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'users': rows = await sql`SELECT * FROM users WHERE (cliente_id = ${clienteIdSync} OR cliente_id IS NULL) AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'preventive_maintenance': rows = await sql`SELECT * FROM preventive_maintenance WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'work_orders': rows = await sql`SELECT * FROM work_orders WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'reports': rows = await sql`SELECT * FROM reports WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'events': rows = await sql`SELECT * FROM events WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'clientes': rows = await sql`SELECT * FROM clientes WHERE (id = ${clienteIdSync} OR uuid_sync = ${clienteIdSync}) AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'sucursales': rows = await sql`SELECT * FROM sucursales WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'catalog_asset_types': rows = await sql`SELECT * FROM catalog_asset_types WHERE (cliente_id = ${clienteIdSync} OR cliente_id IS NULL) AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'settings': rows = await sql`SELECT * FROM settings WHERE (cliente_id = ${clienteIdSync} OR cliente_id IS NULL) AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'ordenes_servicio': rows = await sql`SELECT * FROM ordenes_servicio WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'inventory': rows = await sql`SELECT * FROM inventory WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'calendar': rows = await sql`SELECT * FROM calendar WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'audit_logs': rows = await sql`SELECT * FROM audit_logs WHERE (cliente_id = ${clienteIdSync} OR cliente_id IS NULL) AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
          }
          if (rows && rows.length > 0) {
            serverChanges[table] = rows;
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
      const { inserts = [], updates = [], deletes = [], seqs = {} } = body;
      const results: any = { inserts: [], updates: [], deletes: [] };

      // Process inserts in parallel
      const insertPromises = inserts.map(async (ins: any) => {
        const rawTable = ins.table;
        const table = resolveTable(rawTable);
        if (!table) return null;

        const data = ins.data || {};
        const uuid_sync = ins.uuid_sync || data.uuid_sync || ins.id;
        const updated_at = ins.updated_at || data.updated_at || ins.timestamp || Date.now();

        if (typeof data === 'object') {
          if (!data.cliente_id) data.cliente_id = clienteIdSync;
        }

        let status = 'applied';
        let errorMsg = '';

        try {
          if (table === 'work_orders') {
            validateWorkOrderPayload(data);
          }

          const strData = JSON.stringify(data);

          switch (table) {
            case 'assets': {
              const d = data;
              let final_cliente_id = d.cliente_id || d.clienteId || clienteIdSync || 'cliente-default-001';
              let final_sucursal_id = d.sucursal_id || d.sucursalId || 'default-sucursal';

              const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
              if (!clientExists || clientExists.length === 0) {
                // Fallback: accept legacy ID if it exists in DB, otherwise use canonical default
                const legacyExists = await sql`SELECT 1 FROM clientes WHERE id = 'cliente-eecol-default-001'`;
                final_cliente_id = (legacyExists && legacyExists.length > 0)
                  ? 'cliente-eecol-default-001'
                  : 'cliente-default-001';
              }

              const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
              if (!branchExists || branchExists.length === 0) final_sucursal_id = 'default-sucursal';

              const lat = d.latitud !== undefined ? parseFloat(d.latitud) : (d.lat !== undefined ? parseFloat(d.lat) : null);
              const lng = d.longitud !== undefined ? parseFloat(d.longitud) : (d.lng !== undefined ? parseFloat(d.lng) : null);

              await sql`
                INSERT INTO assets (
                  uuid_sync, tag, nombre, tipo, marca, modelo, serie, ubicacion, area,
                  capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util,
                  estado, ultimo_mantenimiento, proximo_mantenimiento, frecuencia_mantenimiento,
                  horas_operacion, tecnicos, notas, cliente_id, sucursal_id, latitud, longitud,
                  updated_at, created_at
                ) VALUES (
                  ${uuid_sync}, ${d.tag}, ${d.nombre}, ${d.tipo || ''}, ${d.marca || ''}, ${d.modelo || ''},
                  ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''}, ${d.capacidad || ''},
                  ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''}, ${d.fecha_instalacion || ''},
                  ${d.vida_util !== undefined ? parseInt(d.vida_util, 10) : 10}, ${d.estado || 'operativo'},
                  ${d.ultimo_mantenimiento || null}, ${d.proximo_mantenimiento || null}, ${d.frecuencia_mantenimiento || ''},
                  ${d.horas_operacion !== undefined ? parseInt(d.horas_operacion, 10) : 0}, ${JSON.stringify(d.tecnicos || [])}::jsonb, ${d.notas || ''},
                  ${final_cliente_id}, ${final_sucursal_id}, ${lat}, ${lng},
                  ${updated_at}, ${updated_at}
                ) ON CONFLICT (uuid_sync) DO UPDATE SET
                  tag = EXCLUDED.tag, nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca, modelo = EXCLUDED.modelo,
                  serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion, area = EXCLUDED.area, capacidad = EXCLUDED.capacidad,
                  voltaje = EXCLUDED.voltaje, corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
                  fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util, estado = EXCLUDED.estado,
                  ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento, proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
                  frecuencia_mantenimiento = EXCLUDED.frecuencia_mantenimiento, horas_operacion = EXCLUDED.horas_operacion,
                  tecnicos = EXCLUDED.tecnicos, notas = EXCLUDED.notas, cliente_id = EXCLUDED.cliente_id, sucursal_id = EXCLUDED.sucursal_id,
                  latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud, updated_at = EXCLUDED.updated_at
                WHERE EXCLUDED.updated_at > assets.updated_at OR assets.updated_at IS NULL;
              `;
              break;
            }
            case 'work_orders': {
              const otId = data.id || uuid_sync;
              await sql`
                INSERT INTO work_orders (
                  uuid_sync, id, titulo, descripcion, prioridad, estado, equipo_tag, 
                  cliente_id, creado_por, asignado_a, fecha_creacion, data, updated_at, created_at
                )
                VALUES (
                  ${uuid_sync}, ${otId},
                  ${data.titulo || ''}, ${data.descripcion || ''},
                  ${data.prioridad || 'media'}, ${data.estado || 'abierto'},
                  ${data.equipo_tag || data.equipoTag || ''},
                  ${data.cliente_id || clienteIdSync},
                  ${data.creado_por || data.creadoPor || ''},
                  ${data.asignado_a || data.asignadoA || ''},
                  ${data.fecha_creacion || data.fechaCreacion || ''},
                  ${strData}::jsonb, ${updated_at}, ${updated_at}
                )
                ON CONFLICT (uuid_sync) DO UPDATE SET
                  id = EXCLUDED.id,
                  titulo = EXCLUDED.titulo,
                  descripcion = EXCLUDED.descripcion,
                  prioridad = EXCLUDED.prioridad,
                  estado = EXCLUDED.estado,
                  equipo_tag = EXCLUDED.equipo_tag,
                  cliente_id = EXCLUDED.cliente_id,
                  creado_por = EXCLUDED.creado_por,
                  asignado_a = EXCLUDED.asignado_a,
                  fecha_creacion = EXCLUDED.fecha_creacion,
                  data = EXCLUDED.data,
                  updated_at = EXCLUDED.updated_at
                WHERE EXCLUDED.updated_at > work_orders.updated_at OR work_orders.updated_at IS NULL;
              `;
              break;
            }
            case 'preventive_maintenance': {
              const mntId = data.id || uuid_sync;
              await sql`
                INSERT INTO preventive_maintenance (
                  uuid_sync, id, equipo_tag, tecnico_id, tipo, fecha, proxima_fecha, 
                  estado, hallazgos, acciones, repuestos, cliente_id, data, updated_at, created_at
                )
                VALUES (
                  ${uuid_sync}, ${mntId},
                  ${data.equipo_tag || data.equipoTag || ''},
                  ${data.tecnico_id || data.tecnicoId || ''},
                  ${data.tipo || ''},
                  ${data.fecha || ''},
                  ${data.proxima_fecha || data.proximaFecha || ''},
                  ${data.estado || 'Planificado'},
                  ${data.hallazgos || ''},
                  ${data.descripcion || data.acciones || ''},
                  ${data.repuestos || ''},
                  ${data.cliente_id || clienteIdSync},
                  ${strData}::jsonb, ${updated_at}, ${updated_at}
                )
                ON CONFLICT (uuid_sync) DO UPDATE SET
                  id = EXCLUDED.id,
                  equipo_tag = EXCLUDED.equipo_tag,
                  tecnico_id = EXCLUDED.tecnico_id,
                  tipo = EXCLUDED.tipo,
                  fecha = EXCLUDED.fecha,
                  proxima_fecha = EXCLUDED.proxima_fecha,
                  estado = EXCLUDED.estado,
                  hallazgos = EXCLUDED.hallazgos,
                  acciones = EXCLUDED.acciones,
                  repuestos = EXCLUDED.repuestos,
                  cliente_id = EXCLUDED.cliente_id,
                  data = EXCLUDED.data,
                  updated_at = EXCLUDED.updated_at
                WHERE EXCLUDED.updated_at > preventive_maintenance.updated_at OR preventive_maintenance.updated_at IS NULL;
              `;
              break;
            }
            case 'inventory': {
              const qty = Number(data.stock !== undefined ? data.stock : (data.cantidad !== undefined ? data.cantidad : 0));
              const unit = data.unidad || data.unidad_medida || '';
              const finalInvId = data.id || uuid_sync;
              await sql`
                INSERT INTO inventory (uuid_sync, id, categoria, codigo, nombre, cantidad, unidad_medida, marca, modelo, estado, cliente_id, updated_at, created_at)
                VALUES (${uuid_sync}, ${finalInvId}, ${data.categoria || ''}, ${data.codigo || ''}, ${data.nombre || ''}, ${qty}, ${unit}, ${data.marca || ''}, ${data.modelo || ''}, ${data.estado || 'disponible'}, ${data.cliente_id || clienteIdSync}, ${updated_at}, ${updated_at})
                ON CONFLICT (uuid_sync) DO UPDATE SET
                  id = EXCLUDED.id, categoria = EXCLUDED.categoria, codigo = EXCLUDED.codigo,
                  nombre = EXCLUDED.nombre, cantidad = EXCLUDED.cantidad, unidad_medida = EXCLUDED.unidad_medida,
                  marca = EXCLUDED.marca, modelo = EXCLUDED.modelo, estado = EXCLUDED.estado,
                  cliente_id = EXCLUDED.cliente_id, updated_at = EXCLUDED.updated_at
                WHERE EXCLUDED.updated_at > inventory.updated_at OR inventory.updated_at IS NULL;
              `;
              break;
            }
            case 'users': {
              const uId = data.id || uuid_sync;
              await sql`
                INSERT INTO users (uuid_sync, id, nombre, correo, perfil, pin, activo, cliente_id, updated_at, created_at)
                VALUES (${uuid_sync}, ${uId}, ${data.nombre || ''}, ${data.correo || data.email || ''}, ${data.perfil || data.rol || ''}, ${data.pin || ''}, ${data.activo !== undefined ? data.activo : true}, ${data.cliente_id || clienteIdSync}, ${updated_at}, ${updated_at})
                ON CONFLICT (uuid_sync) DO UPDATE SET
                  id = EXCLUDED.id, nombre = EXCLUDED.nombre, correo = EXCLUDED.correo,
                  perfil = EXCLUDED.perfil, activo = EXCLUDED.activo,
                  cliente_id = EXCLUDED.cliente_id, updated_at = EXCLUDED.updated_at
                WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL;
              `;
              break;
            }
            case 'clientes': {
              const cId = data.id || uuid_sync;
              await sql`
                INSERT INTO clientes (uuid_sync, id, nombre, rut, empresa, email, telefono, direccion, region, activo, contacto_nombre, contacto_correo, contacto_cargo, updated_at, created_at)
                VALUES (${uuid_sync}, ${cId}, ${data.nombre || ''}, ${data.rut || null}, ${data.empresa || ''}, ${data.email || data.correo || ''}, ${data.telefono || ''}, ${data.direccion || ''}, ${data.region || ''}, ${data.activo !== undefined ? data.activo : true}, ${data.contacto_nombre || null}, ${data.contacto_correo || null}, ${data.contacto_cargo || null}, ${updated_at}, ${updated_at})
                ON CONFLICT (uuid_sync) DO UPDATE SET
                  id = EXCLUDED.id, nombre = EXCLUDED.nombre, rut = EXCLUDED.rut,
                  empresa = EXCLUDED.empresa, email = EXCLUDED.email, telefono = EXCLUDED.telefono,
                  direccion = EXCLUDED.direccion, region = EXCLUDED.region, activo = EXCLUDED.activo,
                  contacto_nombre = EXCLUDED.contacto_nombre, contacto_correo = EXCLUDED.contacto_correo,
                  contacto_cargo = EXCLUDED.contacto_cargo, updated_at = EXCLUDED.updated_at
                WHERE EXCLUDED.updated_at > clientes.updated_at OR clientes.updated_at IS NULL;
              `;
              break;
            }
            case 'sucursales': {
              const finalSBranchId = data.id || uuid_sync;
              const c_id = data.cliente_id || clienteIdSync;
              await sql`
                INSERT INTO sucursales (uuid_sync, id, cliente_id, nombre, codigo, direccion, ciudad, region, activo, contacto_nombre, contacto_correo, contacto_cargo, updated_at, created_at)
                VALUES (${uuid_sync}, ${finalSBranchId}, ${c_id}, ${data.nombre || ''}, ${data.codigo || ''}, ${data.direccion || ''}, ${data.ciudad || ''}, ${data.region || ''}, ${data.activo !== undefined ? data.activo : true}, ${data.contacto_nombre || null}, ${data.contacto_correo || null}, ${data.contacto_cargo || null}, ${updated_at}, ${updated_at})
                ON CONFLICT (uuid_sync) DO UPDATE SET
                  id = EXCLUDED.id, cliente_id = EXCLUDED.cliente_id, nombre = EXCLUDED.nombre,
                  codigo = EXCLUDED.codigo, direccion = EXCLUDED.direccion, ciudad = EXCLUDED.ciudad,
                  region = EXCLUDED.region, activo = EXCLUDED.activo, contacto_nombre = EXCLUDED.contacto_nombre,
                  contacto_correo = EXCLUDED.contacto_correo, contacto_cargo = EXCLUDED.contacto_cargo,
                  updated_at = EXCLUDED.updated_at
                WHERE EXCLUDED.updated_at > sucursales.updated_at OR sucursales.updated_at IS NULL;
              `;
              break;
            }
            case 'reports': await sql`INSERT INTO reports (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${data.id || uuid_sync}, ${strData}::jsonb, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > reports.updated_at OR reports.updated_at IS NULL`; break;
            case 'events': await sql`INSERT INTO events (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${data.id || uuid_sync}, ${strData}::jsonb, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > events.updated_at OR events.updated_at IS NULL`; break;
            case 'calendar': await sql`INSERT INTO calendar (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${data.id || uuid_sync}, ${strData}::jsonb, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > calendar.updated_at OR calendar.updated_at IS NULL`; break;
            case 'catalog_asset_types': await sql`INSERT INTO catalog_asset_types (uuid_sync, id, cliente_id, codigo, descripcion, activo, updated_at, created_at) VALUES (${uuid_sync}, ${data.id || uuid_sync}, ${data.cliente_id || clienteIdSync}, ${data.codigo || ''}, ${data.descripcion || data.nombre || ''}, ${data.activo !== undefined ? data.activo : true}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, cliente_id = EXCLUDED.cliente_id, codigo = EXCLUDED.codigo, descripcion = EXCLUDED.descripcion, activo = EXCLUDED.activo, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > catalog_asset_types.updated_at OR catalog_asset_types.updated_at IS NULL`; break;
            case 'settings': await sql`INSERT INTO settings (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${data.id || uuid_sync}, ${strData}::jsonb, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > settings.updated_at OR settings.updated_at IS NULL`; break;
            case 'ordenes_servicio': await sql`INSERT INTO ordenes_servicio (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${data.id || uuid_sync}, ${strData}::jsonb, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > ordenes_servicio.updated_at OR ordenes_servicio.updated_at IS NULL`; break;
            case 'audit_logs':
              await sql`
                INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id) 
                VALUES (${data.id || uuid_sync}, ${data.action || ''}, ${data.entity_type || ''}, ${data.entity_id || ''}, ${data.user_id || data.userId || ''}, ${strData}::jsonb, ${data.timestamp || Date.now()}, ${clienteIdSync}) 
                ON CONFLICT (id) DO NOTHING
              `;
              break;
          }
        } catch (err: any) {
          status = err.message?.toLowerCase().includes('unique') ? 'conflict' : 'error';
          errorMsg = err.message;
        }
        return { uuid_sync, table, result: status, error: errorMsg, folio_oficial: data.tag || data.id };
      });

      const resInserts = await Promise.all(insertPromises);
      results.inserts = resInserts.filter(Boolean);

      // Process updates in parallel
      const updatePromises = updates.map(async (upd: any) => {
        const rawTable = upd.table;
        const table = resolveTable(rawTable);
        if (!table) return null;

        const data = upd.data || {};
        const uuid_sync = upd.uuid_sync || data.uuid_sync;
        const updated_at = upd.updated_at || data.updated_at || upd.timestamp || Date.now();

        if (typeof data === 'object') {
          if (!data.cliente_id) data.cliente_id = clienteIdSync;
        }

        let status = 'applied';
        let errorMsg = '';

        try {
          if (table === 'work_orders') {
            validateWorkOrderPayload(data);
          }

          const strData = JSON.stringify(data);

          switch (table) {
            case 'assets': {
              const d = data;
              let final_cliente_id = d.cliente_id || d.clienteId || clienteIdSync || 'cliente-default-001';
              let final_sucursal_id = d.sucursal_id || d.sucursalId || 'default-sucursal';

              const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
              if (!clientExists || clientExists.length === 0) {
                const legacyExists = await sql`SELECT 1 FROM clientes WHERE id = 'cliente-eecol-default-001'`;
                final_cliente_id = (legacyExists && legacyExists.length > 0)
                  ? 'cliente-eecol-default-001'
                  : 'cliente-default-001';
              }

              const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
              if (!branchExists || branchExists.length === 0) final_sucursal_id = 'default-sucursal';

              const lat = d.latitud !== undefined ? parseFloat(d.latitud) : (d.lat !== undefined ? parseFloat(d.lat) : null);
              const lng = d.longitud !== undefined ? parseFloat(d.longitud) : (d.lng !== undefined ? parseFloat(d.lng) : null);

              await sql`
                UPDATE assets SET
                  tag = ${d.tag}, nombre = ${d.nombre}, tipo = ${d.tipo || ''}, marca = ${d.marca || ''}, modelo = ${d.modelo || ''},
                  serie = ${d.serie || ''}, ubicacion = ${d.ubicacion || ''}, area = ${d.area || ''}, capacidad = ${d.capacidad || ''},
                  voltaje = ${d.voltaje || ''}, corriente = ${d.corriente || ''}, refrigerante = ${d.refrigerante || ''},
                  fecha_instalacion = ${d.fecha_instalacion || ''}, vida_util = ${d.vida_util !== undefined ? parseInt(d.vida_util, 10) : 10},
                  estado = ${d.estado || 'operativo'}, ultimo_mantenimiento = ${d.ultimo_mantenimiento || null},
                  proximo_mantenimiento = ${d.proximo_mantenimiento || null}, frecuencia_mantenimiento = ${d.frecuencia_mantenimiento || ''},
                  horas_operacion = ${d.horas_operacion !== undefined ? parseInt(d.horas_operacion, 10) : 0},
                  tecnicos = ${JSON.stringify(d.tecnicos || [])}::jsonb, notas = ${d.notas || ''},
                  cliente_id = ${final_cliente_id}, sucursal_id = ${final_sucursal_id}, latitud = ${lat}, longitud = ${lng},
                  updated_at = ${updated_at}
                WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL);
              `;
              break;
            }
            case 'work_orders': {
              await sql`
                UPDATE work_orders SET
                  id = ${data.id || uuid_sync},
                  titulo = ${data.titulo || ''},
                  descripcion = ${data.descripcion || ''},
                  prioridad = ${data.prioridad || 'media'},
                  estado = ${data.estado || 'abierto'},
                  equipo_tag = ${data.equipo_tag || data.equipoTag || ''},
                  cliente_id = ${data.cliente_id || clienteIdSync},
                  creado_por = ${data.creado_por || data.creadoPor || ''},
                  asignado_a = ${data.asignado_a || data.asignadoA || ''},
                  fecha_creacion = ${data.fecha_creacion || data.fechaCreacion || ''},
                  data = ${strData}::jsonb,
                  updated_at = ${updated_at}
                WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL);
              `;
              break;
            }
            case 'preventive_maintenance': {
              await sql`
                UPDATE preventive_maintenance SET
                  id = ${data.id || uuid_sync},
                  equipo_tag = ${data.equipo_tag || data.equipoTag || ''},
                  tecnico_id = ${data.tecnico_id || data.tecnicoId || ''},
                  tipo = ${data.tipo || ''},
                  fecha = ${data.fecha || ''},
                  proxima_fecha = ${data.proxima_fecha || data.proximaFecha || ''},
                  estado = ${data.estado || 'Planificado'},
                  hallazgos = ${data.hallazgos || ''},
                  acciones = ${data.descripcion || data.acciones || ''},
                  repuestos = ${data.repuestos || ''},
                  cliente_id = ${data.cliente_id || clienteIdSync},
                  data = ${strData}::jsonb,
                  updated_at = ${updated_at}
                WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL);
              `;
              break;
            }
            case 'inventory': {
              const qty = Number(data.stock !== undefined ? data.stock : (data.cantidad !== undefined ? data.cantidad : 0));
              const unit = data.unidad || data.unidad_medida || '';
              await sql`
                UPDATE inventory SET
                  id = ${data.id || uuid_sync}, categoria = ${data.categoria || ''},
                  codigo = ${data.codigo || ''}, nombre = ${data.nombre || ''},
                  cantidad = ${qty}, unidad_medida = ${unit},
                  marca = ${data.marca || ''}, modelo = ${data.modelo || ''},
                  estado = ${data.estado || 'disponible'},
                  cliente_id = ${data.cliente_id || clienteIdSync},
                  updated_at = ${updated_at}
                WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL);
              `;
              break;
            }
            case 'users': {
              await sql`
                UPDATE users SET
                  id = ${data.id || uuid_sync}, nombre = ${data.nombre || ''},
                  correo = ${data.correo || data.email || ''},
                  perfil = ${data.perfil || data.rol || ''},
                  activo = ${data.activo !== undefined ? data.activo : true},
                  cliente_id = ${data.cliente_id || clienteIdSync},
                  updated_at = ${updated_at}
                WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL);
              `;
              break;
            }
            case 'clientes': {
              const cId = data.id || uuid_sync;
              await sql`
                UPDATE clientes SET
                  id = ${cId}, nombre = ${data.nombre || ''}, rut = ${data.rut || null},
                  empresa = ${data.empresa || ''}, email = ${data.email || data.correo || ''},
                  telefono = ${data.telefono || ''}, direccion = ${data.direccion || ''},
                  region = ${data.region || ''}, activo = ${data.activo !== undefined ? data.activo : true},
                  contacto_nombre = ${data.contacto_nombre || null}, contacto_correo = ${data.contacto_correo || null},
                  contacto_cargo = ${data.contacto_cargo || null}, updated_at = ${updated_at}
                WHERE (id = ${cId} OR uuid_sync = ${uuid_sync})
                  AND (updated_at IS NULL OR updated_at < ${updated_at});
              `;
              break;
            }
            case 'sucursales': {
              const finalSBranchId = data.id || uuid_sync;
              const c_id = data.cliente_id || clienteIdSync;
              await sql`
                UPDATE sucursales SET
                  id = ${finalSBranchId}, cliente_id = ${c_id}, nombre = ${data.nombre || ''},
                  codigo = ${data.codigo || ''}, direccion = ${data.direccion || ''},
                  ciudad = ${data.ciudad || ''}, region = ${data.region || ''},
                  activo = ${data.activo !== undefined ? data.activo : true},
                  contacto_nombre = ${data.contacto_nombre || null}, contacto_correo = ${data.contacto_correo || null},
                  contacto_cargo = ${data.contacto_cargo || null}, updated_at = ${updated_at}
                WHERE (id = ${finalSBranchId} OR uuid_sync = ${uuid_sync})
                  AND (updated_at IS NULL OR updated_at < ${updated_at});
              `;
              break;
            }
            case 'reports': await sql`UPDATE reports SET id = ${data.id || uuid_sync}, data = ${strData}::jsonb, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'events': await sql`UPDATE events SET id = ${data.id || uuid_sync}, data = ${strData}::jsonb, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'calendar': await sql`UPDATE calendar SET id = ${data.id || uuid_sync}, data = ${strData}::jsonb, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'catalog_asset_types': await sql`UPDATE catalog_asset_types SET id = ${data.id || uuid_sync}, cliente_id = ${data.cliente_id || clienteIdSync}, codigo = ${data.codigo || ''}, descripcion = ${data.descripcion || data.nombre || ''}, activo = ${data.activo !== undefined ? data.activo : true}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'settings': await sql`UPDATE settings SET id = ${data.id || uuid_sync}, data = ${strData}::jsonb, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'ordenes_servicio': await sql`UPDATE ordenes_servicio SET id = ${data.id || uuid_sync}, data = ${strData}::jsonb, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
          }
        } catch (err: any) {
          status = err.message?.toLowerCase().includes('unique') ? 'conflict' : 'error';
          errorMsg = err.message;
        }
        return { uuid_sync, table, result: status, error: errorMsg };
      });

      const resUpdates = await Promise.all(updatePromises);
      results.updates = resUpdates.filter(Boolean);

      // Process deletes in parallel
      const serverTimeForDelete = Date.now();
      const deletePromises = deletes.map(async (del: any) => {
        const rawTable = del.table;
        const table = resolveTable(rawTable);
        if (!table) return null;

        const ts = serverTimeForDelete;
        let status = 'applied';
        let errorMsg = '';
        try {
          switch (table) {
            case 'assets': await sql`UPDATE assets SET deleted_at = ${ts}, estado = 'baja', updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'users': await sql`UPDATE users SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'preventive_maintenance': await sql`UPDATE preventive_maintenance SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'work_orders': await sql`UPDATE work_orders SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'reports': await sql`UPDATE reports SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'events': await sql`UPDATE events SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'calendar': await sql`UPDATE calendar SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'clientes': await sql`UPDATE clientes SET deleted_at = ${ts}, updated_at = ${ts} WHERE id = ${del.uuid_sync} OR uuid_sync = ${del.uuid_sync}`; break;
            case 'sucursales': await sql`UPDATE sucursales SET deleted_at = ${ts}, updated_at = ${ts} WHERE id = ${del.uuid_sync} OR uuid_sync = ${del.uuid_sync}`; break;
            case 'catalog_asset_types': await sql`UPDATE catalog_asset_types SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'settings': await sql`UPDATE settings SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'ordenes_servicio': await sql`UPDATE ordenes_servicio SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'inventory': await sql`UPDATE inventory SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
          }
        } catch (err: any) {
          status = 'error';
          errorMsg = err.message;
        }
        return { uuid_sync: del.uuid_sync, table, result: status, error: errorMsg };
      });

      const resDeletes = await Promise.all(deletePromises);
      results.deletes = resDeletes.filter(Boolean);

      // Combined Pull (cursor server_seq por tabla — inmune a clock drift)
      // NOTE: deleted_at IS NULL filter intentionally REMOVED — tombstones must reach clients
      const serverChanges: any = {};
      const pullPromises = ALLOWED_TABLES.map(async (table) => {
        const seq = (seqs as Record<string, number>)[table] || 0;
        try {
          let rows: any[] = [];
          switch (table) {
            case 'assets': rows = await sql`SELECT * FROM assets WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'users': rows = await sql`SELECT * FROM users WHERE (cliente_id = ${clienteIdSync} OR cliente_id IS NULL) AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'preventive_maintenance': rows = await sql`SELECT * FROM preventive_maintenance WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'work_orders': rows = await sql`SELECT * FROM work_orders WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'reports': rows = await sql`SELECT * FROM reports WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'events': rows = await sql`SELECT * FROM events WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'clientes': rows = await sql`SELECT * FROM clientes WHERE (id = ${clienteIdSync} OR uuid_sync = ${clienteIdSync}) AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'sucursales': rows = await sql`SELECT * FROM sucursales WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'catalog_asset_types': rows = await sql`SELECT * FROM catalog_asset_types WHERE (cliente_id = ${clienteIdSync} OR cliente_id IS NULL) AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'settings': rows = await sql`SELECT * FROM settings WHERE (cliente_id = ${clienteIdSync} OR cliente_id IS NULL) AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'ordenes_servicio': rows = await sql`SELECT * FROM ordenes_servicio WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'inventory': rows = await sql`SELECT * FROM inventory WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'calendar': rows = await sql`SELECT * FROM calendar WHERE cliente_id = ${clienteIdSync} AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
            case 'audit_logs': rows = await sql`SELECT * FROM audit_logs WHERE (cliente_id = ${clienteIdSync} OR cliente_id IS NULL) AND server_seq > ${seq} ORDER BY server_seq ASC LIMIT 1000`; break;
          }
          if (rows && rows.length > 0) {
            serverChanges[table] = rows;
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
    return res.status(500).json({ success: false, error: error.message });
  }
}
