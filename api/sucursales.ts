import { getDb } from './_db';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, body } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT * FROM sucursales ORDER BY nombre ASC`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `S-${Date.now()}`;
      const now = Date.now();
      await sql`
        INSERT INTO sucursales (id, nombre, cliente_id, direccion, ciudad, region, uuid_sincro, modificado_en, data)
        VALUES (${id}, ${d.nombre||''}, ${d.cliente_id||''}, ${d.direccion||''},
          ${d.ciudad||''}, ${d.region||''}, ${d.uuid_sincro||id}, ${d.modificado_en||now}, ${JSON.stringify(d)})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre, direccion = EXCLUDED.direccion, ciudad = EXCLUDED.ciudad,
          region = EXCLUDED.region, modificado_en = EXCLUDED.modificado_en, data = EXCLUDED.data
        WHERE EXCLUDED.modificado_en > sucursales.modificado_en OR sucursales.modificado_en IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
