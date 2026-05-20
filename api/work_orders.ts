import { getDb } from './_db';
import { requireRole } from './_auth';

export default async function handler(req: any, res: any) {
  try {
    const user = requireRole(['administrador', 'programador', 'supervisor', 'tecnico', 'contratista'])(req, res);
    if (!user) return;
    const sql = getDb();
    const { method, body } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT * FROM work_orders WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 500`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      const id = d.id || `TK-${Date.now()}`;
      const now = Date.now();
      await sql`
        INSERT INTO work_orders (id, titulo, descripcion, prioridad, estado,
          equipo_tag, cliente_id, creado_por, asignado_a, fecha_creacion,
          uuid_sync, updated_at, data)
        VALUES (
          ${id}, ${d.titulo || ''}, ${d.descripcion || ''}, ${d.prioridad || 'media'},
          ${d.estado || 'abierto'}, ${d.equipo_tag || ''}, ${d.cliente_id || ''},
          ${d.creado_por || ''}, ${d.asignado_a || ''}, ${d.fecha_creacion || new Date().toISOString()},
          ${d.uuid_sync || id}, ${d.updated_at || now}, ${JSON.stringify(d)}
        )
        ON CONFLICT (id) DO UPDATE SET
          titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion,
          prioridad = EXCLUDED.prioridad, estado = EXCLUDED.estado,
          asignado_a = EXCLUDED.asignado_a, fecha_cierre = EXCLUDED.fecha_cierre,
          updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
        WHERE EXCLUDED.updated_at > work_orders.updated_at OR work_orders.updated_at IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    if (method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Falta id' });
      const now = Date.now();
      await sql`UPDATE work_orders SET deleted_at = ${now}, updated_at = ${now} WHERE id = ${id}`;
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
