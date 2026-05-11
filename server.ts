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

  // Schema Initialization (Solo para tener un endpoint que configure la BD si lo necesitan)
  app.post("/api/init-db", async (req, res) => {
    try {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS activos (
          id TEXT PRIMARY KEY,
          tag_tecnico TEXT,
          nombre TEXT,
          tipo TEXT,
          ubicacion TEXT,
          estado TEXT,
          ultima_revision TIMESTAMP
        );
      `;
      res.json({ success: true, message: "Base de datos inicializada" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // UPSERT Activo
  app.post("/api/activos", async (req, res) => {
    try {
      const { id, tag_tecnico, nombre, tipo, ubicacion, estado } = req.body;
      const sql = getSql();
      const ultima_revision = new Date();

      await sql`
        INSERT INTO activos (id, tag_tecnico, nombre, tipo, ubicacion, estado, ultima_revision)
        VALUES (${id}, ${tag_tecnico}, ${nombre}, ${tipo}, ${ubicacion}, ${estado}, ${ultima_revision})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          tipo = EXCLUDED.tipo,
          ubicacion = EXCLUDED.ubicacion,
          estado = EXCLUDED.estado,
          ultima_revision = EXCLUDED.ultima_revision;
      `;
      res.json({ success: true, data: { id, status: "sincronizado" } });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET Activos Filtrados
  app.get("/api/activos", async (req, res) => {
    try {
      const sql = getSql();
      // Retorna los 50 más recientes ordenados por tag o los que se requieran
      const rows = await sql`SELECT * FROM activos ORDER BY tag_tecnico ASC LIMIT 100`;
      res.json({ success: true, data: rows });
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
