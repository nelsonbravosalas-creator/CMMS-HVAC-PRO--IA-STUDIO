import { getDb } from '../api/_db';
import { ensureDatabaseSchema, getDatabaseHealth } from '../api/_schema';
import { requireRole } from '../api/_auth';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const user = requireRole(['administrador', 'programador'])(req, res);
    if (!user) return;
    const sql = getDb();
    await ensureDatabaseSchema(sql);
    const health = await getDatabaseHealth(sql);
    return res.status(200).json({ success: true, message: 'Base de datos inicializada correctamente en PostgreSQL', ...health });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
