// CMMS HVAC PRO — work-orders API
// Consolida: api/work-orders.ts + api/work-orders/[id].ts + api/work-orders/[id]/complete.ts + api/work_orders.ts
// Vercel function: /api/work-orders
// Tablas Neon: work_orders

import { getDb } from '../db.js';
import { canWriteResource, getScopedTenantId, requireAuth } from '../auth.js';

const WORK_ORDER_TRANSITIONS: Record<string, string[]> = {
  abierto: ['en_progreso'],
  en_progreso: ['completado'],
  completado: ['firmado'],
  firmado: ['cerrado'],
  cerrado: []
};

const normalizeWorkOrderState = (value: unknown) => {
  const aliases: Record<string, string> = { abierta: 'abierto', completada: 'completado', firmada: 'firmado' };
  const state = String(value || 'abierto').toLowerCase();
  return aliases[state] || state;
};

function mapToNeon(frontData: any, tenantId: string) {
  return {
    id: frontData.id,
    titulo: frontData.titulo,
    descripcion: frontData.descripcion,
    prioridad: frontData.prioridad,
    estado: normalizeWorkOrderState(frontData.estado),
    equipo_tag: frontData.equipo_tag || frontData.equipoTag,
    cliente_id: tenantId,
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
    const user: any = requireAuth(req, res);
    if (!user) return;

    const sql = getDb();
    const { method, body, query } = req;
    const writeOperation = method === 'POST' ? 'insert' : method === 'DELETE' ? 'delete' : 'update';
    if (method !== 'GET' && !canWriteResource(user, 'work_orders', writeOperation)) {
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
          SELECT * FROM work_orders 
          WHERE (id = ${id} OR uuid_sync = ${id})
            AND cliente_id = ${tenantId}
            AND deleted_at IS NULL
        `;
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Orden de trabajo no encontrada' });
        }
        return res.json({ success: true, data: mapToDexie(rows[0]) });
      }

      const rows = await sql`SELECT * FROM work_orders WHERE cliente_id = ${tenantId} AND deleted_at IS NULL ORDER BY fecha_creacion DESC LIMIT 500`;
      const mapped = rows.map(mapToDexie);
      return res.json({ success: true, data: mapped });
    }

    if (method === 'POST') {
      const action = query.action;
      if (action && ['start', 'complete', 'sign', 'close'].includes(action)) {
        if (!id) {
          return res.status(400).json({ error: 'Falta identificador (id)' });
        }
        const targetByAction: Record<string, string> = {
          start: 'en_progreso',
          complete: 'completado',
          sign: 'firmado',
          close: 'cerrado'
        };
        const existing = await sql`
          SELECT estado FROM work_orders
          WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
          LIMIT 1
        `;
        if (!existing[0]) {
          return res.status(404).json({ success: false, error: 'Orden de trabajo no encontrada' });
        }
        const currentState = normalizeWorkOrderState(existing[0].estado);
        const targetState = targetByAction[action];
        if (!WORK_ORDER_TRANSITIONS[currentState]?.includes(targetState)) {
          return res.status(409).json({
            success: false,
            error: 'INVALID_TRANSITION',
            currentState,
            targetState
          });
        }
        if (targetState === 'cerrado' && String(user.perfil || '').toLowerCase() !== 'administrador') {
          return res.status(403).json({ success: false, error: 'Solo el administrador puede cerrar la OT' });
        }
        const now = Date.now();
        await sql`
          UPDATE work_orders 
          SET estado = ${targetState},
              fecha_cierre = ${targetState === 'cerrado' ? new Date().toISOString() : null},
              updated_at = ${now},
              data = jsonb_set(coalesce(data, '{}'::jsonb), '{estado}', to_jsonb(${targetState}::text))
          WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
        `;
        return res.json({ success: true, estado: targetState });
      }

      const mapped = mapToNeon(body, tenantId);
      const finalId = mapped.id || `TK-${Date.now()}`;
      const now = Date.now();

      await sql`
        INSERT INTO work_orders (id, titulo, descripcion, prioridad, estado,
          equipo_tag, cliente_id, creado_por, asignado_a, fecha_creacion,
          uuid_sync, updated_at, data)
        VALUES (
          ${finalId}, ${mapped.titulo || ''}, ${mapped.descripcion || ''}, ${mapped.prioridad || 'media'},
          ${mapped.estado || 'abierto'}, ${mapped.equipo_tag || ''}, ${mapped.cliente_id || ''},
          ${mapped.creado_por || ''}, ${mapped.asignado_a || ''}, ${mapped.fecha_creacion || new Date().toISOString()},
          ${mapped.uuid_sync || finalId}, ${mapped.updated_at || now}, ${JSON.stringify(body)}
        )
        ON CONFLICT (id) DO UPDATE SET
          titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion,
          prioridad = EXCLUDED.prioridad, estado = EXCLUDED.estado,
          asignado_a = EXCLUDED.asignado_a, fecha_cierre = EXCLUDED.fecha_cierre,
          updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
        WHERE work_orders.cliente_id = EXCLUDED.cliente_id
          AND (EXCLUDED.updated_at > work_orders.updated_at OR work_orders.updated_at IS NULL)
      `;
      return res.json({ success: true, data: { id: finalId } });
    }

    if (method === 'PUT') {
      if (!id) {
        return res.status(400).json({ success: false, error: 'Falta identificador de orden de trabajo' });
      }
      const d = body;
      const now = Date.now();
      const existing = await sql`
        SELECT estado FROM work_orders
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
        LIMIT 1
      `;
      const currentState = normalizeWorkOrderState(existing[0]?.estado);
      const nextState = normalizeWorkOrderState(d.estado || currentState);
      if (nextState !== currentState && !WORK_ORDER_TRANSITIONS[currentState]?.includes(nextState)) {
        return res.status(409).json({ success: false, error: 'INVALID_TRANSITION', currentState, targetState: nextState });
      }
      if (nextState === 'cerrado' && String(user.perfil || '').toLowerCase() !== 'administrador') {
        return res.status(403).json({ success: false, error: 'Solo el administrador puede cerrar la OT' });
      }
      await sql`
        UPDATE work_orders SET
          titulo = ${d.titulo || ''},
          descripcion = ${d.descripcion || ''},
          prioridad = ${d.prioridad || 'media'},
          estado = ${nextState},
          equipo_tag = ${d.equipo_tag || d.equipoTag || ''},
          asignado_a = ${d.asignado_a || d.asignadoA || ''},
          updated_at = ${d.updated_at || now},
          data = ${JSON.stringify(d)}
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
      `;
      return res.json({ success: true, message: 'Orden de trabajo actualizada' });
    }

    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Falta id' });
      const now = Date.now();
      await sql`
        UPDATE work_orders 
        SET deleted_at = ${now}, updated_at = ${now} 
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
      `;
      return res.json({ success: true, message: 'Orden de trabajo eliminada' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
