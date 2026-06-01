import { getDb } from '../_db.js';

function mapToDexie(neonData: any) {
  let extraData: any = {};
  if (neonData.data) {
    try {
      extraData = typeof neonData.data === 'string' ? JSON.parse(neonData.data) : neonData.data;
    } catch (e) {}
  }

  return {
    id: neonData.id,
    titulo: neonData.titulo,
    descripcion: neonData.descripcion,
    prioridad: neonData.prioridad,
    estado: neonData.estado,
    equipo_tag: neonData.equipo_tag,
    cliente_id: neonData.cliente_id,
    creado_por: neonData.creado_por,
    asignado_a: neonData.asignado_a,
    fecha_creacion: neonData.fecha_creacion,
    uuid_sync: neonData.uuid_sync,
    updated_at: Number(neonData.updated_at || Date.now()),
    ubicacionGeografica: extraData.ubicacionGeografica,
    imagenes: extraData.imagenes
  };
}

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, query, body } = req;
    const { id } = query;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Falta identificador de orden de trabajo' });
    }

    if (method === 'GET') {
      const rows = await sql`
        SELECT * FROM work_orders 
        WHERE (id = ${id} OR uuid_sync = ${id}) AND deleted_at IS NULL
      `;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Orden de trabajo no encontrada' });
      }
      return res.json({ success: true, data: mapToDexie(rows[0]) });
    }

    if (method === 'PUT') {
      const d = body;
      const now = Date.now();
      await sql`
        UPDATE work_orders SET
          titulo = ${d.titulo || ''},
          descripcion = ${d.descripcion || ''},
          prioridad = ${d.prioridad || 'media'},
          estado = ${d.estado || 'abierto'},
          equipo_tag = ${d.equipo_tag || d.equipoTag || ''},
          asignado_a = ${d.asignado_a || d.asignadoA || ''},
          updated_at = ${d.updated_at || now},
          data = ${JSON.stringify(d)}
        WHERE id = ${id} OR uuid_sync = ${id}
      `;
      return res.json({ success: true, message: 'Orden de trabajo actualizada' });
    }

    if (method === 'DELETE') {
      const now = Date.now();
      await sql`
        UPDATE work_orders 
        SET deleted_at = ${now}, updated_at = ${now} 
        WHERE id = ${id} OR uuid_sync = ${id}
      `;
      return res.json({ success: true, message: 'Orden de trabajo eliminada' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error en /api/work-orders/[id]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
