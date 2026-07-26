// CMMS HVAC PRO — assets API
// Consolida: api/assets.ts + api/assets/[id].ts
// Vercel function: /api/assets
// Tablas Neon: assets

import { getDb } from '../db.js';
import { canWriteResource, getScopedTenantId, requireAuth } from '../auth.js';

export default async function handler(req: any, res: any) {
  try {
    const user: any = requireAuth(req, res);
    if (!user) return; // Ya se envió el error 401/403

    const sql = getDb();
    const { method, query, body } = req;
    const writeOperation = method === 'POST' ? 'insert' : method === 'DELETE' ? 'delete' : 'update';
    if (method !== 'GET' && !canWriteResource(user, 'assets', writeOperation)) {
      return res.status(403).json({ success: false, error: 'No autorizado - rol insuficiente' });
    }
    const tenantId = getScopedTenantId(
      user,
      req.headers['x-client-id'] || req.headers['x-cliente-id'] || query.cliente_id || query.clienteId || body?.cliente_id || body?.clienteId
    );
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'Tenant no asociado al token de sesión' });
    }
    const id = query.id || query.tag || query.uuid || body?.uuid_sync || body?.tag;

    if (method === 'GET') {
      if (id) {
        const rows = await sql`
          SELECT * FROM assets 
          WHERE (uuid_sync = ${id} OR tag = ${id})
            AND cliente_id = ${tenantId}
            AND deleted_at IS NULL
        `;
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
        }
        return res.json({ success: true, data: rows[0] });
      }
      const tag = query.tag;
      if (tag) {
        const rows = await sql`SELECT * FROM assets WHERE tag = ${tag} AND cliente_id = ${tenantId} AND deleted_at IS NULL`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
        return res.json({ success: true, data: rows[0] });
      }
      const rows = await sql`SELECT * FROM assets WHERE cliente_id = ${tenantId} AND deleted_at IS NULL ORDER BY tag ASC LIMIT 1000`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      if (!d.tag) return res.status(400).json({ error: 'El campo tag es obligatorio' });
      if (!d.nombre) return res.status(400).json({ error: 'El campo nombre es obligatorio' });
      
      const sucursal_id = d.sucursal_id || 'sucursal_defecto';
      const now = Date.now();
      
      await sql`
        INSERT INTO assets (tag, nombre, tipo, marca, modelo, serie, ubicacion, area,
          capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util,
          estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion,
          tecnicos, notas, cliente_id, sucursal_id, uuid_sync, updated_at, created_at)
        VALUES (
          ${d.tag}, ${d.nombre || ''}, ${d.tipo || ''}, ${d.marca || ''},
          ${d.modelo || ''}, ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''},
          ${d.capacidad || ''}, ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''},
          ${d.fecha_instalacion || ''}, ${d.vida_util || 0}, ${d.estado || 'operativo'},
          ${d.ultimo_mantenimiento || ''}, ${d.proximo_mantenimiento || ''},
          ${d.horas_operacion || 0}, ${JSON.stringify(d.tecnicos || [])}, ${d.notes || d.notas || ''},
          ${tenantId}, ${sucursal_id},
          ${d.uuid_sync || d.tag}, ${d.updated_at || now}, ${now}
        )
        ON CONFLICT (cliente_id, tag) DO UPDATE SET
          nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca,
          modelo = EXCLUDED.modelo, serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion,
          area = EXCLUDED.area, capacidad = EXCLUDED.capacidad, voltaje = EXCLUDED.voltaje,
          corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
          fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util,
          estado = EXCLUDED.estado, ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento,
          proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
          horas_operacion = EXCLUDED.horas_operacion, tecnicos = EXCLUDED.tecnicos,
          notas = EXCLUDED.notas, cliente_id = EXCLUDED.cliente_id,
          sucursal_id = EXCLUDED.sucursal_id, updated_at = EXCLUDED.updated_at
        WHERE EXCLUDED.updated_at > assets.updated_at OR assets.updated_at IS NULL
      `;
      return res.json({ success: true, data: { tag: d.tag } });
    }

    if (method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'Falta identificador (id/tag)' });
      const d = body;
      const now = Date.now();
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
          notas = ${d.notes || d.notas || ''},
          cliente_id = ${tenantId},
          sucursal_id = ${d.sucursal_id || 'sucursal_defecto'},
          updated_at = ${d.updated_at || now}
        WHERE (uuid_sync = ${id} OR tag = ${id}) AND cliente_id = ${tenantId}
      `;
      return res.json({ success: true, message: 'Equipo actualizado' });
    }

    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Falta identificador (id/tag)' });
      const now = Date.now();
      await sql`
        UPDATE assets 
        SET deleted_at = ${now}, estado = 'baja', updated_at = ${now} 
        WHERE (uuid_sync = ${id} OR tag = ${id}) AND cliente_id = ${tenantId}
      `;
      return res.json({ success: true, message: 'Equipo eliminado/dado de baja' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error en /api/assets:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
