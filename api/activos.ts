import { getDb } from './_db';
import { requireRole } from './_auth';

export default async function handler(req: any, res: any) {
  try {
    const user = requireRole(['Administrador', 'Técnico_Líder', 'Ingeniero_Confiabilidad'])(req, res);
    if (!user) return; // Ya se envió el error 401/403

    const sql = getDb();
    const { method, query, body } = req;
    const tag = query.tag || body?.tag;

    if (method === 'GET') {
      if (tag) {
        const rows = await sql`SELECT * FROM activos WHERE tag = ${tag}`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
        return res.json({ success: true, data: rows[0] });
      }
      const rows = await sql`SELECT * FROM activos ORDER BY tag ASC LIMIT 1000`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      const d = body;
      if (!d.tag) return res.status(400).json({ error: 'Falta tag' });
      const now = Date.now();
      await sql`
        INSERT INTO activos (tag, nombre, tipo, marca, modelo, serie, ubicacion, area,
          capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util,
          estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion,
          tecnicos, notas, cliente_id, sucursal_id, uuid_sincro, modificado_en, creado_en)
        VALUES (
          ${d.tag}, ${d.nombre || ''}, ${d.tipo || ''}, ${d.marca || ''},
          ${d.modelo || ''}, ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''},
          ${d.capacidad || ''}, ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''},
          ${d.fecha_instalacion || ''}, ${d.vida_util || 0}, ${d.estado || 'operativo'},
          ${d.ultimo_mantenimiento || ''}, ${d.proximo_mantenimiento || ''},
          ${d.horas_operacion || 0}, ${JSON.stringify(d.tecnicos || [])}, ${d.notas || ''},
          ${d.cliente_id || ''}, ${d.sucursal_id || ''},
          ${d.uuid_sincro || d.tag}, ${d.modificado_en || now}, ${now}
        )
        ON CONFLICT (tag) DO UPDATE SET
          nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca,
          modelo = EXCLUDED.modelo, serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion,
          area = EXCLUDED.area, capacidad = EXCLUDED.capacidad, voltaje = EXCLUDED.voltaje,
          corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
          fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util,
          estado = EXCLUDED.estado, ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento,
          proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
          horas_operacion = EXCLUDED.horas_operacion, tecnicos = EXCLUDED.tecnicos,
          notas = EXCLUDED.notas, cliente_id = EXCLUDED.cliente_id,
          sucursal_id = EXCLUDED.sucursal_id, modificado_en = EXCLUDED.modificado_en
        WHERE EXCLUDED.modificado_en > activos.modificado_en OR activos.modificado_en IS NULL
      `;
      return res.json({ success: true, data: { tag: d.tag } });
    }

    if (method === 'DELETE') {
      if (!tag) return res.status(400).json({ error: 'Falta tag' });
      await sql`DELETE FROM activos WHERE tag = ${tag}`;
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error en /api/activos:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
