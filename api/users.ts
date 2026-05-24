import { getDb } from './_db.js';

export default async function handler(req: any, res: any) {
  try {
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
      await sql`
        INSERT INTO users (id, nombre, correo, perfil, activo, pin, uuid_sync, updated_at, data)
        VALUES (${id}, ${d.nombre || ''}, ${d.correo || ''}, ${d.perfil || 'tecnico'},
          ${d.activo !== false}, ${d.pin || '0000'}, ${d.uuid_sync || id}, ${d.updated_at || now}, ${JSON.stringify(d)})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre, correo = EXCLUDED.correo, perfil = EXCLUDED.perfil,
          activo = EXCLUDED.activo, pin = EXCLUDED.pin, updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
        WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
