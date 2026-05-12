import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const dbUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres') 
    ? process.env.DATABASE_URL 
    : "postgresql://neondb_owner:npg_63SfsKCBdZwa@ep-billowing-mud-aq22ej6r-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const sql = neon(dbUrl);

  const { method, query, body } = req;

  // We can pass `tag` or `action` via query params to simulate multiple endpoints if needed, 
  // e.g. /api/equipos?tag=XYZ or /api/equipos?tag=XYZ&action=mantenimiento
  // But Vercel routes can also parse the URL
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
        
        const rows = await sql`SELECT mantenimiento_history FROM equipos WHERE tag = ${tag}`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Equipo no encontrado" });
        
        const history = Array.isArray(rows[0].mantenimiento_history) ? rows[0].mantenimiento_history : [];
        history.push(nuevoMantenimiento);
        
        await sql`
          UPDATE equipos 
          SET mantenimiento_history = ${JSON.stringify(history)}, 
              ultimo_mantenimiento = ${ts}
          WHERE tag = ${tag}
        `;
        return res.status(200).json({ success: true, message: "Mantenimiento registrado y sincronizado en Neon." });
      } else {
        // UPSERT general de equipo
        const { nombre, especificaciones, tecnicos, mantenimiento_history, ultimo_mantenimiento, estado } = body;
        if (!tag) return res.status(400).json({ error: "Falta tag" });

        const resData = await sql`
          INSERT INTO equipos (tag, nombre, especificaciones, tecnicos, mantenimiento_history, ultimo_mantenimiento, estado)
          VALUES (${tag}, ${nombre}, ${especificaciones ? JSON.stringify(especificaciones) : null}, ${tecnicos ? tecnicos : null}, ${mantenimiento_history ? JSON.stringify(mantenimiento_history) : null}, ${ultimo_mantenimiento || null}, ${estado || 'operativo'})
          ON CONFLICT (tag) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            especificaciones = EXCLUDED.especificaciones,
            tecnicos = EXCLUDED.tecnicos,
            mantenimiento_history = EXCLUDED.mantenimiento_history,
            ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento,
            estado = EXCLUDED.estado
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
