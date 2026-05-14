import { getDb } from './_db';
import { requireRole } from './_auth';

export default async function handler(req: any, res: any) {
  try {
    const user = requireRole(['Administrador', 'Técnico_Líder', 'Ingeniero_Confiabilidad', 'Técnico_Terreno'])(req, res);
    if (!user) return;
    
    const sql = getDb();
    const { method, query, body } = req;

    if (method === 'GET') {
      const tag = query.tag;
      if (tag) {
        const rows = await sql`SELECT * FROM mantenimientos WHERE equipo_tag = ${tag} ORDER BY fecha DESC`;
        return res.json({ success: true, data: rows });
      }
      const rows = await sql`SELECT * FROM mantenimientos ORDER BY fecha DESC LIMIT 500`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `MNT-${Date.now()}`;
      const now = Date.now();
      await sql`
        INSERT INTO mantenimientos (id, equipo_tag, tecnico_id, tipo, fecha,
          hallazgos, acciones, repuestos, uuid_sincro, modificado_en, data)
        VALUES (
          ${id}, ${d.equipo_tag || ''}, ${d.tecnico_id || ''}, ${d.tipo || ''},
          ${d.fecha || new Date().toISOString()}, ${d.hallazgos || ''}, ${d.acciones || ''},
          ${d.repuestos || ''}, ${d.uuid_sincro || id}, ${d.modificado_en || now}, ${JSON.stringify(d)}
        )
        ON CONFLICT (id) DO UPDATE SET
          hallazgos = EXCLUDED.hallazgos, acciones = EXCLUDED.acciones,
          repuestos = EXCLUDED.repuestos, modificado_en = EXCLUDED.modificado_en,
          data = EXCLUDED.data
        WHERE EXCLUDED.modificado_en > mantenimientos.modificado_en OR mantenimientos.modificado_en IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
