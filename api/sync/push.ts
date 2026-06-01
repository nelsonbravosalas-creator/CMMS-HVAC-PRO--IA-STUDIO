import { getDb } from '../_db.js';

const ALLOWED_TABLES = [
  'assets',
  'users',
  'preventive_maintenance',
  'work_orders',
  'reports',
  'events',
  'clients',
  'branches',
  'catalog_asset_types',
  'settings',
  'ordenes_servicio',
  'inventory'
];

const TABLE_ALIAS_MAP: any = {
  'equipos': 'assets',
  'usuarios': 'users',
  'mantenimientos': 'preventive_maintenance',
  'tickets': 'work_orders',
  'informes': 'reports',
  'eventos': 'events',
  'clientes': 'clients',
  'sucursales': 'branches',
  'inventario': 'inventory',
  'ordenes_trabajo': 'work_orders',
  'mantenimiento_preventivo': 'preventive_maintenance',
  'repuestos': 'inventory'
};

function resolveTable(name: string): string | null {
  if (ALLOWED_TABLES.includes(name)) return name;
  return TABLE_ALIAS_MAP[name] || null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { inserts = [], updates = [], deletes = [] } = req.body;
    const results: any = { inserts: [], updates: [], deletes: [] };

    // Part 1: Inserts
    for (const ins of inserts) {
      const table = resolveTable(ins.table);
      if (!table) continue;

      const data = ins.data || {};
      const uuid_sync = ins.uuid_sync || data.uuid_sync;
      const updated_at = ins.updated_at || data.updated_at || ins.timestamp || Date.now();
      let status = 'applied';
      let errorMsg = '';

      try {
        if (table === 'assets') {
          const d = data;
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
              ${uuid_sync}, ${updated_at}, ${updated_at}, ${d.cliente_id || 'cliente-eecol-default-001'}, ${d.sucursal_id || 'default-sucursal'}
            ) ON CONFLICT (uuid_sync) DO UPDATE SET
              tag = EXCLUDED.tag, nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca, modelo = EXCLUDED.modelo,
              serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion, area = EXCLUDED.area, capacidad = EXCLUDED.capacidad,
              voltaje = EXCLUDED.voltaje, corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
              fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util, estado = EXCLUDED.estado,
              ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento, proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
              horas_operacion = EXCLUDED.horas_operacion, notas = EXCLUDED.notas, updated_at = EXCLUDED.updated_at
            WHERE EXCLUDED.updated_at > assets.updated_at OR assets.updated_at IS NULL;
          `;
        } else {
          const id = data.id || uuid_sync;
          const strData = JSON.stringify(data);

          // Insert into specific table
          if (table === 'users') {
            await sql`INSERT INTO users (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL`;
          } else if (table === 'preventive_maintenance') {
            await sql`INSERT INTO preventive_maintenance (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > preventive_maintenance.updated_at OR preventive_maintenance.updated_at IS NULL`;
          } else if (table === 'work_orders') {
            await sql`INSERT INTO work_orders (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > work_orders.updated_at OR work_orders.updated_at IS NULL`;
          } else if (table === 'reports') {
            await sql`INSERT INTO reports (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > reports.updated_at OR reports.updated_at IS NULL`;
          } else if (table === 'events') {
            await sql`INSERT INTO events (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > events.updated_at OR events.updated_at IS NULL`;
          } else if (table === 'clients') {
            await sql`INSERT INTO clients (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > clients.updated_at OR clients.updated_at IS NULL`;
          } else if (table === 'branches') {
            await sql`INSERT INTO branches (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${data.cliente_id || 'cliente-eecol-default-001'}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > branches.updated_at OR branches.updated_at IS NULL`;
          } else if (table === 'inventory') {
            await sql`INSERT INTO inventory (id, categoria, codigo, nombre, cantidad, unidad_medida, cliente_id, uuid_sync, updated_at, created_at, data) VALUES (${id}, ${data.categoria || ''}, ${data.codigo || ''}, ${data.nombre || ''}, ${data.stock || 0}, ${data.unidad || ''}, ${data.cliente_id || 'cliente-eecol-default-001'}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${strData}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > inventory.updated_at OR inventory.updated_at IS NULL`;
          }
        }
      } catch (e: any) {
        status = 'error';
        errorMsg = e.message;
      }
      results.inserts.push({ uuid_sync, table, result: status, error: errorMsg });
    }

    // Part 2: Updates
    for (const upd of updates) {
      const table = resolveTable(upd.table);
      if (!table) continue;

      const data = upd.data || {};
      const uuid_sync = upd.uuid_sync || data.uuid_sync;
      const updated_at = upd.updated_at || data.updated_at || upd.timestamp || Date.now();
      let status = 'applied';
      let errorMsg = '';

      try {
        if (table === 'assets') {
          const d = data;
          await sql`
            UPDATE assets SET
              tag = ${d.tag}, nombre = ${d.nombre}, tipo = ${d.tipo || ''}, marca = ${d.marca || ''}, modelo = ${d.modelo || ''},
              serie = ${d.serie || ''}, ubicacion = ${d.ubicacion || ''}, area = ${d.area || ''}, capacidad = ${d.capacidad || ''},
              voltaje = ${d.voltaje || ''}, corriente = ${d.corriente || ''}, refrigerante = ${d.refrigerante || ''},
              fecha_instalacion = ${d.fecha_instalacion || ''}, vida_util = ${d.vida_util || 0}, estado = ${d.estado || 'operativo'},
              ultimo_mantenimiento = ${d.ultimo_mantenimiento || null}, proximo_mantenimiento = ${d.proximo_mantenimiento || null},
              horas_operacion = ${d.horas_operacion || 0}, notas = ${d.notes || d.notas || ''}, updated_at = ${updated_at}
            WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)
          `;
        } else {
          const id = data.id || uuid_sync;
          const strData = JSON.stringify(data);

          if (table === 'users') {
            await sql`UPDATE users SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`;
          } else if (table === 'preventive_maintenance') {
            await sql`UPDATE preventive_maintenance SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`;
          } else if (table === 'work_orders') {
            await sql`UPDATE work_orders SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`;
          } else if (table === 'inventory') {
            await sql`UPDATE inventory SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cantidad = ${data.stock || 0}, unidad_medida = ${data.unidad || ''} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`;
          }
        }
      } catch (e: any) {
        status = 'error';
        errorMsg = e.message;
      }
      results.updates.push({ uuid_sync, table, result: status, error: errorMsg });
    }

    // Part 3: Deletes
    const serverTime = Date.now();
    for (const del of deletes) {
      const table = resolveTable(del.table);
      if (!table) continue;

      const uuid_sync = del.uuid_sync;
      let status = 'applied';
      let errorMsg = '';

      try {
        if (table === 'assets') {
          await sql`UPDATE assets SET deleted_at = ${serverTime}, estado = 'baja', updated_at = ${serverTime} WHERE uuid_sync = ${uuid_sync}`;
        } else if (table === 'users') {
          await sql`UPDATE users SET deleted_at = ${serverTime}, updated_at = ${serverTime} WHERE uuid_sync = ${uuid_sync}`;
        } else if (table === 'preventive_maintenance') {
          await sql`UPDATE preventive_maintenance SET deleted_at = ${serverTime}, updated_at = ${serverTime} WHERE uuid_sync = ${uuid_sync}`;
        } else if (table === 'work_orders') {
          await sql`UPDATE work_orders SET deleted_at = ${serverTime}, updated_at = ${serverTime} WHERE uuid_sync = ${uuid_sync}`;
        } else if (table === 'inventory') {
          await sql`UPDATE inventory SET deleted_at = ${serverTime}, updated_at = ${serverTime} WHERE uuid_sync = ${uuid_sync}`;
        }
      } catch (e: any) {
        status = 'error';
        errorMsg = e.message;
      }
      results.deletes.push({ uuid_sync, table, result: status, error: errorMsg });
    }

    return res.json({ success: true, results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
