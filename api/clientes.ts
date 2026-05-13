import { getDb } from './_db';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, body } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT * FROM clientes ORDER BY nombre ASC`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `C-${Date.now()}`;
      const now = Date.now();
      await sql`
        INSERT INTO clientes (id, nombre, empresa, rut, email, telefono, direccion, plan, activo, uuid_sincro, modificado_en, data)
        VALUES (${id}, ${d.nombre||''}, ${d.empresa||d.nombre||''}, ${d.rut||''},
          ${d.email||''}, ${d.telefono||''}, ${d.direccion||''}, ${d.plan||'basico'},
          ${d.activo !== false}, ${d.uuid_sincro||id}, ${d.modificado_en||now}, ${JSON.stringify(d)})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre, empresa = EXCLUDED.empresa, email = EXCLUDED.email,
          telefono = EXCLUDED.telefono, modificado_en = EXCLUDED.modificado_en, data = EXCLUDED.data
        WHERE EXCLUDED.modificado_en > clientes.modificado_en OR clientes.modificado_en IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
