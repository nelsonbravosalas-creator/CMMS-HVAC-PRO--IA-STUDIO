import { getDb } from './_db';
import { EQUIPOS_DATA } from '../src/data/assets.js';
import { USUARIOS_MOCK, CLIENTES_MOCK } from '../src/data/users.js';
import { MANTENIMIENTOS_MOCK } from '../src/data/preventive_maintenance.js';
import { TICKETS_MOCK } from '../src/data/work_orders.js';
import { INFORMES_MOCK } from '../src/data/reports.js';
import { EVENTOS_MOCK } from '../src/data/events.js';
import { SUCURSALES } from '../src/data/branches.js';
import { applySyncOperations } from './_sync';
import { ensureDatabaseSchema } from './_schema';
import { requireRole } from './_auth';

const seedSources = {
  assets: EQUIPOS_DATA.map((item: any) => ({ ...item, uuid_sync: item.uuid_sync || item.tag })),
  users: USUARIOS_MOCK.map((item: any) => ({ ...item, uuid_sync: item.uuid_sync || item.id })),
  preventive_maintenance: MANTENIMIENTOS_MOCK.map((item: any) => ({ ...item, uuid_sync: item.uuid_sync || item.id })),
  work_orders: TICKETS_MOCK.map((item: any) => ({ ...item, uuid_sync: item.uuid_sync || item.id })),
  reports: INFORMES_MOCK.map((item: any) => ({ ...item, uuid_sync: item.uuid_sync || item.id })),
  events: EVENTOS_MOCK.map((item: any) => ({ ...item, uuid_sync: item.uuid_sync || item.id })),
  clients: CLIENTES_MOCK.map((item: any) => ({ ...item, uuid_sync: item.uuid_sync || item.id })),
  branches: SUCURSALES.map((item: any) => ({ ...item, uuid_sync: item.uuid_sync || item.id }))
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  try {
    const user = requireRole(['administrador', 'programador'])(req, res);
    if (!user) return;
    const sql = getDb();
    await ensureDatabaseSchema(sql);
    const force = req.query?.force === 'true';
    const resultados: Record<string, any> = {};

    for (const [table, records] of Object.entries(seedSources)) {
      const countRows = await (sql as any)(`SELECT count(*)::int AS count FROM ${table}`);
      if (!force && Number(countRows[0]?.count || 0) > 0) {
        resultados[table] = `Skip (already has ${countRows[0].count} recs)`;
        continue;
      }

      const now = Date.now();
      const inserts = records.map((record: any, index: number) => ({
        id: `seed-${table}-${index}`,
        table,
        data: record,
        uuid_sync: record.uuid_sync,
        updated_at: record.updated_at || now + index
      }));
      const payload = await applySyncOperations(sql, { inserts, updates: [], deletes: [], lastSync: 0 });
      resultados[table] = {
        requested: inserts.length,
        applied: payload.results.inserts.filter((item) => item.status === 'applied').length,
        errors: payload.results.inserts.filter((item) => item.status === 'error')
      };
    }

    return res.status(200).json({ success: true, message: 'Importación finalizada.', resultados });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
