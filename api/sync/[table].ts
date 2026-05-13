import { getDb } from '../_db';

const VALID_TABLES = ['activos', 'tickets', 'mantenimientos', 'clientes', 'usuarios', 'sucursales', 'informes', 'eventos'];

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const table = req.query.table as string;
  if (!VALID_TABLES.includes(table)) return res.status(400).json({ error: `Tabla inválida: ${table}` });

  const { records } = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records debe ser array' });

  try {
    const sql = getDb();
    const results = [];

    for (const record of records) {
      let folio_oficial = record.id;

      if (record.sync_status === 'pending_insert') {
        if (table === 'tickets' && (!record.id || record.id.startsWith('TMP'))) {
          const rows = await sql`SELECT id FROM tickets WHERE id LIKE 'TK-%' ORDER BY id DESC LIMIT 1`;
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
        if (table === 'activos') {
          const d = record;
          await sql`
            INSERT INTO activos (tag, nombre, tipo, marca, modelo, serie, ubicacion, area,
              capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util,
              estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion,
              tecnicos, notas, cliente_id, sucursal_id, uuid_sincro, modificado_en, creado_en)
            VALUES (
              ${d.tag}, ${d.nombre||''}, ${d.tipo||''}, ${d.marca||''},
              ${d.modelo||''}, ${d.serie||''}, ${d.ubicacion||''}, ${d.area||''},
              ${d.capacidad||''}, ${d.voltaje||''}, ${d.corriente||''}, ${d.refrigerante||''},
              ${d.fecha_instalacion||''}, ${d.vida_util||0}, ${d.estado||'operativo'},
              ${d.ultimo_mantenimiento||''}, ${d.proximo_mantenimiento||''},
              ${d.horas_operacion||0}, ${JSON.stringify(d.tecnicos||[])}, ${d.notas||''},
              ${d.cliente_id||''}, ${d.sucursal_id||''},
              ${d.uuid_sincro||d.tag}, ${d.modificado_en||Date.now()}, ${Date.now()}
            )
            ON CONFLICT (uuid_sincro) DO UPDATE SET
              tag = EXCLUDED.tag, nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo,
              marca = EXCLUDED.marca, modelo = EXCLUDED.modelo, serie = EXCLUDED.serie,
              ubicacion = EXCLUDED.ubicacion, area = EXCLUDED.area, estado = EXCLUDED.estado,
              ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento,
              proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
              horas_operacion = EXCLUDED.horas_operacion, notas = EXCLUDED.notas,
              modificado_en = EXCLUDED.modificado_en
            WHERE EXCLUDED.modificado_en > activos.modificado_en OR activos.modificado_en IS NULL
          `;
          folio_oficial = d.tag;
        } else {
          const id = record.id || record.uuid_sincro || `${table.toUpperCase()}-${Date.now()}`;
          const data = JSON.stringify(record);
          const { uuid_sincro, modificado_en } = record;
          
          // Mapping for other tables to avoid unsafe dynamic table names in Neon
          if (table === 'tickets') {
            await sql`
              INSERT INTO tickets (id, data, uuid_sincro, modificado_en)
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en})
              ON CONFLICT (uuid_sincro) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en
              WHERE EXCLUDED.modificado_en > tickets.modificado_en OR tickets.modificado_en IS NULL
            `;
          } else if (table === 'mantenimientos') {
            await sql`
              INSERT INTO mantenimientos (id, data, uuid_sincro, modificado_en)
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en})
              ON CONFLICT (uuid_sincro) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en
              WHERE EXCLUDED.modificado_en > mantenimientos.modificado_en OR mantenimientos.modificado_en IS NULL
            `;
          } else if (table === 'clientes') {
            await sql`
              INSERT INTO clientes (id, data, uuid_sincro, modificado_en)
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en})
              ON CONFLICT (uuid_sincro) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en
              WHERE EXCLUDED.modificado_en > clientes.modificado_en OR clientes.modificado_en IS NULL
            `;
          } else if (table === 'usuarios') {
            await sql`
              INSERT INTO usuarios (id, data, uuid_sincro, modificado_en)
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en})
              ON CONFLICT (uuid_sincro) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en
              WHERE EXCLUDED.modificado_en > usuarios.modificado_en OR usuarios.modificado_en IS NULL
            `;
          } else if (table === 'sucursales') {
            await sql`
              INSERT INTO sucursales (id, data, uuid_sincro, modificado_en)
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en})
              ON CONFLICT (uuid_sincro) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en
              WHERE EXCLUDED.modificado_en > sucursales.modificado_en OR sucursales.modificado_en IS NULL
            `;
          } else if (table === 'informes') {
            await sql`
              INSERT INTO informes (id, data, uuid_sincro, modificado_en)
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en})
              ON CONFLICT (uuid_sincro) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en
              WHERE EXCLUDED.modificado_en > informes.modificado_en OR informes.modificado_en IS NULL
            `;
          } else if (table === 'eventos') {
            await sql`
              INSERT INTO eventos (id, data, uuid_sincro, modificado_en)
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en})
              ON CONFLICT (uuid_sincro) DO UPDATE SET
                id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en
              WHERE EXCLUDED.modificado_en > eventos.modificado_en OR eventos.modificado_en IS NULL
            `;
          }
          folio_oficial = id;
        }

        results.push({ uuid_sincro: record.uuid_sincro, folio_oficial, success: true });
      } catch (recordError: any) {
        results.push({ uuid_sincro: record.uuid_sincro, success: false, error: recordError.message });
      }
    }

    return res.json({ success: true, results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
