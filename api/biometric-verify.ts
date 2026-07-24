import { getDb } from './_db.js';
import { requireAuth } from './_auth.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authUser: any = requireAuth(req, res);
  if (!authUser) return;
  return res.status(501).json({
    success: false,
    error: 'Autenticación biométrica temporalmente deshabilitada'
  });

  /*
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const deviceId = String(req.body?.deviceId || '').trim();
    if (!email || !deviceId || deviceId.length > 256) {
      return res.status(400).json({ success: false, error: 'Datos biométricos inválidos' });
    }

    const sql = getDb();
    const rows = await sql`
      SELECT uuid_sync, id, correo, activo, data
      FROM users
      WHERE (uuid_sync = ${authUser.uuid_sync} OR id = ${authUser.id})
      LIMIT 1
    `;
    const user = rows[0];
    const storedEmail = String(user?.correo || user?.data?.email || '').trim().toLowerCase();
    if (!user || user.activo === false || storedEmail !== email) {
      return res.status(403).json({ success: false, error: 'Verificación rechazada' });
    }

    return res.json({ success: true });
  } catch {
    return res.status(503).json({ success: false, error: 'Servicio no disponible' });
  }
  */
}
