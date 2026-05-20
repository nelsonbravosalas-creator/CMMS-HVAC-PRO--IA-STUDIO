import { getDb } from './_db';
import { hashPin, requireRole } from './_auth';

export default async function handler(req: any, res: any) {
  try {
    const user = requireRole(['administrador', 'programador'])(req, res);
    if (!user) return;
    const sql = getDb();
    const { method, body } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT id, nombre, correo, perfil, activo, uuid_sync, updated_at FROM users WHERE activo = true`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `U-${Date.now()}`;
      const now = Date.now();
      if (!d.nombre || !d.pin) return res.status(400).json({ success: false, error: 'nombre y pin requeridos' });
      const safeData = { ...d, pin: undefined, pin_hash: undefined };
      await sql`
        INSERT INTO users (id, nombre, correo, perfil, activo, pin, pin_hash, uuid_sync, updated_at, data)
        VALUES (${id}, ${d.nombre || ''}, ${d.correo || ''}, ${d.perfil || 'tecnico'},
          ${d.activo !== false}, NULL, ${hashPin(d.pin)}, ${d.uuid_sync || id}, ${d.updated_at || now}, ${JSON.stringify(safeData)})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre, correo = EXCLUDED.correo, perfil = EXCLUDED.perfil,
          activo = EXCLUDED.activo, pin = NULL, pin_hash = EXCLUDED.pin_hash, updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
        WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
