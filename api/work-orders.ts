// CMMS HVAC PRO — work-orders API
// Consolida: api/work-orders.ts + api/work-orders/[id].ts + api/work-orders/[id]/complete.ts + api/work_orders.ts
// Vercel function: /api/work-orders
// Tablas Neon: work_orders

import { getDb } from './_db.js';
import { verifyToken } from './_auth.js';

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
    const id = query.id || query.uuid || body?.uuid_sync || body?.id;

    // [SEC C-08] Toda operación exige JWT válido; el tenant se deriva del token, no del payload.
    const auth: any = verifyToken(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'No autorizado - falta token' });
    }
    const clienteIdFromToken = auth.clienteId || auth.cliente_id;

    if (method === 'GET') {
      if (id) {
        const rows = await sql`
          SELECT * FROM work_orders
          WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken} AND deleted_at IS NULL
        `;
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Orden de trabajo no encontrada' });
        }
        return res.json({ success: true, data: mapToDexie(rows[0]) });
      }

      const rows = await sql`SELECT * FROM work_orders WHERE cliente_id = ${clienteIdFromToken} AND deleted_at IS NULL ORDER BY fecha_creacion DESC LIMIT 500`;
      const mapped = rows.map(mapToDexie);
      return res.json({ success: true, data: mapped });
    }

    if (method === 'POST') {
      const action = query.action;
      if (action === 'complete') {
        if (!id) {
          return res.status(400).json({ error: 'Falta identificador (id)' });
        }
        const now = Date.now();
        await sql`
          UPDATE work_orders
          SET estado = 'cerrado',
              fecha_cierre = ${new Date().toISOString()},
              updated_at = ${now},
              data = jsonb_set(coalesce(data, '{}'::jsonb), '{estado}', '"cerrado"')
          WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken}
        `;
        return res.json({ success: true, message: 'Orden de trabajo completada y guardada con éxito.' });
      }

      const mapped = mapToNeon(body);
      const finalId = mapped.id || `TK-${Date.now()}`;
      const now = Date.now();

      // [SEC C-08/C-10] El cliente_id se fuerza desde el token, ignorando el del payload.
      await sql`
        INSERT INTO work_orders (id, titulo, descripcion, prioridad, estado,
          equipo_tag, cliente_id, creado_por, asignado_a, fecha_creacion,
          uuid_sync, updated_at, data)
        VALUES (
          ${finalId}, ${mapped.titulo || ''}, ${mapped.descripcion || ''}, ${mapped.prioridad || 'media'},
          ${mapped.estado || 'abierto'}, ${mapped.equipo_tag || ''}, ${clienteIdFromToken},
          ${mapped.creado_por || ''}, ${mapped.asignado_a || ''}, ${mapped.fecha_creacion || new Date().toISOString()},
          ${mapped.uuid_sync || finalId}, ${mapped.updated_at || now}, ${JSON.stringify(body)}
        )
        ON CONFLICT (id) DO UPDATE SET
          titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion,
          prioridad = EXCLUDED.prioridad, estado = EXCLUDED.estado,
          asignado_a = EXCLUDED.asignado_a, fecha_cierre = EXCLUDED.fecha_cierre,
          updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
        WHERE (EXCLUDED.updated_at > work_orders.updated_at OR work_orders.updated_at IS NULL)
          AND work_orders.cliente_id = ${clienteIdFromToken}
      `;
      return res.json({ success: true, data: { id: finalId } });
    }

    if (method === 'PUT') {
      if (!id) {
        return res.status(400).json({ success: false, error: 'Falta identificador de orden de trabajo' });
      }
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
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken}
      `;
      return res.json({ success: true, message: 'Orden de trabajo actualizada' });
    }

    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Falta id' });
      const now = Date.now();
      await sql`
        UPDATE work_orders
        SET deleted_at = ${now}, updated_at = ${now}
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken}
      `;
      return res.json({ success: true, message: 'Orden de trabajo eliminada' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
