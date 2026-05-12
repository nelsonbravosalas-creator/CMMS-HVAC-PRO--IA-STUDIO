import express from "express";
import { createServer as createViteServer } from "vite";
import { neon } from "@neondatabase/serverless";
import path from "path";

// Neon DB connection
// Exigido por el usuario: utilizar exclusivamente DATABASE_URL
// Esto lanzará un error si falla, lo cual es de esperar en entorno local si no hay .env (deben setearlo en Vercel o Settings)
const getSql = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
  }
  return neon(process.env.DATABASE_URL);
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API ROUTES //
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
