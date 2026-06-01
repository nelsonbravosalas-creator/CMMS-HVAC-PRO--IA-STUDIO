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
    equipo_tag: neonData.equipo_tag,
    tecnico: extraData.tecnico || neonData.tecnico || 'Técnico',
    tecnico_id: neonData.tecnico_id,
    tipo: neonData.tipo,
    fecha: neonData.fecha,
    proxima_fecha: extraData.proxima_fecha || neonData.proxima_fecha,
    estado: extraData.estado || neonData.estado || 'Ejecutado',
    hallazgos: neonData.hallazgos,
    descripcion: neonData.acciones || extraData.descripcion,
    repuestos: neonData.repuestos,
    cliente_id: neonData.cliente_id || extraData.cliente_id,
    uuid_sync: neonData.uuid_sync,
    updated_at: Number(neonData.updated_at || Date.now()),
    ubicacionGeografica: extraData.ubicacionGeografica
  };
}

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, query, body } = req;
    const id = query.id;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Falta identificador de mantenimiento' });
    }

    if (method === 'GET') {
      const rows = await sql`
        SELECT * FROM preventive_maintenance 
        WHERE (id = ${id} OR uuid_sync = ${id}) AND deleted_at IS NULL
      `;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Mantenimiento no encontrado' });
      }
      return res.json({ success: true, data: mapToDexie(rows[0]) });
    }

    if (method === 'PUT') {
      const d = body;
      const now = Date.now();
      await sql`
        UPDATE preventive_maintenance SET
          equipo_tag = ${d.equipo_tag || d.equipoTag || ''},
          tecnico_id = ${d.tecnico_id || d.tecnicoId || ''},
          tipo = ${d.tipo || ''},
          fecha = ${d.fecha || new Date().toISOString()},
          hallazgos = ${d.hallazgos || ''},
          acciones = ${d.descripcion || d.acciones || ''},
          repuestos = ${d.repuestos || ''},
          updated_at = ${now},
          data = ${JSON.stringify(d)}
        WHERE id = ${id} OR uuid_sync = ${id}
      `;
      return res.json({ success: true, message: 'Mantenimiento actualizado' });
    }

    if (method === 'DELETE') {
      const now = Date.now();
      await sql`
        UPDATE preventive_maintenance 
        SET deleted_at = ${now}, updated_at = ${now} 
        WHERE id = ${id} OR uuid_sync = ${id}
      `;
      return res.json({ success: true, message: 'Mantenimiento eliminado' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error en /api/maintenance/[id]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
