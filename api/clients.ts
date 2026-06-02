import { getDb } from './_db.js';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, body } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT * FROM clientes WHERE deleted_at IS NULL`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `C-${Date.now()}`;
      const now = Date.now();
      const strData = JSON.stringify(d);

      await sql`
        INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at)
        VALUES (${id}, ${d.uuid_sync||id}, ${strData}::jsonb, ${d.updated_at||now}, ${d.created_at||now})
        ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
