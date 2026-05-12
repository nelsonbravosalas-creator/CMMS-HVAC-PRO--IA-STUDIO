import express from "express";
import { createServer as createViteServer } from "vite";
import { neon } from "@neondatabase/serverless";
import path from "path";

// Neon DB connection
// Exigido por el usuario: utilizar exclusivamente DATABASE_URL
// Esto lanzará un error si falla, lo cual es de esperar en entorno local si no hay .env (deben setearlo en Vercel o Settings)
const getSql = () => {
  const dbUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres') ? process.env.DATABASE_URL : "postgresql://neondb_owner:npg_63SfsKCBdZwa@ep-billowing-mud-aq22ej6r-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  return neon(dbUrl);
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API ROUTES //
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // NUEVO FLUJO DE EQUIPOS SEGUN INSTRUCCIONES DEL ARQUITECTO
  app.get("/api/equipos", async (req, res) => {
    try {
      const sql = getSql();
      const tag = req.query.tag;
      if (tag) {
        const rows = await sql`SELECT * FROM equipos WHERE tag = ${tag}`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Equipo no encontrado" });
        return res.json({ success: true, data: rows[0] });
      } else {
        const rows = await sql`SELECT * FROM equipos`;
        return res.json({ success: true, data: rows });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/equipos", async (req, res) => {
    try {
      const sql = getSql();
      const tag = req.query.tag || req.body.tag;
      
      if (req.query.action === 'mantenimiento' || req.body.mantenimiento) {
        if (!tag) return res.status(400).json({ error: "Falta tag" });
        const { mantenimiento } = req.body;
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
        return res.json({ success: true, message: "Mantenimiento registrado." });
      } else {
        const { nombre, especificaciones, tecnicos, mantenimiento_history, ultimo_mantenimiento, estado } = req.body;
        
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
        return res.json({ success: true, data: resData[0] });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/equipos", async (req, res) => {
    try {
      const sql = getSql();
      const tag = req.query.tag;
      await sql`DELETE FROM equipos WHERE tag = ${tag}`;
      res.json({ success: true, message: "Registro borrado exitosamente." });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  const ALLOWED_TABLES = ['activos', 'usuarios', 'mantenimientos', 'tickets', 'informes', 'eventos', 'clientes', 'sucursales'];

  app.get("/api/:table", async (req, res) => {
    const table = req.params.table;
    try {
      const sql = getSql();
      let rows;
      switch (table) {
        case 'activos': rows = await sql`SELECT * FROM activos LIMIT 1000`; break;
        case 'usuarios': rows = await sql`SELECT * FROM usuarios LIMIT 1000`; break;
        case 'mantenimientos': rows = await sql`SELECT * FROM mantenimientos LIMIT 1000`; break;
        case 'tickets': rows = await sql`SELECT * FROM tickets LIMIT 1000`; break;
        case 'informes': rows = await sql`SELECT * FROM informes LIMIT 1000`; break;
        case 'eventos': rows = await sql`SELECT * FROM eventos LIMIT 1000`; break;
        case 'clientes': rows = await sql`SELECT * FROM clientes LIMIT 1000`; break;
        case 'sucursales': rows = await sql`SELECT * FROM sucursales LIMIT 1000`; break;
        default: return res.status(400).json({ error: "Invalid table" });
      }
      res.json({ success: true, data: rows });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/:table", async (req, res) => {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: "Invalid table" });
    try {
      const sql = getSql();
      const body = req.body;
      const id = body.id || body.tag || Date.now().toString(); // Ensure some generic ID
      
      // Update data field. We treat 'id' as primary key usually, or 'tag' for activos.
      // We will perform a simple generic insert updating data JSONB, but if it has specific columns, we could do more.
      // The easiest generic upsert is passing the object as JSONB if our tables are designed that way.
      // Let's explicitly support complete inserts for activos.
      if (table === 'activos') {
        const d = body;
        await sql`
          INSERT INTO activos (
            id, tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, 
            voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, 
            ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, notas, data
          ) VALUES (
            ${d.id || d.tag}, ${d.tag}, ${d.nombre}, ${d.tipo}, ${d.marca || ''}, ${d.modelo || ''}, 
            ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''}, ${d.capacidad || ''}, 
            ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''}, ${d.fecha_instalacion || ''}, 
            ${d.vida_util || 0}, ${d.estado || 'operativo'}, ${d.ultimo_mantenimiento || ''}, 
            ${d.proximo_mantenimiento || ''}, ${d.horas_operacion || 0}, ${d.notas || ''}, ${JSON.stringify(d)}
          ) ON CONFLICT (id) DO UPDATE SET
            nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca, modelo = EXCLUDED.modelo,
            serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion, area = EXCLUDED.area, capacidad = EXCLUDED.capacidad,
            voltaje = EXCLUDED.voltaje, corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
            fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util, estado = EXCLUDED.estado,
            ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento, proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
            horas_operacion = EXCLUDED.horas_operacion, notas = EXCLUDED.notas, data = EXCLUDED.data
        `;
      } else {
        const j = JSON.stringify(body);
        switch (table) {
          case 'usuarios': await sql`INSERT INTO usuarios (id, data) VALUES (${id}, ${j}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`; break;
          case 'mantenimientos': await sql`INSERT INTO mantenimientos (id, data) VALUES (${id}, ${j}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`; break;
          case 'tickets': await sql`INSERT INTO tickets (id, data) VALUES (${id}, ${j}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`; break;
          case 'informes': await sql`INSERT INTO informes (id, data) VALUES (${id}, ${j}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`; break;
          case 'eventos': await sql`INSERT INTO eventos (id, data) VALUES (${id}, ${j}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`; break;
          case 'clientes': await sql`INSERT INTO clientes (id, data) VALUES (${id}, ${j}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`; break;
          case 'sucursales': await sql`INSERT INTO sucursales (id, data) VALUES (${id}, ${j}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`; break;
        }
      }

      res.json({ success: true, data: body });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
