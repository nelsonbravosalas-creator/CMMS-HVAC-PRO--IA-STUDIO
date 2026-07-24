import { getDb } from '../db.js';
import { requireRole } from '../auth.js';
import { runDbBootstrap } from '../../../scripts/db/bootstrap.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = requireRole(['administrador'])(req, res);
  if (!user) return;

  try {
    await runDbBootstrap(getDb());
    return res.status(200).json({
      success: true,
      message: 'Base de datos inicializada y data parametrica sincronizada'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}
