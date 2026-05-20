import { getDb } from './_db';
import { ensureDatabaseSchema, getDatabaseHealth } from './_schema';
import { requireRole } from './_auth';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    if (req.method === 'POST') {
      const user = requireRole(['administrador', 'programador'])(req, res);
      if (!user) return;
    }
    const sql = getDb();
    if (req.method === 'POST' || req.query?.migrate === 'true') {
      await ensureDatabaseSchema(sql);
    }
    const health = await getDatabaseHealth(sql);
    return res.status(200).json({ success: true, ...health });
  } catch (error: any) {
    return res.status(503).json({ success: false, configured: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL), connected: false, error: error.message });
  }
}
