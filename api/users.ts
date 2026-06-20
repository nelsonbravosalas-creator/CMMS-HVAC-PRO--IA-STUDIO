import { getDb } from './_db.js';
import { requireRole } from './_auth.js';
import { hashPin } from '../server/passwords.js';

export default async function handler(req: any, res: any) {
  try {
    const user = requireRole(['administrador'])(req, res);
    if (!user) return;

    const sql = getDb();
    const { method, body } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT id, nombre, correo, perfil, activo, uuid_sync, updated_at FROM users WHERE activo = true AND deleted_at IS NULL`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `U-${Date.now()}`;
      const now = Date.now();
      const pinHash = d.pin ? await hashPin(String(d.pin)) : null;
      const { pin: _pin, ...safeData } = d;
      await sql`
        INSERT INTO users (id, nombre, correo, perfil, activo, pin_hash, pin, uuid_sync, updated_at, data)
        VALUES (${id}, ${d.nombre || ''}, ${d.correo || ''}, ${d.perfil || 'tecnico'},
          ${d.activo !== false}, ${pinHash}, NULL, ${d.uuid_sync || crypto.randomUUID()}, ${d.updated_at || now}, ${JSON.stringify(safeData)})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre, correo = EXCLUDED.correo, perfil = EXCLUDED.perfil,
          activo = EXCLUDED.activo,
          pin_hash = COALESCE(EXCLUDED.pin_hash, users.pin_hash),
          pin = NULL,
          updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data
        WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL
      `;
      if (d.cliente_id) {
        await sql`
          INSERT INTO user_clientes (uuid_sync, id, user_id, cliente_id, created_at)
          SELECT ${crypto.randomUUID()}, ${`UC-${Date.now()}`}, uuid_sync, ${d.cliente_id}, ${now}
          FROM users WHERE id = ${id}
          ON CONFLICT (user_id, cliente_id) DO NOTHING
        `;
      }
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
