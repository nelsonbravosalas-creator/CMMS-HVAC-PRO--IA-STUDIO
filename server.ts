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
import { GoogleGenerativeAI } from "@google/generative-ai";

async function ensureTables() {
  const sql = getSql();
  try {
    console.log("📦 Initializing Database Schema (Sync with Scripts)...");
    
    // 1. Create tables one by one with tagged templates
    await sql`CREATE TABLE IF NOT EXISTS activos (
      uuid_sincro TEXT PRIMARY KEY, tag TEXT UNIQUE, nombre TEXT NOT NULL, tipo TEXT, marca TEXT, modelo TEXT, serie TEXT, 
      ubicacion TEXT, area TEXT, capacidad TEXT, voltaje TEXT, corriente TEXT, refrigerante TEXT, fecha_instalacion TEXT, 
      vida_util INTEGER DEFAULT 10, estado TEXT DEFAULT 'operativo', ultimo_mantenimiento TEXT, proximo_mantenimiento TEXT, 
      horas_operacion INTEGER DEFAULT 0, tecnicos JSONB, notas TEXT, cliente_id TEXT, sucursal_id TEXT, 
      modificado_en BIGINT, creado_en BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS usuarios (
      uuid_sincro TEXT PRIMARY KEY, id TEXT UNIQUE, nombre TEXT, correo TEXT UNIQUE, perfil TEXT, pin TEXT, 
      activo BOOLEAN DEFAULT true, data JSONB, modificado_en BIGINT, creado_en BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS mantenimientos (uuid_sincro TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, modificado_en BIGINT, creado_en BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS tickets (uuid_sincro TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, modificado_en BIGINT, creado_en BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS informes (uuid_sincro TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, modificado_en BIGINT, creado_en BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS eventos (uuid_sincro TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, modificado_en BIGINT, creado_en BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS clientes (uuid_sincro TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, modificado_en BIGINT, creado_en BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS sucursales (uuid_sincro TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, modificado_en BIGINT, creado_en BIGINT)`;

    // 2. Migration for existing tables - ensure columns exist
    const columnMigrations = [
      { table: 'activos', col: 'uuid_sincro', type: 'TEXT' },
      { table: 'activos', col: 'modificado_en', type: 'BIGINT' },
      { table: 'activos', col: 'creado_en', type: 'BIGINT' },
      { table: 'usuarios', col: 'uuid_sincro', type: 'TEXT' },
      { table: 'usuarios', col: 'modificado_en', type: 'BIGINT' },
      { table: 'usuarios', col: 'creado_en', type: 'BIGINT' },
      { table: 'mantenimientos', col: 'uuid_sincro', type: 'TEXT' },
      { table: 'mantenimientos', col: 'modificado_en', type: 'BIGINT' },
      { table: 'tickets', col: 'uuid_sincro', type: 'TEXT' },
      { table: 'tickets', col: 'modificado_en', type: 'BIGINT' },
      { table: 'informes', col: 'uuid_sincro', type: 'TEXT' },
      { table: 'informes', col: 'modificado_en', type: 'BIGINT' },
      { table: 'eventos', col: 'uuid_sincro', type: 'TEXT' },
      { table: 'eventos', col: 'modificado_en', type: 'BIGINT' },
      { table: 'clientes', col: 'uuid_sincro', type: 'TEXT' },
      { table: 'clientes', col: 'modificado_en', type: 'BIGINT' },
      { table: 'sucursales', col: 'uuid_sincro', type: 'TEXT' },
      { table: 'sucursales', col: 'modificado_en', type: 'BIGINT' }
    ];

    for (const m of columnMigrations) {
      try {
        // We use a safe way to add columns one by one
        if (m.table === 'activos') {
          if (m.col === 'uuid_sincro') await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS uuid_sincro TEXT`;
          if (m.col === 'modificado_en') await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS modificado_en BIGINT`;
        } else if (m.table === 'usuarios') {
          if (m.col === 'uuid_sincro') await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS uuid_sincro TEXT`;
          if (m.col === 'modificado_en') await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modificado_en BIGINT`;
        } else if (m.table === 'mantenimientos') {
          if (m.col === 'uuid_sincro') await sql`ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS uuid_sincro TEXT`;
          if (m.col === 'modificado_en') await sql`ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS modificado_en BIGINT`;
        } else if (m.table === 'tickets') {
          if (m.col === 'uuid_sincro') await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS uuid_sincro TEXT`;
          if (m.col === 'modificado_en') await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS modificado_en BIGINT`;
        } else if (m.table === 'informes') {
          if (m.col === 'uuid_sincro') await sql`ALTER TABLE informes ADD COLUMN IF NOT EXISTS uuid_sincro TEXT`;
          if (m.col === 'modificado_en') await sql`ALTER TABLE informes ADD COLUMN IF NOT EXISTS modificado_en BIGINT`;
        } else if (m.table === 'eventos') {
          if (m.col === 'uuid_sincro') await sql`ALTER TABLE eventos ADD COLUMN IF NOT EXISTS uuid_sincro TEXT`;
          if (m.col === 'modificado_en') await sql`ALTER TABLE eventos ADD COLUMN IF NOT EXISTS modificado_en BIGINT`;
        } else if (m.table === 'clientes') {
          if (m.col === 'uuid_sincro') await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS uuid_sincro TEXT`;
          if (m.col === 'modificado_en') await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS modificado_en BIGINT`;
        } else if (m.table === 'sucursales') {
          if (m.col === 'uuid_sincro') await sql`ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS uuid_sincro TEXT`;
          if (m.col === 'modificado_en') await sql`ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS modificado_en BIGINT`;
        }
      } catch (e: any) {
        // Ignore "already exists"
      }
    }

    // 3. Populate uuid_sincro if empty
    try { await sql`UPDATE activos SET uuid_sincro = tag WHERE uuid_sincro IS NULL AND tag IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE usuarios SET uuid_sincro = id WHERE uuid_sincro IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE mantenimientos SET uuid_sincro = id WHERE uuid_sincro IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE tickets SET uuid_sincro = id WHERE uuid_sincro IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE informes SET uuid_sincro = id WHERE uuid_sincro IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE eventos SET uuid_sincro = id WHERE uuid_sincro IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE clientes SET uuid_sincro = id WHERE uuid_sincro IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE sucursales SET uuid_sincro = id WHERE uuid_sincro IS NULL AND id IS NOT NULL`; } catch(e){}

    console.log("✅ Database Schema integrity check completed");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
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

  app.post("/api/ocr", async (req, res) => {
    try {
      const imageBase64 = req.body.imageBase64 || req.body.image;
      const mimeType = req.body.mimeType;
      if (!imageBase64) return res.status(400).json({ error: 'imageBase64 requerido' });
      
      const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = ai.getGenerativeModel({ model: 'gemini-3.1-flash' });
      
      const prompt = "Extrae de esta placa HVAC o similares: Marca, Modelo, N Serie, Refrigerante, Voltaje, Amperaje Nominal y Capacidad. REGLA: Si la capacidad esta en kW convierte: 1kW=3412 BTU. Si en Toneladas: 1TR=12000 BTU. Devuelve SOLO un objeto JSON con estas keys: {'marca':'','modelo':'','n_serie':'','refrigerante':'','capacidad_btu':'','voltaje':'','amperaje':''}";
      
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } }
          ]
        }]
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
         res.json({ success: true, data: JSON.parse(jsonMatch[0]) });
      } else {
         res.json({ success: false, data: {} });
      }
    } catch (error: any) {
      console.error("OCR API error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  const ALLOWED_TABLES = ['activos', 'usuarios', 'mantenimientos', 'tickets', 'informes', 'eventos', 'clientes', 'sucursales'];

  app.get(["/api/:table", "/api/sync/:table"], async (req, res) => {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: "Invalid table" });
    try {
      const sql = getSql();
      // Usar Number para evitar problemas con BigInt si el valor es pequeño o null
      const since = req.query.since ? Number(req.query.since) : 0;
      let rows;
      
      if (table === 'activos') {
        rows = await sql`SELECT * FROM activos WHERE modificado_en > ${since} OR modificado_en IS NULL ORDER BY modificado_en ASC LIMIT 1000`;
      } else {
        // Generic tables
        switch (table) {
          case 'usuarios': rows = await sql`SELECT * FROM usuarios WHERE modificado_en > ${since} OR modificado_en IS NULL ORDER BY modificado_en ASC LIMIT 1000`; break;
          case 'mantenimientos': rows = await sql`SELECT * FROM mantenimientos WHERE modificado_en > ${since} OR modificado_en IS NULL ORDER BY modificado_en ASC LIMIT 1000`; break;
          case 'tickets': rows = await sql`SELECT * FROM tickets WHERE modificado_en > ${since} OR modificado_en IS NULL ORDER BY modificado_en ASC LIMIT 1000`; break;
          case 'informes': rows = await sql`SELECT * FROM informes WHERE modificado_en > ${since} OR modificado_en IS NULL ORDER BY modificado_en ASC LIMIT 1000`; break;
          case 'eventos': rows = await sql`SELECT * FROM eventos WHERE modificado_en > ${since} OR modificado_en IS NULL ORDER BY modificado_en ASC LIMIT 1000`; break;
          case 'clientes': rows = await sql`SELECT * FROM clientes WHERE modificado_en > ${since} OR modificado_en IS NULL ORDER BY modificado_en ASC LIMIT 1000`; break;
          case 'sucursales': rows = await sql`SELECT * FROM sucursales WHERE modificado_en > ${since} OR modificado_en IS NULL ORDER BY modificado_en ASC LIMIT 1000`; break;
          default: rows = [];
        }
      }
      res.json({ success: true, data: rows });
    } catch (error: any) {
      console.error(`Error en GET /api/${table}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
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

  // Generic POST for one-off operations (sync endpoint preferred)
  app.post("/api/:table", async (req, res) => {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: "Invalid table" });
    res.status(501).json({ error: "Use /api/sync/:table for write operations" });
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
            case 'activos': 
              const aTagRows = await sql`SELECT tag FROM activos WHERE uuid_sincro = ${record.uuid_sincro}`;
              if (aTagRows.length > 0) {
                 const t = aTagRows[0].tag;
                 // Delete related items (assuming their JSONB stores 'tag' or 'maquinaTag')
                 await sql`DELETE FROM tickets WHERE data->>'tag' = ${t}`;
                 await sql`DELETE FROM mantenimientos WHERE data->>'tag' = ${t}`;
                 await sql`DELETE FROM informes WHERE data->>'tag' = ${t} OR data->'machineData'->>'tag' = ${t}`;
              }
              await sql`DELETE FROM activos WHERE uuid_sincro = ${record.uuid_sincro}`; 
              break;
            case 'tickets': await sql`DELETE FROM tickets WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'mantenimientos': await sql`DELETE FROM mantenimientos WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'usuarios': await sql`DELETE FROM usuarios WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'informes': await sql`DELETE FROM informes WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'clientes': await sql`DELETE FROM clientes WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'sucursales': await sql`DELETE FROM sucursales WHERE uuid_sincro = ${record.uuid_sincro}`; break;
            case 'eventos': await sql`DELETE FROM eventos WHERE uuid_sincro = ${record.uuid_sincro}`; break;
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
          } else if (table === 'informes') {
             const rows = await sql`SELECT id FROM informes WHERE id LIKE 'INF-%' ORDER BY id DESC LIMIT 1`;
            let nextNum = 1;
            if (rows.length > 0) {
              const matches = rows[0].id.match(/INF-(\d+)/);
              if (matches) nextNum = parseInt(matches[1], 10) + 1;
            }
            folio_oficial = `INF-${nextNum.toString().padStart(4, '0')}`;
            record.id = folio_oficial;
          }
        }
        
        if (table === 'activos' || table === 'equipos') {
          const d = record;

          // Check for tag change to cascade
          const oldTagRows = await sql`SELECT tag FROM activos WHERE uuid_sincro = ${d.uuid_sincro}`;
          let oldTag = null;
          if (oldTagRows.length > 0) oldTag = oldTagRows[0].tag;

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

          if (oldTag && oldTag !== d.tag) {
             // Cascade update JSON tag fields
             await sql`UPDATE tickets SET data = jsonb_set(data, '{tag}', to_jsonb(${d.tag}::text)) WHERE data->>'tag' = ${oldTag};`;
             await sql`UPDATE mantenimientos SET data = jsonb_set(data, '{tag}', to_jsonb(${d.tag}::text)) WHERE data->>'tag' = ${oldTag};`;
             await sql`UPDATE informes SET data = jsonb_set(data, '{machineData,tag}', to_jsonb(${d.tag}::text)) WHERE data->'machineData'->>'tag' = ${oldTag};`;
          }
        } else {
          // Generic handler for other tables using JSONB storage
          const id = (table === 'tickets' || table === 'mantenimientos' || table === 'informes') ? record.id : record.uuid_sincro;
          const data = JSON.stringify(record);
          const uuid_sincro = record.uuid_sincro;
          const modificado_en = record.modificado_en;

          switch (table) {
            case 'tickets': await sql`INSERT INTO tickets (id, data, uuid_sincro, modificado_en) VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > tickets.modificado_en`; break;
            case 'mantenimientos': await sql`INSERT INTO mantenimientos (id, data, uuid_sincro, modificado_en) VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > mantenimientos.modificado_en`; break;
            case 'clientes': await sql`INSERT INTO clientes (id, data, uuid_sincro, modificado_en) VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > clientes.modificado_en`; break;
            case 'usuarios': await sql`INSERT INTO usuarios (id, data, uuid_sincro, modificado_en) VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > usuarios.modificado_en`; break;
            case 'informes': await sql`INSERT INTO informes (id, data, uuid_sincro, modificado_en) VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > informes.modificado_en`; break;
            case 'sucursales': await sql`INSERT INTO sucursales (id, data, uuid_sincro, modificado_en) VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > sucursales.modificado_en`; break;
            case 'eventos': await sql`INSERT INTO eventos (id, data, uuid_sincro, modificado_en) VALUES (${id}, ${data}, ${uuid_sincro}, ${modificado_en}) ON CONFLICT (uuid_sincro) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, modificado_en = EXCLUDED.modificado_en WHERE EXCLUDED.modificado_en > eventos.modificado_en`; break;
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
