// CMMS HVAC PRO — clients API
// Consolida: api/clients.ts + api/branches.ts
// Vercel function: /api/clients
// Tablas Neon: clientes, sucursales

import { getDb } from './_db.js';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, query, body } = req;
    const isBranches = query.resource === 'branches' || query.resource === 'sucursales';
    const id = query.id || query.uuid || body?.uuid_sync || body?.id;

    if (isBranches) {
      if (method === 'GET') {
        const cliente_id = query.cliente_id || query.clienteId;
        if (cliente_id) {
          const rows = await sql`
            SELECT * FROM sucursales 
            WHERE cliente_id = ${cliente_id} AND deleted_at IS NULL 
            ORDER BY id ASC
          `;
          return res.json({ success: true, data: rows });
        }
        if (id) {
          const rows = await sql`
            SELECT * FROM sucursales 
            WHERE (id = ${id} OR uuid_sync = ${id}) AND deleted_at IS NULL
          `;
          if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Sucursal no encontrada' });
          }
          return res.json({ success: true, data: rows[0] });
        }
        const rows = await sql`SELECT * FROM sucursales WHERE deleted_at IS NULL ORDER BY id ASC`;
        return res.json({ success: true, data: rows });
      }

      if (method === 'POST') {
        const d = body;
        const finalId = d.id || `S-${Date.now()}`;
        const now = Date.now();
        const clienteId = d.cliente_id || d.clienteId;
        if (!clienteId) {
          return res.status(400).json({ success: false, error: 'El campo cliente_id es obligatorio' });
        }
        const strData = JSON.stringify(d);

        await sql`
          INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at)
          VALUES (${finalId}, ${clienteId}, ${d.uuid_sync || finalId}, ${strData}::jsonb, ${d.updated_at || now}, ${d.created_at || now})
          ON CONFLICT (id) DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at,
            cliente_id = EXCLUDED.cliente_id
        `;
        return res.json({ success: true, data: { id: finalId } });
      }

      if (method === 'PUT') {
        if (!id) {
          return res.status(400).json({ success: false, error: 'Falta id de sucursal' });
        }
        const d = body;
        const now = Date.now();
        const clienteId = d.cliente_id || d.clienteId;
        if (!clienteId) {
          return res.status(400).json({ success: false, error: 'El campo cliente_id es obligatorio' });
        }
        const strData = JSON.stringify(d);

        await sql`
          UPDATE sucursales SET
            cliente_id = ${clienteId},
            data = ${strData}::jsonb,
            updated_at = ${d.updated_at || now}
          WHERE id = ${id} OR uuid_sync = ${id}
        `;
        return res.json({ success: true, message: 'Sucursal actualizada con éxito.' });
      }

      if (method === 'DELETE') {
        if (!id) {
          return res.status(400).json({ success: false, error: 'Falta id de sucursal' });
        }
        const now = Date.now();
        await sql`
          UPDATE sucursales 
          SET deleted_at = ${now}, updated_at = ${now} 
          WHERE id = ${id} OR uuid_sync = ${id}
        `;
        return res.json({ success: true, message: 'Sucursal eliminada' });
      }
    } else {
      // Clientes
      if (method === 'GET') {
        if (id) {
          const rows = await sql`
            SELECT * FROM clientes 
            WHERE (id = ${id} OR uuid_sync = ${id}) AND deleted_at IS NULL
          `;
          if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
          }
          return res.json({ success: true, data: rows[0] });
        }

        const rows = await sql`SELECT * FROM clientes WHERE deleted_at IS NULL ORDER BY id ASC`;
        return res.json({ success: true, data: rows });
      }

      if (method === 'POST') {
        const d = body;
        const finalId = d.id || `C-${Date.now()}`;
        const now = Date.now();
        const strData = JSON.stringify(d);

        await sql`
          INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at)
          VALUES (${finalId}, ${d.uuid_sync || finalId}, ${strData}::jsonb, ${d.updated_at || now}, ${d.created_at || now})
          ON CONFLICT (id) DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
        `;
        return res.json({ success: true, data: { id: finalId } });
      }

      if (method === 'PUT') {
        if (!id) {
          return res.status(400).json({ success: false, error: 'Falta id de cliente' });
        }
        const d = body;
        const now = Date.now();
        const strData = JSON.stringify(d);

        await sql`
          UPDATE clientes SET
            data = ${strData}::jsonb,
            updated_at = ${d.updated_at || now}
          WHERE id = ${id} OR uuid_sync = ${id}
        `;
        return res.json({ success: true, message: 'Cliente actualizado con éxito.' });
      }

      if (method === 'DELETE') {
        if (!id) {
          return res.status(400).json({ success: false, error: 'Falta id de cliente' });
        }
        const now = Date.now();
        await sql`
          UPDATE clientes 
          SET deleted_at = ${now}, updated_at = ${now} 
          WHERE id = ${id} OR uuid_sync = ${id}
        `;
        return res.json({ success: true, message: 'Cliente de baja/eliminado' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error en /api/clients:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
