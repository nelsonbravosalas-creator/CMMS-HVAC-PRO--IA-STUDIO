import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const dbUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres') 
    ? process.env.DATABASE_URL 
    : "postgresql://neondb_owner:npg_63SfsKCBdZwa@ep-billowing-mud-aq22ej6r-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const sql = neon(dbUrl);

  const { method, query, body } = req;

  // We can pass `tag` or `action` via query params to simulate multiple endpoints if needed
  const tag = query.tag || body?.tag;

  if (method === 'GET') {
    try {
      if (tag) {
        const rows = await sql`SELECT * FROM equipos WHERE tag = ${tag}`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Equipo no encontrado" });
        return res.status(200).json({ success: true, data: rows[0] });
      } else {
        const rows = await sql`SELECT * FROM equipos`;
        return res.status(200).json({ success: true, data: rows });
      }
    } catch (error) {
       console.error("GET Error:", error);
       return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (method === 'POST') {
    try {
      // Si la URL incluye action=mantenimiento o el body tiene mantenimiento,
      // actualizamos el historial
      if (query.action === 'mantenimiento' || body.mantenimiento) {
        if (!tag) return res.status(400).json({ error: "Falta el parámetro tag" });
        
        const mantenimiento = body.mantenimiento || body;
        const ts = new Date().toISOString();
        const nuevoMantenimiento = { ...mantenimiento, fecha: ts };
        
        const rows = await sql`SELECT notas FROM equipos WHERE tag = ${tag}`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Equipo no encontrado" });
        
        // As a fallback since we dropped mantenimiento_history JSON, let's append it as notes or just update ultimo_mantenimiento
        const currentNotas = rows[0].notas || '';
        const updatedNotas = `${currentNotas}\n- Mantenimiento: ${JSON.stringify(nuevoMantenimiento)}`;

        await sql`
          UPDATE equipos 
          SET ultimo_mantenimiento = ${ts}, notas = ${updatedNotas}
          WHERE tag = ${tag}
        `;
        return res.status(200).json({ success: true, message: "Mantenimiento registrado y sincronizado en Neon." });
      } else {
        // UPSERT general de equipo
        const { nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, tecnicos, notas } = body;
        if (!tag) return res.status(400).json({ error: "Falta tag" });

        const resData = await sql`
          INSERT INTO equipos (tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, tecnicos, notas)
          VALUES (${tag}, ${nombre}, ${tipo || ''}, ${marca || ''}, ${modelo || ''}, ${serie || ''}, ${ubicacion || ''}, ${area || ''}, ${capacidad || ''}, ${voltaje || ''}, ${corriente || ''}, ${refrigerante || ''}, ${fecha_instalacion || ''}, ${vida_util || 0}, ${estado || 'operativo'}, ${ultimo_mantenimiento || null}, ${proximo_mantenimiento || null}, ${horas_operacion || 0}, ${tecnicos ? JSON.stringify(tecnicos) : null}, ${notas || ''})
          ON CONFLICT (tag) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            tipo = EXCLUDED.tipo,
            marca = EXCLUDED.marca,
            modelo = EXCLUDED.modelo,
            serie = EXCLUDED.serie,
            ubicacion = EXCLUDED.ubicacion,
            area = EXCLUDED.area,
            capacidad = EXCLUDED.capacidad,
            voltaje = EXCLUDED.voltaje,
            corriente = EXCLUDED.corriente,
            refrigerante = EXCLUDED.refrigerante,
            fecha_instalacion = EXCLUDED.fecha_instalacion,
            vida_util = EXCLUDED.vida_util,
            estado = EXCLUDED.estado,
            ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento,
            proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
            horas_operacion = EXCLUDED.horas_operacion,
            tecnicos = EXCLUDED.tecnicos,
            notas = EXCLUDED.notas
          RETURNING *;
        `;
        return res.status(200).json({ success: true, data: resData[0] });
      }
    } catch (error) {
       console.error("POST Error:", error);
       return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (method === 'DELETE') {
     try {
       if (!tag) return res.status(400).json({ error: "Falta tag" });
       await sql`DELETE FROM equipos WHERE tag = ${tag}`;
       return res.status(200).json({ success: true, message: "Registro borrado exitosamente." });
     } catch (error) {
       console.error("DELETE Error:", error);
       return res.status(500).json({ success: false, error: error.message });
     }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}

