import { getDb } from '../_db.js';

const VALID_TABLES = ['assets', 'work_orders', 'preventive_maintenance', 'clients', 'users', 'branches', 'reports', 'events'];

export default async function handler(req: any, res: any) {
  const table = req.query.table as string;
  if (!VALID_TABLES.includes(table)) return res.status(400).json({ error: `Tabla inválida: ${table}` });

  if (req.method === 'GET') {
    try {
      const sql = getDb();
      const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;
      
      let rows;
      if (table === 'assets') {
        rows = await sql`SELECT * FROM assets WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
      } else {
        // For others using mapping to avoid variable table name in query
        if (table === 'work_orders') rows = await sql`SELECT * FROM work_orders WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
        else if (table === 'preventive_maintenance') rows = await sql`SELECT * FROM preventive_maintenance WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
        else if (table === 'clients') rows = await sql`SELECT * FROM clients WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
        else if (table === 'users') rows = await sql`SELECT * FROM users WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
        else if (table === 'branches') rows = await sql`SELECT * FROM branches WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
        else if (table === 'reports') rows = await sql`SELECT * FROM reports WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
        else if (table === 'events') rows = await sql`SELECT * FROM events WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
      }
      
      return res.json({ success: true, data: rows });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (req.method === 'POST') {
    const { records, operation } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'records debe ser array' });

    try {
      const sql = getDb();
    const results = [];

    if (operation === 'delete') {
      const now = Date.now();
      for (const record of records) {
        try {
          if (table === 'assets') {
             await sql`UPDATE assets SET deleted_at = ${now}, estado = 'baja', updated_at = ${now} WHERE uuid_sync = ${record.uuid_sync}`;
          } else {
             // Soft delete for generic JSONB tables
             if (table === 'work_orders') await sql`UPDATE work_orders SET deleted_at = ${now}, updated_at = ${now} WHERE uuid_sync = ${record.uuid_sync}`;
             else if (table === 'preventive_maintenance') await sql`UPDATE preventive_maintenance SET deleted_at = ${now}, updated_at = ${now} WHERE uuid_sync = ${record.uuid_sync}`;
             else if (table === 'clients') await sql`UPDATE clients SET deleted_at = ${now}, updated_at = ${now} WHERE uuid_sync = ${record.uuid_sync}`;
             else if (table === 'users') await sql`UPDATE users SET deleted_at = ${now}, updated_at = ${now} WHERE uuid_sync = ${record.uuid_sync}`;
             else if (table === 'branches') await sql`UPDATE branches SET deleted_at = ${now}, updated_at = ${now} WHERE uuid_sync = ${record.uuid_sync}`;
             else if (table === 'reports') await sql`UPDATE reports SET deleted_at = ${now}, updated_at = ${now} WHERE uuid_sync = ${record.uuid_sync}`;
             else if (table === 'events') await sql`UPDATE events SET deleted_at = ${now}, updated_at = ${now} WHERE uuid_sync = ${record.uuid_sync}`;
          }
          results.push({ uuid_sync: record.uuid_sync, success: true });
        } catch (e: any) {
          results.push({ uuid_sync: record.uuid_sync, success: false, error: e.message });
        }
      }
      return res.json({ success: true, results });
    }

    for (const record of records) {
      let folio_oficial = record.id;

      if (record.sync_status === 'pending_insert') {
        if (table === 'work_orders' && (!record.id || record.id.startsWith('TMP'))) {
          const rows = await sql`SELECT id FROM work_orders WHERE id LIKE 'TK-%' ORDER BY id DESC LIMIT 1`;
          let nextNum = 1;
          if (rows.length > 0) {
            const match = rows[0].id.match(/TK-(\d+)/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
          }
          folio_oficial = `TK-${nextNum.toString().padStart(4, '0')}`;
          record.id = folio_oficial;
        }
      }

      try {
        if (table === 'assets') {
          const d = record;
          await sql`
            INSERT INTO assets (tag, nombre, tipo, marca, modelo, serie, ubicacion, area,
              capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util,
              estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion,
              tecnicos, notas, cliente_id, sucursal_id, uuid_sync, updated_at, created_at)
            VALUES (
              ${d.tag}, ${d.nombre||''}, ${d.tipo||''}, ${d.marca||''},
              ${d.modelo||''}, ${d.serie||''}, ${d.ubicacion||''}, ${d.area||''},
              ${d.capacidad||''}, ${d.voltaje||''}, ${d.corriente||''}, ${d.refrigerante||''},
              ${d.fecha_instalacion||''}, ${d.vida_util||0}, ${d.estado||'operativo'},
              ${d.ultimo_mantenimiento||''}, ${d.proximo_mantenimiento||''},
              ${d.horas_operacion||0}, ${JSON.stringify(d.tecnicos||[])}, ${d.notas||''},
              ${d.cliente_id||''}, ${d.sucursal_id||''},
              ${d.uuid_sync||d.tag}, ${d.updated_at||Date.now()}, ${Date.now()}
            )
            ON CONFLICT (uuid_sync) DO UPDATE SET
              tag = EXCLUDED.tag, nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo,
              marca = EXCLUDED.marca, modelo = EXCLUDED.modelo, serie = EXCLUDED.serie,
              ubicacion = EXCLUDED.ubicacion, area = EXCLUDED.area, estado = EXCLUDED.estado,
              ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento,
              proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
              horas_operacion = EXCLUDED.horas_operacion, notas = EXCLUDED.notas,
              updated_at = EXCLUDED.updated_at
            WHERE EXCLUDED.updated_at > assets.updated_at OR assets.updated_at IS NULL
          `;
          folio_oficial = d.tag;
        } else {
          const id = record.id || record.uuid_sync || `${table.toUpperCase()}-${Date.now()}`;
          const data = JSON.stringify(record);
          const { uuid_sync, updated_at } = record;
          
          // Mapping for other tables to avoid unsafe dynamic table names in Neon
          if (table === 'work_orders') {
            await sql`
              INSERT INTO work_orders (id, data, uuid_sync, updated_at)
              VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at})
              ON CONFLICT (uuid_sync) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
              WHERE EXCLUDED.updated_at > work_orders.updated_at OR work_orders.updated_at IS NULL
            `;
          } else if (table === 'preventive_maintenance') {
            await sql`
              INSERT INTO preventive_maintenance (id, data, uuid_sync, updated_at)
              VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at})
              ON CONFLICT (uuid_sync) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
              WHERE EXCLUDED.updated_at > preventive_maintenance.updated_at OR preventive_maintenance.updated_at IS NULL
            `;
          } else if (table === 'clients') {
            await sql`
              INSERT INTO clients (id, data, uuid_sync, updated_at)
              VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at})
              ON CONFLICT (uuid_sync) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
              WHERE EXCLUDED.updated_at > clients.updated_at OR clients.updated_at IS NULL
            `;
          } else if (table === 'users') {
            await sql`
              INSERT INTO users (id, data, uuid_sync, updated_at)
              VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at})
              ON CONFLICT (uuid_sync) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
              WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL
            `;
          } else if (table === 'branches') {
            await sql`
              INSERT INTO branches (id, data, uuid_sync, updated_at)
              VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at})
              ON CONFLICT (uuid_sync) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
              WHERE EXCLUDED.updated_at > branches.updated_at OR branches.updated_at IS NULL
            `;
          } else if (table === 'reports') {
            await sql`
              INSERT INTO reports (id, data, uuid_sync, updated_at)
              VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at})
              ON CONFLICT (uuid_sync) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
              WHERE EXCLUDED.updated_at > reports.updated_at OR reports.updated_at IS NULL
            `;
          } else if (table === 'events') {
            await sql`
              INSERT INTO events (id, data, uuid_sync, updated_at)
              VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at})
              ON CONFLICT (uuid_sync) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
              WHERE EXCLUDED.updated_at > events.updated_at OR events.updated_at IS NULL
            `;
          }
          folio_oficial = id;
        }

        results.push({ uuid_sync: record.uuid_sync, folio_oficial, success: true });
      } catch (recordError: any) {
        results.push({ uuid_sync: record.uuid_sync, success: false, error: recordError.message });
      }
    }

      return res.json({ success: true, results });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
