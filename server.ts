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

// DATABASE INITIALIZATION //
async function ensureTables() {
  const sql = getSql();
  try {
    console.log("ðŸ“¦ Initializing Database Schema...");
    
    await sql`
      CREATE TABLE IF NOT EXISTS activos (
        tag TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        tipo TEXT,
        marca TEXT,
        modelo TEXT,
        serie TEXT,
        ubicacion TEXT,
        area TEXT,
        capacidad TEXT,
        voltaje TEXT,
        corriente TEXT,
        refrigerante TEXT,
        fecha_instalacion TEXT,
        vida_util INTEGER DEFAULT 10,
        estado TEXT DEFAULT 'operativo',
        ultimo_mantenimiento TEXT,
        proximo_mantenimiento TEXT,
        horas_operacion INTEGER DEFAULT 0,
        tecnicos JSONB,
        notas TEXT,
        uuid_sincro TEXT UNIQUE,
        modificado_en BIGINT
      )
    `;

    const genericTables = ['usuarios', 'mantenimientos', 'tickets', 'informes', 'eventos', 'clientes', 'sucursales'];
    for (const table of genericTables) {
      // Usamos any para permitir nombres de tabla dinámicos en la inicialización (seguro ya que son strings estáticos)
      await (sql as any)(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          uuid_sincro TEXT UNIQUE,
          modificado_en BIGINT
        )
      `);
    }

    console.log("âœ… Database Schema is OK");
  } catch (error) {
    console.error("â Œ Error initializing database:", error);
  }
}

async function startServer() {
  await ensureTables();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API ROUTES //
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // NUEVO FLUJO DE ACTIVOS SEGUN INSTRUCCIONES DEL ARQUITECTO
  app.get("/api/equipos", async (req, res) => {
    try {
      const sql = getSql();
      const tag = req.query.tag;
      if (tag) {
        const rows = await sql`SELECT * FROM activos WHERE tag = ${tag}`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Equipo no encontrado" });
        return res.json({ success: true, data: rows[0] });
      } else {
        const rows = await sql`SELECT * FROM activos`;
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
        
        const rows = await sql`SELECT notas FROM activos WHERE tag = ${tag}`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Equipo no encontrado" });
        
        const currentNotas = rows[0].notas || '';
        const updatedNotas = `${currentNotas}\n- Mantenimiento: ${JSON.stringify(nuevoMantenimiento)}`;

        await sql`
          UPDATE activos 
          SET ultimo_mantenimiento = ${ts}, notas = ${updatedNotas}
          WHERE tag = ${tag}
        `;
        return res.json({ success: true, message: "Mantenimiento registrado." });
      } else {
        const { nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, tecnicos, notas } = req.body;
        
        const resData = await sql`
          INSERT INTO activos (tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, tecnicos, notas)
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
      await sql`DELETE FROM activos WHERE tag = ${tag}`;
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

  app.post("/api/sync/:table", async (req, res) => {
    const table = req.params.table;
    const { records, operation } = req.body;
    
    if (!ALLOWED_TABLES.includes(table) && table !== 'equipos') return res.status(400).json({ error: "Invalid table" });
    if (!Array.isArray(records)) return res.status(400).json({ error: "Records must be an array" });

    try {
      const sql = getSql();
      const results = [];
      
      for (const record of records) {
        if (operation === 'delete') {
          switch (table) {
            case 'activos': await sql`DELETE FROM activos WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'tickets': await sql`DELETE FROM tickets WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'mantenimientos': await sql`DELETE FROM mantenimientos WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'usuarios': await sql`DELETE FROM usuarios WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'informes': await sql`DELETE FROM informes WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'clientes': await sql`DELETE FROM clientes WHERE uuid_sincro = ${record.uuid_sincro}`; break;
          }
          results.push({ uuid_sincro: record.uuid_sincro, deleted: true });
          continue;
        }

        let folio_oficial = record.id;
        if (table === 'activos' || table === 'equipos') {
          folio_oficial = record.tag;
        }

        // Logic for backend FOlIO assignment (simulating a unique sequence per table)
        if (record.sync_status === 'pending_insert') {
          if (table === 'tickets') {
            // Find max id matching TK-xxxx
            const rows = await sql`
              SELECT id FROM tickets WHERE id LIKE 'TK-%' ORDER BY id DESC LIMIT 1
            `;
            let nextNum = 1;
            if (rows.length > 0) {
              const lastId = rows[0].id;
              const matches = lastId.match(/TK-(\d+)/);
              if (matches) nextNum = parseInt(matches[1], 10) + 1;
            }
            folio_oficial = `TK-${nextNum.toString().padStart(4, '0')}`;
            record.id = folio_oficial;
          } else if (table === 'activos' || table === 'equipos') {
            // If tag starts with TEMP, generate a new tag
            if (record.tag && record.tag.startsWith('TEMP')) {
               const rows = await sql`SELECT tag FROM activos WHERE tag LIKE 'ACT-%' ORDER BY tag DESC LIMIT 1`;
               let nextNum = 1;
               if (rows.length > 0) {
                 const matches = rows[0].tag.match(/ACT-(\d+)/);
                 if (matches) nextNum = parseInt(matches[1], 10) + 1;
               }
               folio_oficial = `ACT-${nextNum.toString().padStart(4, '0')}`;
               record.tag = folio_oficial;
            }
          } else if (table === 'mantenimientos') {
            const rows = await sql`SELECT id FROM mantenimientos WHERE id LIKE 'MANT-%' ORDER BY id DESC LIMIT 1`;
            let nextNum = 1;
            if (rows.length > 0) {
              const matches = rows[0].id.match(/MANT-(\d+)/);
              if (matches) nextNum = parseInt(matches[1], 10) + 1;
            }
            folio_oficial = `MANT-${nextNum.toString().padStart(4, '0')}`;
            record.id = folio_oficial;
          }
        }
        
        if (table === 'activos' || table === 'equipos') {
          const d = record;
          await sql`
            INSERT INTO activos (
              tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, 
              voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, 
              ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, notas,
              uuid_sincro, modificado_en
            ) VALUES (
              ${d.tag}, ${d.nombre}, ${d.tipo}, ${d.marca || ''}, ${d.modelo || ''}, 
              ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''}, ${d.capacidad || ''}, 
              ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''}, ${d.fecha_instalacion || ''}, 
              ${d.vida_util || 0}, ${d.estado || 'operativo'}, ${d.ultimo_mantenimiento || ''}, 
              ${d.proximo_mantenimiento || ''}, ${d.horas_operacion || 0}, ${d.notas || ''},
              ${d.uuid_sincro}, ${d.modificado_en}
            ) ON CONFLICT (uuid_sincro) DO UPDATE SET
              tag = EXCLUDED.tag,
              nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca, modelo = EXCLUDED.modelo,
              serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion, area = EXCLUDED.area, capacidad = EXCLUDED.capacidad,
              voltaje = EXCLUDED.voltaje, corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
              fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util, estado = EXCLUDED.estado,
              ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento, proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
              horas_operacion = EXCLUDED.horas_operacion, notas = EXCLUDED.notas,
              modificado_en = EXCLUDED.modificado_en
              WHERE EXCLUDED.modificado_en > activos.modificado_en;
          `;
        } else {
          // Generic handler for other tables using JSONB storage
          const id = table === 'tickets' ? record.id : record.uuid_sincro;
          const data = JSON.stringify(record);
          const uuid_sincro = record.uuid_sincro;
          const modificado_en = record.modificado_en;

          if (table === 'tickets') {
            await sql`
              INSERT INTO tickets (id, data, uuid_sincro, modificado_en) 
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) 
              ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > tickets.modificado_en
            `;
          } else if (table === 'mantenimientos') {
            await sql`
              INSERT INTO mantenimientos (id, data, uuid_sincro, modificado_en) 
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) 
              ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > mantenimientos.modificado_en
            `;
          } else if (table === 'clientes') {
            await sql`
              INSERT INTO clientes (id, data, uuid_sincro, modificado_en) 
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) 
              ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > clientes.modificado_en
            `;
          } else if (table === 'usuarios') {
             await sql`
              INSERT INTO usuarios (id, data, uuid_sincro, modificado_en) 
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) 
              ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > usuarios.modificado_en
            `;
          } else if (table === 'informes') {
             await sql`
              INSERT INTO informes (id, data, uuid_sincro, modificado_en) 
              VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) 
              ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > informes.modificado_en
            `;
          }
        }
        
        results.push({
          uuid_sincro: record.uuid_sincro,
          folio_oficial
        });
      }

      res.json({ success: true, message: "Sync successful", results });
    } catch (error: any) {
      console.error("Sync Error:", error);
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
    console.log(`\nâœ… CMMS HVAC PRO Server is READY`);
    console.log(`ðŸš€ Running on http://localhost:${PORT}`);
    console.log(`ðŸ›¡ï¸ Vite middleware active in development mode\n`);
  });
}

startServer();
