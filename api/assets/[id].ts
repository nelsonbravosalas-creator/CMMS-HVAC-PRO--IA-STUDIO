import { getDb } from '../_db.js';
import { requireRole } from '../_auth.js';

export default async function handler(req: any, res: any) {
  try {
    const user = requireRole(['Administrador', 'Técnico_Líder', 'Ingeniero_Confiabilidad'])(req, res);
    if (!user) return; // Ya se envió el error 401/403

    const sql = getDb();
    const { method, query, body } = req;
    const { id } = query; // Esto será uuid_sync o tag

    if (!id) {
      return res.status(400).json({ success: false, error: 'Falta identificador (id/tag)' });
    }

    if (method === 'GET') {
      const rows = await sql`
        SELECT * FROM assets 
        WHERE (uuid_sync = ${id} OR tag = ${id}) AND deleted_at IS NULL
      `;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
      }
      return res.json({ success: true, data: rows[0] });
    }

    if (method === 'PUT') {
      const d = body;
      const now = Date.now();
      
      // Update logic matches POST fields but filters by id or tag
      await sql`
        UPDATE assets SET
          nombre = ${d.nombre || ''},
          tipo = ${d.tipo || ''},
          marca = ${d.marca || ''},
          modelo = ${d.modelo || ''},
          serie = ${d.serie || ''},
          ubicacion = ${d.ubicacion || ''},
          area = ${d.area || ''},
          capacidad = ${d.capacidad || ''},
          voltaje = ${d.voltaje || ''},
          corriente = ${d.corriente || ''},
          refrigerante = ${d.refrigerante || ''},
          fecha_instalacion = ${d.fecha_instalacion || ''},
          vida_util = ${d.vida_util || 0},
          estado = ${d.estado || 'operativo'},
          ultimo_mantenimiento = ${d.ultimo_mantenimiento || ''},
          proximo_mantenimiento = ${d.proximo_mantenimiento || ''},
          horas_operacion = ${d.horas_operacion || 0},
          tecnicos = ${JSON.stringify(d.tecnicos || [])},
          notas = ${d.notas || ''},
          cliente_id = ${d.cliente_id || 'cliente_defecto'},
          sucursal_id = ${d.sucursal_id || 'sucursal_defecto'},
          updated_at = ${d.updated_at || now}
        WHERE uuid_sync = ${id} OR tag = ${id}
      `;
      return res.json({ success: true, message: 'Equipo actualizado' });
    }

    if (method === 'DELETE') {
      const now = Date.now();
      await sql`
        UPDATE assets 
        SET deleted_at = ${now}, estado = 'baja', updated_at = ${now} 
        WHERE uuid_sync = ${id} OR tag = ${id}
      `;
      return res.json({ success: true, message: 'Equipo eliminado' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error en /api/assets/[id]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
