import { getDb } from './_db';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, body } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT id, nombre, correo, perfil, activo, uuid_sincro, modificado_en FROM usuarios WHERE activo = true`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `U-${Date.now()}`;
      const now = Date.now();
      await sql`
        INSERT INTO usuarios (id, nombre, correo, perfil, activo, pin, uuid_sincro, modificado_en, data)
        VALUES (${id}, ${d.nombre || ''}, ${d.correo || ''}, ${d.perfil || 'tecnico'},
          ${d.activo !== false}, ${d.pin || '0000'}, ${d.uuid_sincro || id}, ${d.modificado_en || now}, ${JSON.stringify(d)})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre, correo = EXCLUDED.correo, perfil = EXCLUDED.perfil,
          activo = EXCLUDED.activo, pin = EXCLUDED.pin, modificado_en = EXCLUDED.modificado_en, data = EXCLUDED.data
        WHERE EXCLUDED.modificado_en > usuarios.modificado_en OR usuarios.modificado_en IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
