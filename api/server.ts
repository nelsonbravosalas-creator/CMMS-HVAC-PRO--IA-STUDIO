import express from 'express';
import { neon } from '@neondatabase/serverless';

const app = express();
app.use(express.json());

const getSql = () => {
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL no definida');
  if (!dbUrl.startsWith('postgres')) {
    dbUrl = 'postgresql://neondb_owner:npg_63SfsKCBdZwa@ep-billowing-mud-aq22ej6r-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  }
  return neon(dbUrl);
};

const ALLOWED_TABLES = ['assets', 'users', 'preventive_maintenance', 'work_orders', 'reports', 'events', 'clients', 'branches'];

const TABLE_ALIAS_MAP: Record<string, string> = {
  'activos': 'assets',
  'usuarios': 'users',
  'mantenimientos': 'preventive_maintenance',
  'tickets': 'work_orders',
  'informes': 'reports',
  'eventos': 'events',
  'clientes': 'clients',
  'sucursales': 'branches'
};

function resolveTable(name: string): string | null {
  if (ALLOWED_TABLES.includes(name)) return name;
  return TABLE_ALIAS_MAP[name] || null;
}

app.post('/api/sync', async (req, res) => {
    const { inserts = [], updates = [], deletes = [], lastSync = 0 } = req.body;
    try {
      const sql = getSql();
      const results = { inserts: [] as any[], updates: [] as any[], deletes: [] as any[] };
      
      for (const ins of inserts) {
        const rawTable = ins.table;
        const table = resolveTable(rawTable);
        if (!table) continue;

        const { data, uuid_sync, updated_at } = ins;
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
          // generic JSONB tables
          const id = data.id || uuid_sync;
          const strData = JSON.stringify(data);
          
          switch (table) {
            case 'users': await sql`INSERT INTO users (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL`; break;
            case 'preventive_maintenance': await sql`INSERT INTO preventive_maintenance (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > preventive_maintenance.updated_at OR preventive_maintenance.updated_at IS NULL`; break;
            case 'work_orders': await sql`INSERT INTO work_orders (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > work_orders.updated_at OR work_orders.updated_at IS NULL`; break;
            case 'reports': await sql`INSERT INTO reports (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > reports.updated_at OR reports.updated_at IS NULL`; break;
            case 'events': await sql`INSERT INTO events (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > events.updated_at OR events.updated_at IS NULL`; break;
            case 'clients': await sql`INSERT INTO clients (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > clients.updated_at OR clients.updated_at IS NULL`; break;
            case 'branches': await sql`INSERT INTO branches (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > branches.updated_at OR branches.updated_at IS NULL`; break;
          }
        }
        results.inserts.push({ uuid_sync, folio_oficial: data.tag || data.id });
      }

      for (const upd of updates) {
        const rawTable = upd.table;
        const table = resolveTable(rawTable);
        if (!table) continue;

        const { data, uuid_sync, updated_at } = upd;
        if (table === 'assets') {
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
          const id = data.id || uuid_sync;
          const strData = JSON.stringify(data);
          switch (table) {
            case 'users': await sql`UPDATE users SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'preventive_maintenance': await sql`UPDATE preventive_maintenance SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'work_orders': await sql`UPDATE work_orders SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'reports': await sql`UPDATE reports SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'events': await sql`UPDATE events SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'clients': await sql`UPDATE clients SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            case 'branches': await sql`UPDATE branches SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
          }
        }
        results.updates.push({ uuid_sync });
      }

      for (const del of deletes) {
        const rawTable = del.table;
        const table = resolveTable(rawTable);
        if (table) {
           switch (table) {
             case 'assets': await sql`DELETE FROM assets WHERE uuid_sync = ${del.uuid_sync}`; break;
             case 'users': await sql`DELETE FROM users WHERE uuid_sync = ${del.uuid_sync}`; break;
             case 'preventive_maintenance': await sql`DELETE FROM preventive_maintenance WHERE uuid_sync = ${del.uuid_sync}`; break;
             case 'work_orders': await sql`DELETE FROM work_orders WHERE uuid_sync = ${del.uuid_sync}`; break;
             case 'reports': await sql`DELETE FROM reports WHERE uuid_sync = ${del.uuid_sync}`; break;
             case 'events': await sql`DELETE FROM events WHERE uuid_sync = ${del.uuid_sync}`; break;
             case 'clients': await sql`DELETE FROM clients WHERE uuid_sync = ${del.uuid_sync}`; break;
             case 'branches': await sql`DELETE FROM branches WHERE uuid_sync = ${del.uuid_sync}`; break;
           }
           results.deletes.push({ uuid_sync: del.uuid_sync });
        }
      }

      const serverChanges: Record<string, any[]> = {};
      for (const table of ALLOWED_TABLES) {
         try {
            let rows: any[] = [];
            switch (table) {
              case 'assets': rows = await sql`SELECT * FROM assets WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'users': rows = await sql`SELECT * FROM users WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'preventive_maintenance': rows = await sql`SELECT * FROM preventive_maintenance WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'work_orders': rows = await sql`SELECT * FROM work_orders WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'reports': rows = await sql`SELECT * FROM reports WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'events': rows = await sql`SELECT * FROM events WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'clients': rows = await sql`SELECT * FROM clients WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'branches': rows = await sql`SELECT * FROM branches WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
            }
            if (rows && rows.length > 0) {
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
});

app.all("/api/*", (req, res) => {
  res.status(404).json({ success: false, error: "API route not found" });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('VERCEL API ERROR:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ 
    success: false, 
    error: "Internal Server Error",
    message: err.message
  });
});

// Fallback for Vercel
export default app;
