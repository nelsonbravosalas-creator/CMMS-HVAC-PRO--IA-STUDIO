import { getDb } from '../db.js';
import { requireRole } from '../auth.js';
import { runDbBootstrap } from '../../../scripts/db/bootstrap.js';
import { consumeRateLimit, rejectRateLimit, writeSecurityAudit } from '../security.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const sql = getDb();
  const user = await requireRole(['administrador'])(req, res, sql);
  if (!user) return;
  const limit = await consumeRateLimit(sql, 'admin-bootstrap', String(user.uuid_sync || user.id), 3, 60 * 60 * 1000);
  if (!limit.allowed) return rejectRateLimit(res, limit);

  try {
    await runDbBootstrap(sql);
    await writeSecurityAudit(sql, {
      action: 'admin.bootstrap', entityType: 'database', entityId: 'primary',
      userId: user.uuid_sync || user.id, outcome: 'success'
    });
    return res.status(200).json({
      success: true,
      message: 'Base de datos inicializada y data parametrica sincronizada'
    });
  } catch (error: any) {
    await writeSecurityAudit(sql, {
      action: 'admin.bootstrap', entityType: 'database', entityId: 'primary',
      userId: user.uuid_sync || user.id, outcome: 'failure'
    });
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}
