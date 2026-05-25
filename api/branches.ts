import { getDb } from './_db.js';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, body } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT * FROM branches WHERE deleted_at IS NULL ORDER BY nombre ASC`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `S-${Date.now()}`;
      const now = Date.now();
      await sql`
        INSERT INTO branches (id, nombre, cliente_id, direccion, ciudad, region, uuid_sync, updated_at, data)
        VALUES (${id}, ${d.nombre||''}, ${d.cliente_id||''}, ${d.direccion||''},
          ${d.ciudad||''}, ${d.region||''}, ${d.uuid_sync||id}, ${d.updated_at||now}, ${JSON.stringify(d)})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre, direccion = EXCLUDED.direccion, ciudad = EXCLUDED.ciudad,
          region = EXCLUDED.region, updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
        WHERE EXCLUDED.updated_at > branches.updated_at OR branches.updated_at IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
