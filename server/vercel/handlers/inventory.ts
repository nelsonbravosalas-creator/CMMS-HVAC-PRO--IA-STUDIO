// CMMS HVAC PRO — inventory API
// Consolida: api/parts.ts + api/parts/[id].ts + api/parts/[id]/adjust.ts
// Vercel function: /api/inventory
// Tablas Neon: inventory

import { getDb } from '../db.js';
import { canWrite, getScopedTenantId, requireAuth } from '../auth.js';

function mapToNeon(frontData: any, tenantId: string) {
  return {
    id: frontData.id,
    categoria: frontData.categoria || '',
    codigo: frontData.codigo || '',
    nombre: frontData.nombre || '',
    cantidad: frontData.stock || 0,
    unidad_medida: frontData.unidad || '',
    cliente_id: tenantId,
    marca: frontData.marca || '',
    modelo: frontData.modelo || '',
    estado: frontData.estado || 'disponible',
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
    categoria: neonData.categoria || extraData.categoria || '',
    codigo: neonData.codigo || extraData.codigo || '',
    nombre: neonData.nombre || extraData.nombre || '',
    stock: neonData.cantidad !== undefined ? Number(neonData.cantidad) : (extraData.stock !== undefined ? Number(extraData.stock) : 0),
    unidad: neonData.unidad_medida || extraData.unidad || '',
    cliente_id: neonData.cliente_id || extraData.cliente_id || 'cliente-eecol-default-001',
    marca: neonData.marca || extraData.marca || '',
    modelo: neonData.modelo || extraData.modelo || '',
    estado: neonData.estado || extraData.estado || 'disponible',
    uuid_sync: neonData.uuid_sync,
    updated_at: Number(neonData.updated_at || Date.now())
  };
}

export default async function handler(req: any, res: any) {
  try {
    const user: any = requireAuth(req, res);
    if (!user) return;

    const sql = getDb();
    const { method, body, query } = req;
    if (method !== 'GET' && !canWrite(user)) {
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
          SELECT * FROM inventory 
          WHERE (id = ${id} OR uuid_sync = ${id})
            AND cliente_id = ${tenantId}
            AND deleted_at IS NULL
        `;
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Repuesto no encontrado' });
        }
        return res.json({ success: true, data: mapToDexie(rows[0]) });
      }

      const rows = await sql`SELECT * FROM inventory WHERE cliente_id = ${tenantId} AND deleted_at IS NULL ORDER BY nombre ASC LIMIT 500`;
      return res.json({ success: true, data: rows.map(mapToDexie) });
    }

    if (method === 'POST') {
      const action = query.action;
      if (action === 'adjust') {
        if (!id) {
          return res.status(400).json({ error: 'Falta identificador (id)' });
        }
        
        let amount = body.amount;
        if (amount === undefined && body.delta !== undefined) {
          const currentRows = await sql`SELECT cantidad FROM inventory WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}`;
          if (currentRows.length > 0) {
            amount = Number(currentRows[0].cantidad || 0) + Number(body.delta);
          } else {
            amount = Number(body.delta);
          }
        }

        if (amount === undefined) {
          return res.status(400).json({ error: 'Falta cantidad a ajustar (amount o delta)' });
        }

        const now = Date.now();
        await sql`
          UPDATE inventory 
          SET cantidad = ${Number(amount)}, 
              updated_at = ${now},
              data = jsonb_set(coalesce(data, '{}'::jsonb), '{stock}', ${String(amount)}::jsonb)
          WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
        `;
        return res.json({ success: true, message: 'Stock del repuesto ajustado con éxito.' });
      }

      const mapped = mapToNeon(body, tenantId);
      const finalId = mapped.id || `PRT-${Date.now()}`;
      const now = Date.now();

      await sql`
        INSERT INTO inventory (id, categoria, codigo, nombre, cantidad, unidad_medida,
          cliente_id, marca, modelo, estado, uuid_sync, updated_at, data)
        VALUES (
          ${finalId}, ${mapped.categoria}, ${mapped.codigo}, ${mapped.nombre},
          ${mapped.cantidad}, ${mapped.unidad_medida}, ${mapped.cliente_id},
          ${mapped.marca}, ${mapped.modelo}, ${mapped.estado},
          ${mapped.uuid_sync || finalId}, ${mapped.updated_at || now}, ${JSON.stringify(body)}
        )
        ON CONFLICT (id) DO UPDATE SET
          categoria = EXCLUDED.categoria, codigo = EXCLUDED.codigo,
          nombre = EXCLUDED.nombre, cantidad = EXCLUDED.cantidad,
          unidad_medida = EXCLUDED.unidad_medida, updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data
        WHERE inventory.cliente_id = EXCLUDED.cliente_id
          AND (EXCLUDED.updated_at > inventory.updated_at OR inventory.updated_at IS NULL)
      `;
      return res.json({ success: true, data: { id: finalId } });
    }

    if (method === 'PUT') {
      if (!id) {
        return res.status(400).json({ success: false, error: 'Falta identificador de repuesto' });
      }
      const d = body;
      const now = Date.now();
      await sql`
        UPDATE inventory SET
          categoria = ${d.categoria || ''},
          codigo = ${d.codigo || ''},
          nombre = ${d.nombre || ''},
          cantidad = ${d.stock || 0},
          unidad_medida = ${d.unidad || ''},
          updated_at = ${now},
          data = ${JSON.stringify(d)}
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
      `;
      return res.json({ success: true, message: 'Repuesto actualizado' });
    }

    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Falta identificador' });
      const now = Date.now();
      await sql`
        UPDATE inventory 
        SET deleted_at = ${now}, updated_at = ${now} 
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${tenantId}
      `;
      return res.json({ success: true, message: 'Repuesto eliminado' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
