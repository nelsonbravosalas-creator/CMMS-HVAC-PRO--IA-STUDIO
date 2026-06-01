import { getDb } from './_db.js';
import { requireRole } from './_auth.js';

function mapToNeon(frontData: any) {
  return {
    id: frontData.id,
    equipo_tag: frontData.equipo_tag || frontData.equipoTag,
    tecnico: frontData.tecnico,
    tecnico_id: frontData.tecnico_id || frontData.tecnicoId,
    tipo: frontData.tipo,
    fecha: frontData.fecha,
    proxima_fecha: frontData.proxima_fecha || frontData.proximaFecha,
    estado: frontData.estado || 'Planificado',
    hallazgos: frontData.hallazgos || '',
    acciones: frontData.descripcion || frontData.acciones || '', // Dexie descripcion -> Neon acciones
    repuestos: frontData.repuestos || '',
    cliente_id: frontData.cliente_id || frontData.clienteId || 'cliente-eecol-default-001',
    uuid_sync: frontData.uuid_sync || frontData.uuidSync || frontData.id,
    updated_at: frontData.updated_at || frontData.updatedAt || Date.now()
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
    equipo_tag: neonData.equipo_tag,
    tecnico: extraData.tecnico || neonData.tecnico || 'Técnico',
    tecnico_id: neonData.tecnico_id,
    tipo: neonData.tipo,
    fecha: neonData.fecha,
    proxima_fecha: extraData.proxima_fecha || neonData.proxima_fecha,
    estado: extraData.estado || neonData.estado || 'Ejecutado',
    hallazgos: neonData.hallazgos,
    descripcion: neonData.acciones || extraData.descripcion, // Neon acciones -> Dexie descripcion
    repuestos: neonData.repuestos,
    cliente_id: neonData.cliente_id || extraData.cliente_id,
    uuid_sync: neonData.uuid_sync,
    updated_at: Number(neonData.updated_at || Date.now()),
    ubicacionGeografica: extraData.ubicacionGeografica
  };
}

export default async function handler(req: any, res: any) {
  try {
    const user = requireRole(['Administrador', 'Técnico_Líder', 'Ingeniero_Confiabilidad', 'Técnico_Terreno'])(req, res);
    if (!user) return;

    const sql = getDb();
    const { method, query, body } = req;

    if (method === 'GET') {
      const tag = query.tag || query.equipo_tag;
      if (tag) {
        const rows = await sql`SELECT * FROM preventive_maintenance WHERE equipo_tag = ${tag} AND deleted_at IS NULL ORDER BY fecha DESC`;
        return res.json({ success: true, data: rows.map(mapToDexie) });
      }
      const rows = await sql`SELECT * FROM preventive_maintenance WHERE deleted_at IS NULL ORDER BY fecha DESC LIMIT 500`;
      return res.json({ success: true, data: rows.map(mapToDexie) });
    }

    if (method === 'POST') {
      const mapped = mapToNeon(body);
      
      // Validación del campo equipo_tag obligatorio (PROBLEMA 4)
      if (!mapped.equipo_tag) {
        return res.status(400).json({ success: false, error: 'El campo equipo_tag es obligatorio para registrar un mantenimiento' });
      }

      const id = mapped.id || `MNT-${Date.now()}`;
      const now = Date.now();

      await sql`
        INSERT INTO preventive_maintenance (id, equipo_tag, tecnico_id, tipo, fecha,
          hallazgos, acciones, repuestos, uuid_sync, updated_at, data)
        VALUES (
          ${id}, ${mapped.equipo_tag}, ${mapped.tecnico_id || ''}, ${mapped.tipo || ''},
          ${mapped.fecha || new Date().toISOString()}, ${mapped.hallazgos || ''}, ${mapped.acciones || ''},
          ${mapped.repuestos || ''}, ${mapped.uuid_sync || id}, ${mapped.updated_at || now}, ${JSON.stringify(body)}
        )
        ON CONFLICT (id) DO UPDATE SET
          hallazgos = EXCLUDED.hallazgos, acciones = EXCLUDED.acciones,
          repuestos = EXCLUDED.repuestos, updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data
        WHERE EXCLUDED.updated_at > preventive_maintenance.updated_at OR preventive_maintenance.updated_at IS NULL
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
