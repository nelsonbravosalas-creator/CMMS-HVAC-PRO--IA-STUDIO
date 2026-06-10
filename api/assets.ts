// CMMS HVAC PRO — assets API
// Consolida: api/assets.ts + api/assets/[id].ts
// Vercel function: /api/assets
// Tablas Neon: assets

import { getDb } from './_db.js';
import { verifyToken } from './_auth.js';

export default async function handler(req: any, res: any) {
  try {
    const userToken: any = verifyToken(req);
    if (!userToken) {
      return res.status(401).json({ success: false, error: 'No autorizado - falta token o es inválido' });
    }

    const clienteIdFromToken = userToken.clienteId || userToken.cliente_id || 'cliente-eecol-default-001';

    const sql = getDb();
    const { method, query, body } = req;
    const id = query.id || query.tag || query.uuid || body?.uuid_sync || body?.tag;

    if (method === 'GET') {
      if (id) {
        const rows = await sql`
          SELECT * FROM assets 
          WHERE (uuid_sync = ${id} OR tag = ${id}) 
            AND cliente_id = ${clienteIdFromToken} 
            AND deleted_at IS NULL
        `;
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
        }
        return res.json({ success: true, data: rows[0] });
      }

      const tag = query.tag;
      if (tag) {
        const rows = await sql`
          SELECT * FROM assets 
          WHERE tag = ${tag} 
            AND cliente_id = ${clienteIdFromToken} 
            AND deleted_at IS NULL
        `;
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
        }
        return res.json({ success: true, data: rows[0] });
      }

      const cliente_id = query.cliente_id || clienteIdFromToken;
      const rows = await sql`
        SELECT * FROM assets 
        WHERE cliente_id = ${cliente_id} 
          AND deleted_at IS NULL 
        ORDER BY tag ASC 
        LIMIT 1000
      `;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      if (!d.tag) return res.status(400).json({ error: 'El campo tag es obligatorio' });
      if (!d.nombre) return res.status(400).json({ error: 'El campo nombre es obligatorio' });
      
      let final_cliente_id = d.cliente_id || d.clienteId || clienteIdFromToken || 'cliente-eecol-default-001';
      let final_sucursal_id = d.sucursal_id || d.sucursalId || 'default-sucursal';

      // Fallback verification
      const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
      if (!clientExists || clientExists.length === 0) {
        final_cliente_id = 'cliente-eecol-default-001';
      }

      const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
      if (!branchExists || branchExists.length === 0) {
        final_sucursal_id = 'default-sucursal';
      }

      const now = Date.now();
      const uuid_sync = d.uuid_sync || d.tag;
      const lat = d.latitud !== undefined ? parseFloat(d.latitud) : (d.lat !== undefined ? parseFloat(d.lat) : null);
      const lng = d.longitud !== undefined ? parseFloat(d.longitud) : (d.lng !== undefined ? parseFloat(d.lng) : null);

      await sql`
        INSERT INTO assets (
          uuid_sync, tag, nombre, tipo, marca, modelo, serie, ubicacion, area,
          capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util,
          estado, ultimo_mantenimiento, proximo_mantenimiento, frecuencia_mantenimiento,
          horas_operacion, tecnicos, notas, cliente_id, sucursal_id, latitud, longitud,
          updated_at, created_at
        )
        VALUES (
          ${uuid_sync}, ${d.tag}, ${d.nombre || ''}, ${d.tipo || ''}, ${d.marca || ''},
          ${d.modelo || ''}, ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''},
          ${d.capacidad || ''}, ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''},
          ${d.fecha_instalacion || ''}, ${d.vida_util !== undefined ? parseInt(d.vida_util, 10) : 10}, 
          ${d.estado || 'operativo'}, ${d.ultimo_mantenimiento || ''}, ${d.proximo_mantenimiento || ''},
          ${d.frecuencia_mantenimiento || ''}, ${d.horas_operacion !== undefined ? parseInt(d.horas_operacion, 10) : 0}, 
          ${JSON.stringify(d.tecnicos || [])}::jsonb, ${d.notes || d.notas || ''},
          ${final_cliente_id}, ${final_sucursal_id}, ${lat}, ${lng},
          ${d.updated_at || now}, ${now}
        )
        ON CONFLICT (uuid_sync) DO UPDATE SET
          tag = EXCLUDED.tag, nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca,
          modelo = EXCLUDED.modelo, serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion,
          area = EXCLUDED.area, capacidad = EXCLUDED.capacidad, voltaje = EXCLUDED.voltaje,
          corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
          fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util,
          estado = EXCLUDED.estado, ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento,
          proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
          frecuencia_mantenimiento = EXCLUDED.frecuencia_mantenimiento,
          horas_operacion = EXCLUDED.horas_operacion, tecnicos = EXCLUDED.tecnicos,
          notas = EXCLUDED.notas, cliente_id = EXCLUDED.cliente_id,
          sucursal_id = EXCLUDED.sucursal_id, latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud,
          updated_at = EXCLUDED.updated_at
        WHERE EXCLUDED.updated_at > assets.updated_at OR assets.updated_at IS NULL
      `;
      return res.json({ success: true, data: { tag: d.tag, uuid_sync } });
    }

    if (method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'Falta identificador (id/tag)' });
      const d = body;

      let final_cliente_id = d.cliente_id || d.clienteId || clienteIdFromToken || 'cliente-eecol-default-001';
      let final_sucursal_id = d.sucursal_id || d.sucursalId || 'default-sucursal';

      // Fallback verification
      const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
      if (!clientExists || clientExists.length === 0) {
        final_cliente_id = 'cliente-eecol-default-001';
      }

      const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
      if (!branchExists || branchExists.length === 0) {
        final_sucursal_id = 'default-sucursal';
      }

      const now = Date.now();
      const lat = d.latitud !== undefined ? parseFloat(d.latitud) : (d.lat !== undefined ? parseFloat(d.lat) : null);
      const lng = d.longitud !== undefined ? parseFloat(d.longitud) : (d.lng !== undefined ? parseFloat(d.lng) : null);

      await sql`
        UPDATE assets SET
          tag = ${d.tag || id},
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
          vida_util = ${d.vida_util !== undefined ? parseInt(d.vida_util, 10) : 10},
          estado = ${d.estado || 'operativo'},
          ultimo_mantenimiento = ${d.ultimo_mantenimiento || ''},
          proximo_mantenimiento = ${d.proximo_mantenimiento || ''},
          frecuencia_mantenimiento = ${d.frecuencia_mantenimiento || ''},
          horas_operacion = ${d.horas_operacion !== undefined ? parseInt(d.horas_operacion, 10) : 0},
          tecnicos = ${JSON.stringify(d.tecnicos || [])}::jsonb,
          notas = ${d.notes || d.notas || ''},
          cliente_id = ${final_cliente_id},
          sucursal_id = ${final_sucursal_id},
          latitud = ${lat},
          longitud = ${lng},
          updated_at = ${d.updated_at || now}
        WHERE uuid_sync = ${id} OR tag = ${id}
      `;
      return res.json({ success: true, message: 'Equipo actualizado con éxito' });
    }

    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Falta identificador (id/tag)' });
      const now = Date.now();
      await sql`
        UPDATE assets 
        SET deleted_at = ${now}, estado = 'baja', updated_at = ${now} 
        WHERE uuid_sync = ${id} OR tag = ${id}
      `;
      return res.json({ success: true, message: 'Equipo eliminado/dado de baja' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error en /api/assets:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
