import { neon } from '@neondatabase/serverless';

const ALLOWED_TABLES = ['assets', 'users', 'preventive_maintenance', 'work_orders', 'reports', 'events', 'clients', 'branches'];

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL no definida' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { inserts = [], updates = [], deletes = [], lastSync = 0 } = req.body;
  const results = { inserts: [] as any[], updates: [] as any[], deletes: [] as any[] };

  try {
    // Vercel / serverless: Process sequentially
    for (const ins of inserts) {
      const { table, data, uuid_sync, updated_at } = ins;
      if (table === 'assets' || table === 'equipos') {
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
            ${uuid_sync}, ${updated_at}, ${updated_at}, ${d.cliente_id || ''}, ${d.sucursal_id || ''}
          ) ON CONFLICT (uuid_sync) DO UPDATE SET
            tag = EXCLUDED.tag, nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca, modelo = EXCLUDED.modelo,
            serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion, area = EXCLUDED.area, capacidad = EXCLUDED.capacidad,
            voltaje = EXCLUDED.voltaje, corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
            fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util, estado = EXCLUDED.estado,
            ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento, proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
            horas_operacion = EXCLUDED.horas_operacion, notas = EXCLUDED.notas, cliente_id = EXCLUDED.cliente_id, sucursal_id = EXCLUDED.sucursal_id,
            updated_at = EXCLUDED.updated_at
          WHERE EXCLUDED.updated_at > assets.updated_at OR assets.updated_at IS NULL;
        `;
      } else {
        const safeTable = ALLOWED_TABLES.includes(table) ? table : null;
        if (safeTable) {
          const id = data.id || uuid_sync;
          const strData = JSON.stringify(data);
          const queryText = `
            INSERT INTO ${safeTable} (id, data, uuid_sync, updated_at, created_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (uuid_sync) DO UPDATE SET
              id = EXCLUDED.id,
              data = EXCLUDED.data,
              updated_at = EXCLUDED.updated_at
            WHERE EXCLUDED.updated_at > ${safeTable}.updated_at OR ${safeTable}.updated_at IS NULL;
          `;
          await (sql as any).query(queryText, [id, strData, uuid_sync, updated_at, updated_at]);
        }
      }
      results.inserts.push({ uuid_sync, folio_oficial: data.tag || data.id });
    }

    for (const upd of updates) {
      const { table, data, uuid_sync, updated_at } = upd;
      if (table === 'assets' || table === 'equipos') {
         const d = data;
         await sql`
          UPDATE assets SET
            tag = ${d.tag}, nombre = ${d.nombre}, tipo = ${d.tipo || ''}, marca = ${d.marca || ''}, modelo = ${d.modelo || ''},
            serie = ${d.serie || ''}, ubicacion = ${d.ubicacion || ''}, area = ${d.area || ''}, capacidad = ${d.capacidad || ''},
            voltaje = ${d.voltaje || ''}, corriente = ${d.corriente || ''}, refrigerante = ${d.refrigerante || ''},
            fecha_instalacion = ${d.fecha_instalacion || ''}, vida_util = ${d.vida_util || 0}, estado = ${d.estado || 'operativo'},
            ultimo_mantenimiento = ${d.ultimo_mantenimiento || null}, proximo_mantenimiento = ${d.proximo_mantenimiento || null},
            horas_operacion = ${d.horas_operacion || 0}, notas = ${d.notas || ''},
            cliente_id = ${d.cliente_id || ''}, sucursal_id = ${d.sucursal_id || ''},
            updated_at = ${updated_at}
          WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL);
        `;
      } else {
        const safeTable = ALLOWED_TABLES.includes(table) ? table : null;
        if (safeTable) {
           const id = data.id || uuid_sync;
           const strData = JSON.stringify(data);
           const query = `
              UPDATE ${safeTable} 
              SET id = $1, data = $2, updated_at = $3
              WHERE uuid_sync = $4 AND (updated_at < $5 OR updated_at IS NULL);
           `;
           await (sql as any).query(query, [id, strData, updated_at, uuid_sync, updated_at]);
        }
      }
      results.updates.push({ uuid_sync });
    }

    for (const del of deletes) {
      const { table, uuid_sync } = del;
      const safeTable = ALLOWED_TABLES.includes(table) ? table : null;
      if (safeTable) {
         await (sql as any).query(`DELETE FROM ${safeTable} WHERE uuid_sync = $1`, [uuid_sync]);
         results.deletes.push({ uuid_sync });
      }
    }

    const serverChanges: Record<string, any[]> = {};
    for (const table of ALLOWED_TABLES) {
       try {
          const { rows } = await (sql as any).query(`SELECT * FROM ${table} WHERE updated_at > $1`, [lastSync]);
          if (rows.length > 0) {
             serverChanges[table] = rows;
          }
       } catch(e){}
    }

    console.log(`[SYNC] Sync applied: Inserts ${inserts.length}, Updates ${updates.length}, Deletes ${deletes.length}`);
    res.json({ success: true, results, serverChanges });

  } catch (error: any) {
    console.error('[SYNC ERROR]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
