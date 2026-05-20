import { getDb } from '../api/_db';
import { applySyncOperations } from '../api/_sync';
import { ensureDatabaseSchema, normalizeSyncTable } from '../api/_schema';
import { requireRole } from '../api/_auth';

export default async function handler(req: any, res: any) {
  const table = normalizeSyncTable(req.query.table as string);
  if (!table) return res.status(400).json({ success: false, error: `Tabla inválida: ${req.query.table}` });

  try {
    const user = requireRole(table === 'users'
      ? ['administrador', 'programador']
      : ['administrador', 'programador', 'supervisor', 'tecnico', 'contratista'])(req, res);
    if (!user) return;
    const sql = getDb();
    await ensureDatabaseSchema(sql);

    if (req.method === 'GET') {
      const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;
      const rows = table === 'users'
        ? await (sql as any)(`SELECT uuid_sync, id, nombre, correo, perfil, activo, updated_at, created_at, deleted_at FROM users WHERE updated_at > $1 OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`, [since])
        : await (sql as any)(`SELECT * FROM ${table} WHERE updated_at > $1 OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`, [since]);
      return res.json({ success: true, data: rows });
    }

    if (req.method === 'POST') {
      const { records, operation, lastSync = 0 } = req.body;
      if (!Array.isArray(records)) return res.status(400).json({ success: false, error: 'records debe ser array' });

      const mapped = records.map((record: any) => ({
        ...record,
        table,
        data: record,
        uuid_sync: record.uuid_sync,
        updated_at: record.updated_at || record.deleted_at
      }));
      const opName = operation === 'delete' ? 'deletes' : operation === 'update' ? 'updates' : 'inserts';
      const payload = await applySyncOperations(sql, {
        inserts: opName === 'inserts' ? mapped : [],
        updates: opName === 'updates' ? mapped : [],
        deletes: opName === 'deletes' ? mapped : [],
        lastSync
      });
      return res.status(payload.success ? 200 : 207).json({ success: payload.success, results: payload.results[opName], serverChanges: payload.serverChanges, serverTime: payload.serverTime });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
