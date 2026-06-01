import { getDb } from './_db.js';

function mapToNeon(frontData: any) {
  return {
    id: frontData.id,
    titulo: frontData.titulo,
    descripcion: frontData.descripcion,
    prioridad: frontData.prioridad,
    estado: frontData.estado,
    equipo_tag: frontData.equipo_tag || frontData.equipoTag,
    cliente_id: frontData.cliente_id || frontData.clienteId,
    creado_por: frontData.creado_por || frontData.creadoPor,
    asignado_a: frontData.asignado_a || frontData.asignadoA,
    fecha_creacion: frontData.fecha_creacion || frontData.fechaCreacion,
    uuid_sync: frontData.uuid_sync || frontData.uuidSync || frontData.id,
    updated_at: frontData.updated_at || frontData.updatedAt || Date.now(),
  };
}

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
    const { method, body, query } = req;

    if (method === 'GET') {
      const rows = await sql`SELECT * FROM work_orders WHERE deleted_at IS NULL ORDER BY fecha_creacion DESC LIMIT 500`;
      const mapped = rows.map(mapToDexie);
      return res.json({ success: true, data: mapped });
    }

    if (method === 'POST') {
      const mapped = mapToNeon(body);
      const id = mapped.id || `TK-${Date.now()}`;
      const now = Date.now();

      await sql`
        INSERT INTO work_orders (id, titulo, descripcion, prioridad, estado,
          equipo_tag, cliente_id, creado_por, asignado_a, fecha_creacion,
          uuid_sync, updated_at, data)
        VALUES (
          ${id}, ${mapped.titulo || ''}, ${mapped.descripcion || ''}, ${mapped.prioridad || 'media'},
          ${mapped.estado || 'abierto'}, ${mapped.equipo_tag || ''}, ${mapped.cliente_id || ''},
          ${mapped.creado_por || ''}, ${mapped.asignado_a || ''}, ${mapped.fecha_creacion || new Date().toISOString()},
          ${mapped.uuid_sync || id}, ${mapped.updated_at || now}, ${JSON.stringify(body)}
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
      const id = query.id || body?.id;
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
