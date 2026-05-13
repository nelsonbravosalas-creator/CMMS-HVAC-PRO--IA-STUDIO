import { getDb } from './_db';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, body } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT * FROM tickets ORDER BY fecha_creacion DESC LIMIT 500`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `TK-${Date.now()}`;
      const now = Date.now();
      await sql`
        INSERT INTO tickets (id, titulo, descripcion, prioridad, estado,
          equipo_tag, cliente_id, creado_por, asignado_a, fecha_creacion,
          uuid_sincro, modificado_en, data)
        VALUES (
          ${id}, ${d.titulo || ''}, ${d.descripcion || ''}, ${d.prioridad || 'media'},
          ${d.estado || 'abierto'}, ${d.equipo_tag || ''}, ${d.cliente_id || ''},
          ${d.creado_por || ''}, ${d.asignado_a || ''}, ${d.fecha_creacion || new Date().toISOString()},
          ${d.uuid_sincro || id}, ${d.modificado_en || now}, ${JSON.stringify(d)}
        )
        ON CONFLICT (id) DO UPDATE SET
          titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion,
          prioridad = EXCLUDED.prioridad, estado = EXCLUDED.estado,
          asignado_a = EXCLUDED.asignado_a, fecha_cierre = EXCLUDED.fecha_cierre,
          modificado_en = EXCLUDED.modificado_en, data = EXCLUDED.data
        WHERE EXCLUDED.modificado_en > tickets.modificado_en OR tickets.modificado_en IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    if (method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Falta id' });
      await sql`DELETE FROM tickets WHERE id = ${id}`;
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
