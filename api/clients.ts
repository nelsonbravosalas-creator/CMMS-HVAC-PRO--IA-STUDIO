import { getDb } from './_db.js';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, body } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY nombre ASC`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `C-${Date.now()}`;
      const now = Date.now();
      await sql`
        INSERT INTO clients (id, nombre, empresa, rut, email, telefono, direccion, plan, activo, uuid_sync, updated_at, data)
        VALUES (${id}, ${d.nombre||''}, ${d.empresa||d.nombre||''}, ${d.rut||''},
          ${d.email||''}, ${d.telefono||''}, ${d.direccion||''}, ${d.plan||'basico'},
          ${d.activo !== false}, ${d.uuid_sync||id}, ${d.updated_at||now}, ${JSON.stringify(d)})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre, empresa = EXCLUDED.empresa, email = EXCLUDED.email,
          telefono = EXCLUDED.telefono, updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
        WHERE EXCLUDED.updated_at > clients.updated_at OR clients.updated_at IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
