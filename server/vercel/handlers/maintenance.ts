// CMMS HVAC PRO — maintenance API
// Consolida: api/maintenance.ts + api/maintenance/[id].ts + api/maintenance/[id]/execute.ts + api/preventive_maintenance.ts
// Vercel function: /api/maintenance
// Tablas Neon: preventive_maintenance

import { getDb } from '../db.js';
import { canWriteResource, getScopedTenantId, requireAuth } from '../auth.js';

function mapToNeon(frontData: any, tenantId: string) {
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
    cliente_id: tenantId,
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
    const user: any = requireAuth(req, res);
    if (!user) return;

    const sql = getDb();
    const { method, query, body } = req;
    const writeOperation = method === 'POST' ? 'insert' : method === 'DELETE' ? 'delete' : 'update';
    if (method !== 'GET' && !canWriteResource(user, 'preventive_maintenance', writeOperation)) {
      return res.status(403).json({ success: false, error: 'No autorizado - rol insuficiente' });
    }
    const tenantId = getScopedTenantId(
      user,
      req.headers['x-client-id'] || req.headers['x-cliente-id'] || query.cliente_id || query.clienteId || body?.cliente_id || body?.clienteId
    );
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'Tenant no asociado al token de sesión' });
    }
    const id = query.id || query.uuid || body?.uuid_sync || body?.id;

    if (method === 'GET') {
      if (id) {
        const rows = await sql`
          SELECT * FROM preventive_maintenance 
          WHERE (id = ${id} OR uuid_sync = ${id})
            AND cliente_id = ${tenantId}
            AND deleted_at IS NULL
        `;
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Mantenimiento no encontrado' });
        }
        return res.json({ success: true, data: mapToDexie(rows[0]) });
      }

      const tag = query.tag || query.equipo_tag;
      if (tag) {
        const rows = await sql`SELECT * FROM preventive_maintenance WHERE equipo_tag = ${tag} AND cliente_id = ${tenantId} AND deleted_at IS NULL ORDER BY fecha DESC`;
        return res.json({ success: true, data: rows.map(mapToDexie) });
      }

      const rows = await sql`SELECT * FROM preventive_maintenance WHERE cliente_id = ${tenantId} AND deleted_at IS NULL ORDER BY fecha DESC LIMIT 500`;
      return res.json({ success: true, data: rows.map(mapToDexie) });
    }

    if (method === 'POST') {
      const action = query.action;
      if (action === 'execute') {
        if (!id) {
          return res.status(400).json({ error: 'Falta identificador (id)' });
        }
        const now = Date.now();
        await sql`
          UPDATE preventive_maintenance 
          SET updated_at = ${now},
              data = jsonb_set(coalesce(data, '{}'::jsonb), '{estado}', '"ejecutado"')
          WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
        `;
        return res.json({ success: true, message: 'Mantenimiento ejecutado con éxito.' });
      }

      const mapped = mapToNeon(body, tenantId);
      if (!mapped.equipo_tag) {
        return res.status(400).json({ success: false, error: 'El campo equipo_tag es obligatorio para registrar un mantenimiento' });
      }

      const finalId = mapped.id || `MNT-${Date.now()}`;
      const now = Date.now();

      await sql`
        INSERT INTO preventive_maintenance (id, equipo_tag, tecnico_id, tipo, fecha,
          hallazgos, acciones, repuestos, cliente_id, uuid_sync, updated_at, data)
        VALUES (
          ${finalId}, ${mapped.equipo_tag}, ${mapped.tecnico_id || ''}, ${mapped.tipo || ''},
          ${mapped.fecha || new Date().toISOString()}, ${mapped.hallazgos || ''}, ${mapped.acciones || ''},
          ${mapped.repuestos || ''}, ${mapped.cliente_id}, ${mapped.uuid_sync || finalId}, ${mapped.updated_at || now}, ${JSON.stringify(body)}
        )
        ON CONFLICT (id) DO UPDATE SET
          hallazgos = EXCLUDED.hallazgos, acciones = EXCLUDED.acciones,
          repuestos = EXCLUDED.repuestos, updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data
        WHERE preventive_maintenance.cliente_id = EXCLUDED.cliente_id
          AND (EXCLUDED.updated_at > preventive_maintenance.updated_at OR preventive_maintenance.updated_at IS NULL)
      `;
      return res.json({ success: true, data: { id: finalId } });
    }

    if (method === 'PUT') {
      if (!id) {
        return res.status(400).json({ success: false, error: 'Falta identificador de mantenimiento' });
      }
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
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
      `;
      return res.json({ success: true, message: 'Mantenimiento actualizado' });
    }

    if (method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ success: false, error: 'Falta identificador de mantenimiento' });
      }
      const now = Date.now();
      await sql`
        UPDATE preventive_maintenance 
        SET deleted_at = ${now}, updated_at = ${now} 
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
      `;
      return res.json({ success: true, message: 'Mantenimiento eliminado' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
