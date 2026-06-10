// CMMS HVAC PRO — maintenance API
// Consolida: api/maintenance.ts + api/preventive_maintenance.ts
// Vercel function: /api/maintenance
// Tablas Neon: preventive_maintenance

import { getDb } from './_db.js';
import { verifyToken } from './_auth.js';

function mapToNeon(frontData: any) {
  return {
    id: frontData.id,
    equipo_tag: frontData.equipo_tag || frontData.equipoTag,
    tecnico_id: frontData.tecnico_id || frontData.tecnicoId,
    tipo: frontData.tipo,
    fecha: frontData.fecha,
    proxima_fecha: frontData.proxima_fecha || frontData.proximaFecha || '',
    estado: frontData.estado || 'Planificado',
    hallazgos: frontData.hallazgos || '',
    acciones: frontData.descripcion || frontData.acciones || '', // Dexie descripcion/acciones -> Neon acciones
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
    proxima_fecha: neonData.proxima_fecha || extraData.proxima_fecha || '',
    estado: neonData.estado || extraData.estado || 'Planificado',
    hallazgos: neonData.hallazgos || '',
    descripcion: neonData.acciones || extraData.descripcion || '', // Neon acciones -> Dexie descripcion
    acciones: neonData.acciones || '',
    repuestos: neonData.repuestos || '',
    cliente_id: neonData.cliente_id || extraData.cliente_id || 'cliente-eecol-default-001',
    uuid_sync: neonData.uuid_sync,
    updated_at: Number(neonData.updated_at || Date.now()),
    ubicacionGeografica: extraData.ubicacionGeografica
  };
}

export default async function handler(req: any, res: any) {
  try {
    const userToken: any = verifyToken(req);
    if (!userToken) {
      return res.status(401).json({ success: false, error: 'No autorizado - falta token o es inválido' });
    }

    const clienteIdFromToken = userToken.clienteId || userToken.cliente_id || 'cliente-eecol-default-001';

    const sql = getDb();
    const { method, query, body } = req;
    const id = query.id || query.uuid || body?.uuid_sync || body?.id;

    if (method === 'GET') {
      if (id) {
        const rows = await sql`
          SELECT * FROM preventive_maintenance 
          WHERE (id = ${id} OR uuid_sync = ${id}) 
            AND cliente_id = ${clienteIdFromToken} 
            AND deleted_at IS NULL
        `;
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Mantenimiento no encontrado' });
        }
        return res.json({ success: true, data: mapToDexie(rows[0]) });
      }

      const tag = query.tag || query.equipo_tag;
      if (tag) {
        const rows = await sql`
          SELECT * FROM preventive_maintenance 
          WHERE equipo_tag = ${tag} 
            AND cliente_id = ${clienteIdFromToken} 
            AND deleted_at IS NULL 
          ORDER BY fecha DESC
        `;
        return res.json({ success: true, data: rows.map(mapToDexie) });
      }

      const rows = await sql`
        SELECT * FROM preventive_maintenance 
        WHERE cliente_id = ${clienteIdFromToken} 
          AND deleted_at IS NULL 
        ORDER BY fecha DESC 
        LIMIT 500
      `;
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
              estado = 'Ejecutado',
              data = jsonb_set(coalesce(data, '{}'::jsonb), '{estado}', '"Ejecutado"')
          WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken}
        `;
        return res.json({ success: true, message: 'Mantenimiento ejecutado con éxito.' });
      }

      const mapped = mapToNeon(body);
      if (!mapped.equipo_tag) {
        return res.status(400).json({ success: false, error: 'El campo equipo_tag es obligatorio para registrar un mantenimiento' });
      }

      const finalId = mapped.id || `MNT-${Date.now()}`;
      const now = Date.now();

      await sql`
        INSERT INTO preventive_maintenance (
          uuid_sync, id, equipo_tag, tecnico_id, tipo, fecha, proxima_fecha,
          estado, hallazgos, acciones, repuestos, cliente_id, updated_at, created_at, data
        )
        VALUES (
          ${mapped.uuid_sync || finalId}, ${finalId}, ${mapped.equipo_tag}, ${mapped.tecnico_id || ''},
          ${mapped.tipo || ''}, ${mapped.fecha || new Date().toISOString()}, ${mapped.proxima_fecha || ''},
          ${mapped.estado || 'Planificado'}, ${mapped.hallazgos || ''}, ${mapped.acciones || ''},
          ${mapped.repuestos || ''}, ${mapped.cliente_id || clienteIdFromToken || 'cliente-eecol-default-001'}, 
          ${mapped.updated_at || now}, ${now}, ${JSON.stringify(body)}
        )
        ON CONFLICT (uuid_sync) DO UPDATE SET
          id = EXCLUDED.id,
          equipo_tag = EXCLUDED.equipo_tag,
          tecnico_id = EXCLUDED.tecnico_id,
          tipo = EXCLUDED.tipo,
          fecha = EXCLUDED.fecha,
          proxima_fecha = EXCLUDED.proxima_fecha,
          estado = EXCLUDED.estado,
          hallazgos = EXCLUDED.hallazgos,
          acciones = EXCLUDED.acciones,
          repuestos = EXCLUDED.repuestos,
          cliente_id = EXCLUDED.cliente_id,
          updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data
        WHERE EXCLUDED.updated_at > preventive_maintenance.updated_at OR preventive_maintenance.updated_at IS NULL
      `;
      return res.json({ success: true, data: { id: finalId } });
    }

    if (method === 'PUT') {
      if (!id) {
        return res.status(400).json({ success: false, error: 'Falta identificador de mantenimiento' });
      }
      const d = body;
      const now = Date.now();
      const mapped = mapToNeon(d);

      await sql`
        UPDATE preventive_maintenance SET
          equipo_tag = ${mapped.equipo_tag || ''},
          tecnico_id = ${mapped.tecnico_id || ''},
          tipo = ${mapped.tipo || ''},
          fecha = ${mapped.fecha || new Date().toISOString()},
          proxima_fecha = ${mapped.proxima_fecha || ''},
          estado = ${mapped.estado || 'Planificado'},
          hallazgos = ${mapped.hallazgos || ''},
          acciones = ${mapped.acciones || ''},
          repuestos = ${mapped.repuestos || ''},
          cliente_id = ${mapped.cliente_id || clienteIdFromToken || 'cliente-eecol-default-001'},
          updated_at = ${now},
          data = ${JSON.stringify(d)}
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken}
      `;
      return res.json({ success: true, message: 'Mantenimiento actualizado' });
    }

    if (method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ success: false, error: 'Falta id de mantenimiento' });
      }
      const now = Date.now();
      await sql`
        UPDATE preventive_maintenance 
        SET deleted_at = ${now}, updated_at = ${now} 
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken}
      `;
      return res.json({ success: true, message: 'Mantenimiento eliminado' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
