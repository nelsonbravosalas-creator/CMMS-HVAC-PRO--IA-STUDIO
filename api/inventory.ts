// CMMS HVAC PRO — inventory API
// Consolida: api/parts.ts + api/inventory.ts
// Vercel function: /api/inventory
// Tablas Neon: inventory

import { getDb } from './_db.js';
import { verifyToken } from './_auth.js';

function mapToNeon(frontData: any) {
  return {
    id: frontData.id,
    categoria: frontData.categoria || '',
    codigo: frontData.codigo || '',
    nombre: frontData.nombre || '',
    cantidad: Number(frontData.stock !== undefined ? frontData.stock : (frontData.cantidad !== undefined ? frontData.cantidad : 0)),
    unidad_medida: frontData.unidad || frontData.unidad_medida || '',
    cliente_id: frontData.cliente_id || frontData.clienteId || 'cliente-eecol-default-001',
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
    const userToken: any = verifyToken(req);
    if (!userToken) {
      return res.status(401).json({ success: false, error: 'No autorizado - falta token o es inválido' });
    }

    const clienteIdFromToken = userToken.clienteId || userToken.cliente_id || 'cliente-eecol-default-001';

    const sql = getDb();
    const { method, body, query } = req;
    const id = query.id || query.uuid || body?.uuid_sync || body?.id;

    if (method === 'GET') {
      if (id) {
        const rows = await sql`
          SELECT * FROM inventory 
          WHERE (id = ${id} OR uuid_sync = ${id}) 
            AND cliente_id = ${clienteIdFromToken} 
            AND deleted_at IS NULL
        `;
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Repuesto no encontrado' });
        }
        return res.json({ success: true, data: mapToDexie(rows[0]) });
      }

      const rows = await sql`
        SELECT * FROM inventory 
        WHERE cliente_id = ${clienteIdFromToken} 
          AND deleted_at IS NULL 
        ORDER BY nombre ASC 
        LIMIT 500
      `;
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
          const currentRows = await sql`SELECT cantidad FROM inventory WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken}`;
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
          WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken}
        `;
        return res.json({ success: true, message: 'Stock del repuesto ajustado con éxito.' });
      }

      const mapped = mapToNeon(body);
      const finalId = mapped.id || `PRT-${Date.now()}`;
      const now = Date.now();

      await sql`
        INSERT INTO inventory (
          uuid_sync, id, categoria, codigo, nombre, cantidad, unidad_medida,
          marca, modelo, estado, cliente_id, updated_at, created_at, data
        )
        VALUES (
          ${mapped.uuid_sync || finalId}, ${finalId}, ${mapped.categoria}, ${mapped.codigo}, 
          ${mapped.nombre}, ${mapped.cantidad}, ${mapped.unidad_medida},
          ${mapped.marca}, ${mapped.modelo}, ${mapped.estado}, 
          ${mapped.cliente_id || clienteIdFromToken || 'cliente-eecol-default-001'},
          ${mapped.updated_at || now}, ${now}, ${JSON.stringify(body)}
        )
        ON CONFLICT (uuid_sync) DO UPDATE SET
          id = EXCLUDED.id,
          categoria = EXCLUDED.categoria,
          codigo = EXCLUDED.codigo,
          nombre = EXCLUDED.nombre,
          cantidad = EXCLUDED.cantidad,
          unidad_medida = EXCLUDED.unidad_medida,
          marca = EXCLUDED.marca,
          modelo = EXCLUDED.modelo,
          estado = EXCLUDED.estado,
          cliente_id = EXCLUDED.cliente_id,
          updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data
        WHERE EXCLUDED.updated_at > inventory.updated_at OR inventory.updated_at IS NULL
      `;
      return res.json({ success: true, data: { id: finalId, uuid_sync: mapped.uuid_sync || finalId } });
    }

    if (method === 'PUT') {
      if (!id) {
        return res.status(400).json({ success: false, error: 'Falta identificador de repuesto' });
      }
      const d = body;
      const now = Date.now();
      const mapped = mapToNeon(d);

      await sql`
        UPDATE inventory SET
          categoria = ${mapped.categoria || ''},
          codigo = ${mapped.codigo || ''},
          nombre = ${mapped.nombre || ''},
          cantidad = ${mapped.cantidad || 0},
          unidad_medida = ${mapped.unidad_medida || ''},
          marca = ${mapped.marca || ''},
          modelo = ${mapped.modelo || ''},
          estado = ${mapped.estado || 'disponible'},
          cliente_id = ${mapped.cliente_id || clienteIdFromToken || 'cliente-eecol-default-001'},
          updated_at = ${now},
          data = ${JSON.stringify(d)}
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken}
      `;
      return res.json({ success: true, message: 'Repuesto actualizado' });
    }

    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Falta identificador' });
      const now = Date.now();
      await sql`
        UPDATE inventory 
        SET deleted_at = ${now}, updated_at = ${now} 
        WHERE (id = ${id} OR uuid_sync = ${id}) AND cliente_id = ${clienteIdFromToken}
      `;
      return res.json({ success: true, message: 'Repuesto eliminado' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
