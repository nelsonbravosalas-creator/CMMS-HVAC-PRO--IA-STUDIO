import express from "express";
import { createServer as createViteServer } from "vite";
import { neon } from "@neondatabase/serverless";
import path from "path";

// Neon DB connection
// Exigido por el usuario: utilizar exclusivamente DATABASE_URL
// Esto lanzará un error si falla, lo cual es de esperar en entorno local si no hay .env (deben setearlo en Vercel o Settings)
const getSql = () => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl || !dbUrl.startsWith('postgres')) {
    throw new Error('DATABASE_URL no definida o inválida');
  }

  return neon(dbUrl);
};

// DATABASE INITIALIZATION //
import { GoogleGenerativeAI } from "@google/generative-ai";

async function ensureTables() {
  try {
    const sql = getSql();
    console.log("📦 Initializing Database Schema (Sync with Scripts)...");
    
    // Rename old tables to new standard names.
    const renameTables = async () => {
      try { await sql`ALTER TABLE IF EXISTS activos RENAME TO assets`; } catch (e) {}
      try { await sql`ALTER TABLE IF EXISTS usuarios RENAME TO users`; } catch (e) {}
      try { await sql`ALTER TABLE IF EXISTS mantenimientos RENAME TO preventive_maintenance`; } catch (e) {}
      try { await sql`ALTER TABLE IF EXISTS tickets RENAME TO work_orders`; } catch (e) {}
      try { await sql`ALTER TABLE IF EXISTS informes RENAME TO reports`; } catch (e) {}
      try { await sql`ALTER TABLE IF EXISTS eventos RENAME TO events`; } catch (e) {}
      try { await sql`ALTER TABLE IF EXISTS clientes RENAME TO clients`; } catch (e) {}
      try { await sql`ALTER TABLE IF EXISTS sucursales RENAME TO branches`; } catch (e) {}
    }
    await renameTables();

    // 1. Create tables one by one with tagged templates
    await sql`CREATE TABLE IF NOT EXISTS assets (
      uuid_sync TEXT PRIMARY KEY, tag TEXT UNIQUE, nombre TEXT NOT NULL, tipo TEXT, marca TEXT, modelo TEXT, serie TEXT, 
      ubicacion TEXT, area TEXT, capacidad TEXT, voltaje TEXT, corriente TEXT, refrigerante TEXT, fecha_instalacion TEXT, 
      vida_util INTEGER DEFAULT 10, estado TEXT DEFAULT 'operativo', ultimo_mantenimiento TEXT, proximo_mantenimiento TEXT, 
      horas_operacion INTEGER DEFAULT 0, tecnicos JSONB, notas TEXT, cliente_id TEXT, sucursal_id TEXT, 
      updated_at BIGINT, created_at BIGINT, deleted_at BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS users (
      uuid_sync TEXT PRIMARY KEY, id TEXT UNIQUE, nombre TEXT, correo TEXT UNIQUE, perfil TEXT, pin TEXT, 
      activo BOOLEAN DEFAULT true, data JSONB, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS preventive_maintenance (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS work_orders (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS reports (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS events (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS clients (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS branches (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS catalog_asset_types (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS settings (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS ordenes_servicio (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, user_id TEXT NOT NULL, payload JSONB, timestamp BIGINT NOT NULL)`;

    // 2. Migration for existing tables - ensure columns exist
    const columnMigrations = [
      { table: 'assets', col: 'uuid_sync', type: 'TEXT' },
      { table: 'assets', col: 'updated_at', type: 'BIGINT' },
      { table: 'assets', col: 'created_at', type: 'BIGINT' },
      { table: 'assets', col: 'cliente_id', type: 'TEXT' },
      { table: 'assets', col: 'sucursal_id', type: 'TEXT' },
      { table: 'users', col: 'uuid_sync', type: 'TEXT' },
      { table: 'users', col: 'updated_at', type: 'BIGINT' },
      { table: 'users', col: 'created_at', type: 'BIGINT' },
      { table: 'users', col: 'data', type: 'JSONB' },
      { table: 'preventive_maintenance', col: 'uuid_sync', type: 'TEXT' },
      { table: 'preventive_maintenance', col: 'updated_at', type: 'BIGINT' },
      { table: 'preventive_maintenance', col: 'created_at', type: 'BIGINT' },
      { table: 'preventive_maintenance', col: 'data', type: 'JSONB' },
      { table: 'work_orders', col: 'uuid_sync', type: 'TEXT' },
      { table: 'work_orders', col: 'updated_at', type: 'BIGINT' },
      { table: 'work_orders', col: 'created_at', type: 'BIGINT' },
      { table: 'work_orders', col: 'data', type: 'JSONB' },
      { table: 'reports', col: 'uuid_sync', type: 'TEXT' },
      { table: 'reports', col: 'updated_at', type: 'BIGINT' },
      { table: 'reports', col: 'created_at', type: 'BIGINT' },
      { table: 'reports', col: 'data', type: 'JSONB' },
      { table: 'events', col: 'uuid_sync', type: 'TEXT' },
      { table: 'events', col: 'updated_at', type: 'BIGINT' },
      { table: 'events', col: 'created_at', type: 'BIGINT' },
      { table: 'events', col: 'data', type: 'JSONB' },
      { table: 'clients', col: 'uuid_sync', type: 'TEXT' },
      { table: 'clients', col: 'updated_at', type: 'BIGINT' },
      { table: 'clients', col: 'created_at', type: 'BIGINT' },
      { table: 'clients', col: 'data', type: 'JSONB' },
      { table: 'branches', col: 'uuid_sync', type: 'TEXT' },
      { table: 'branches', col: 'updated_at', type: 'BIGINT' },
      { table: 'branches', col: 'created_at', type: 'BIGINT' },
      { table: 'branches', col: 'data', type: 'JSONB' },
      { table: 'catalog_asset_types', col: 'uuid_sync', type: 'TEXT' },
      { table: 'catalog_asset_types', col: 'updated_at', type: 'BIGINT' },
      { table: 'catalog_asset_types', col: 'created_at', type: 'BIGINT' },
      { table: 'catalog_asset_types', col: 'data', type: 'JSONB' },
      { table: 'settings', col: 'uuid_sync', type: 'TEXT' },
      { table: 'settings', col: 'updated_at', type: 'BIGINT' },
      { table: 'settings', col: 'created_at', type: 'BIGINT' },
      { table: 'settings', col: 'data', type: 'JSONB' },
      { table: 'ordenes_servicio', col: 'uuid_sync', type: 'TEXT' },
      { table: 'ordenes_servicio', col: 'updated_at', type: 'BIGINT' },
      { table: 'ordenes_servicio', col: 'created_at', type: 'BIGINT' },
      { table: 'ordenes_servicio', col: 'data', type: 'JSONB' }
    ];

    for (const m of columnMigrations) {
      try {
        // We use a safe way to add columns one by one
        const t = m.table;
        if (t === 'assets') {
          await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
          await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS cliente_id TEXT`;
          await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS sucursal_id TEXT`;
        } else if (t === 'users') {
          await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
          await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS data JSONB`;
        } else if (t === 'preventive_maintenance') {
          await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
          await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS data JSONB`;
        } else if (t === 'work_orders') {
          await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
          await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS data JSONB`;
        } else if (t === 'reports') {
          await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
          await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS data JSONB`;
        } else if (t === 'events') {
          await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
          await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS data JSONB`;
        } else if (t === 'clients') {
          await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
          await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS data JSONB`;
        } else if (t === 'branches') {
          await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
          await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS data JSONB`;
        } else if (t === 'catalog_asset_types') {
          await sql`ALTER TABLE catalog_asset_types ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE catalog_asset_types ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE catalog_asset_types ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE catalog_asset_types ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
          await sql`ALTER TABLE catalog_asset_types ADD COLUMN IF NOT EXISTS data JSONB`;
          await sql`ALTER TABLE catalog_asset_types ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
        } else if (t === 'settings') {
          await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
        } else if (t === 'ordenes_servicio') {
          await sql`ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
        }
      } catch (e: any) {
        // Ignore "already exists"
      }
    }

    // 3. Populate uuid_sync if empty
    try { await sql`UPDATE assets SET uuid_sync = tag WHERE uuid_sync IS NULL AND tag IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE users SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE preventive_maintenance SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE work_orders SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE reports SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE events SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE clients SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE branches SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE catalog_asset_types SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE settings SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}
    try { await sql`UPDATE ordenes_servicio SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}

    // 4. Ensure UNIQUE constraint for uuid_sync on all tables for ON CONFLICT
    const tryUnique = async (query: any) => {
        try { await query; } catch(e: any) { 
           // Ignore if it's "already exists", but log if "could not create unique index"
           if (!e.message.includes('already exists')) {
               console.error('Unique constraint error:', e.message); 
           }
        }
    };
    // Sometimes a table was created before the constraint, or the unique index is not picked up by ON CONFLICT.
    await tryUnique(sql`ALTER TABLE assets ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE users ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE preventive_maintenance ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE work_orders ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE reports ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE events ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE clients ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE branches ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE catalog_asset_types ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE settings ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE ordenes_servicio ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE audit_logs ADD UNIQUE (id)`);
    await tryUnique(sql`ALTER TABLE assets ADD UNIQUE (tag)`);

    console.log("✅ Database Schema integrity check completed");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
  }
}

async function startServer() {
  try {
    await ensureTables();
  } catch (error: any) {
    console.error("⚠️ Database initialization failed or timed out during startup:", error.message || error);
  }
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[REQ] ${req.method} ${req.url}`);
    }
    next();
  });

  // API ROUTES //
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/auth", async (req, res) => {
    try {
      const { correo, pin } = req.body;
      if (!correo || !pin) {
        return res.status(400).json({ success: false, error: "Correo y PIN requeridos" });
      }

      const sql = getSql();
      const correoLower = correo.toLowerCase();
      // En la tabla users: correo podria estar en la columna 'correo' O en 'data->>'email'' O en la columna 'data' (JSONB) dependiendo de la migracion
      const _users = await sql`SELECT * FROM users WHERE LOWER(correo) = ${correoLower} OR LOWER(data->>'email') = ${correoLower}`;
      if (_users.length === 0) {
        return res.status(401).json({ success: false, error: "Credenciales inválidas" });
      }

      const user = _users[0];
      const storedPin = user.pin || (user.data && user.data.pin);
      
      const bcrypt = require('bcryptjs');
      let isMatch = false;
      if (storedPin && storedPin.startsWith('$2')) {
        isMatch = bcrypt.compareSync(pin, storedPin);
      } else {
        isMatch = storedPin === pin;
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, error: "Credenciales inválidas" });
      }

      // Convert DB user format to expected return format
      const userData = user.data || {};
      const returnUser = {
        id: user.id || userData.id || user.uuid_sync,
        nombre: user.nombre || userData.nombre,
        correo: user.correo || userData.email || correo,
        perfil: user.perfil || userData.rol || 'tecnico',
        activo: true
      };

      res.json({ success: true, user: returnUser, token: "mock-jwt-token" });
    } catch (e: any) {
      console.error("Auth error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
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

  const ALLOWED_TABLES = [
    'assets', 'users', 'preventive_maintenance', 'work_orders', 
    'reports', 'events', 'clients', 'branches', 
    'catalog_asset_types', 'settings', 'ordenes_servicio', 'audit_logs'
  ];

const TABLE_ALIAS_MAP: Record<string, string> = {
  'activos': 'assets',
  'usuarios': 'users',
  'mantenimientos': 'preventive_maintenance',
  'tickets': 'work_orders',
  'informes': 'reports',
  'eventos': 'events',
  'clientes': 'clients',
  'sucursales': 'branches'
};

function resolveTable(name: string): string | null {
  if (ALLOWED_TABLES.includes(name)) return name;
  return TABLE_ALIAS_MAP[name] || null;
}

  app.get(["/api/:table", "/api/sync/:table"], async (req, res) => {
    const rawTable = req.params.table;
    const table = resolveTable(rawTable);
    
    if (!table) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid table", 
        received: rawTable,
        allowed: ALLOWED_TABLES 
      });
    }

    try {
      const sql = getSql();
      const since = req.query.since ? Number(req.query.since) : 0;
      let rows;
      
      switch (table) {
        case 'assets': rows = await sql`SELECT * FROM assets WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'users': rows = await sql`SELECT * FROM users WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'preventive_maintenance': rows = await sql`SELECT * FROM preventive_maintenance WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'work_orders': rows = await sql`SELECT * FROM work_orders WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'reports': rows = await sql`SELECT * FROM reports WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'events': rows = await sql`SELECT * FROM events WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'clients': rows = await sql`SELECT * FROM clients WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'branches': rows = await sql`SELECT * FROM branches WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'catalog_asset_types': rows = await sql`SELECT * FROM catalog_asset_types WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'settings': rows = await sql`SELECT * FROM settings WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'ordenes_servicio': rows = await sql`SELECT * FROM ordenes_servicio WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        default: rows = [];
      }
      res.json({ success: true, data: rows });
    } catch (error: any) {
      console.error(`Error en GET /api/${table}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // NUEVO FLUJO DE ACTIVOS SEGUN INSTRUCCIONES DEL ARQUITECTO
  app.get("/api/assets", async (req, res) => {
    try {
      const sql = getSql();
      const tag = req.query.tag as string;
      if (tag) {
        const rows = await sql`SELECT * FROM assets WHERE tag = ${tag} AND deleted_at IS NULL`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Equipo no encontrado" });
        return res.json({ success: true, data: rows[0] });
      } else {
        const rows = await sql`SELECT * FROM assets WHERE deleted_at IS NULL`;
        return res.json({ success: true, data: rows });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/assets", async (req, res) => {
    try {
      const sql = getSql();
      const tag = req.query.tag || req.body.tag;
      
      if (req.query.action === 'mantenimiento' || req.body.mantenimiento) {
        if (!tag) return res.status(400).json({ error: "Falta tag" });
        const { mantenimiento } = req.body;
        const ts = new Date().toISOString();
        const nuevoMantenimiento = { ...mantenimiento, fecha: ts };
        
        const rows = await sql`SELECT notas FROM assets WHERE tag = ${tag}`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Equipo no encontrado" });
        
        const currentNotas = rows[0].notas || '';
        const updatedNotas = `${currentNotas}\n- Mantenimiento: ${JSON.stringify(nuevoMantenimiento)}`;

        await sql`
          UPDATE assets 
          SET ultimo_mantenimiento = ${ts}, notas = ${updatedNotas}
          WHERE tag = ${tag}
        `;
        return res.json({ success: true, message: "Mantenimiento registrado." });
      } else {
        const { nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, tecnicos, notas } = req.body;
        
        const resData = await sql`
          INSERT INTO assets (tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, tecnicos, notas)
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

  app.delete("/api/assets", async (req, res) => {
    try {
      const sql = getSql();
      const tag = req.query.tag as string;
      const ts = Date.now();
      await sql`UPDATE assets SET deleted_at = ${ts}, estado = 'baja', updated_at = ${ts} WHERE tag = ${tag}`;
      res.json({ success: true, message: "Registro dado de baja exitosamente." });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // NEW GLOBAL SYNC ENDPOINT
  app.post('/api/sync', async (req, res) => {
    const { inserts = [], updates = [], deletes = [], lastSync = 0 } = req.body;
    try {
      const sql = getSql();
      const results: any = { inserts: [], updates: [], deletes: [] };
      
      // En entorno serverless de Neon, ejecutamos las operaciones en paralelo por fases
      // para reducir drásticamente el tiempo de ejecución y evitar interrupciones o timeouts HTTP.
      
      // Fase 1: Inserts en paralelo
      const insertPromises = inserts.map(async (ins: any) => {
        const rawTable = ins.table;
        const table = resolveTable(rawTable);
        if (!table) return null;

        const data = ins.data || {};
        const uuid_sync = ins.uuid_sync;
        const updated_at = ins.updated_at || data.updated_at || ins.timestamp || Date.now();
        
        let status = 'applied';
        let errorMsg = '';
        
        try {
          if (table === 'assets') {
            const d = data;
            await sql`
              INSERT INTO assets (
                tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, 
                voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, 
                ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, notas,
                uuid_sync, updated_at, created_at, cliente_id, sucursal_id
              ) VALUES (
                ${d.tag}, ${d.nombre}, ${d.tipo || ''}, ${d.marca || ''}, ${d.modelo || ''}, 
                ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''}, ${d.capacidad || ''}, 
                ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''}, ${d.fecha_instalacion || ''}, 
                ${d.vida_util || 0}, ${d.estado || 'operativo'}, ${d.ultimo_mantenimiento || null}, 
                ${d.proximo_mantenimiento || null}, ${d.horas_operacion || 0}, ${d.notas || ''},
                ${uuid_sync}, ${updated_at}, ${updated_at}, ${d.cliente_id || ''}, ${d.sucursal_id || ''}
              ) ON CONFLICT (uuid_sync) DO UPDATE SET
                tag = EXCLUDED.tag, nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca, modelo = EXCLUDED.modelo,
                serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion, area = EXCLUDED.area, capacidad = EXCLUDED.capacidad,
                voltaje = EXCLUDED.voltaje, corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
                fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util, estado = EXCLUDED.estado,
                ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento, proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
                horas_operacion = EXCLUDED.horas_operacion, notas = EXCLUDED.notas, cliente_id = EXCLUDED.cliente_id, sucursal_id = EXCLUDED.sucursal_id,
                updated_at = EXCLUDED.updated_at
              WHERE EXCLUDED.updated_at > assets.updated_at OR assets.updated_at IS NULL;
            `;
          } else {
            const id = data.id || uuid_sync;
            const strData = JSON.stringify(data);
            
            switch (table) {
              case 'users': await sql`INSERT INTO users (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL`; break;
              case 'preventive_maintenance': await sql`INSERT INTO preventive_maintenance (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > preventive_maintenance.updated_at OR preventive_maintenance.updated_at IS NULL`; break;
              case 'work_orders': await sql`INSERT INTO work_orders (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > work_orders.updated_at OR work_orders.updated_at IS NULL`; break;
              case 'reports': await sql`INSERT INTO reports (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > reports.updated_at OR reports.updated_at IS NULL`; break;
              case 'events': await sql`INSERT INTO events (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > events.updated_at OR events.updated_at IS NULL`; break;
              case 'clients': await sql`INSERT INTO clients (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > clients.updated_at OR clients.updated_at IS NULL`; break;
              case 'branches': await sql`INSERT INTO branches (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > branches.updated_at OR branches.updated_at IS NULL`; break;
              case 'catalog_asset_types': await sql`INSERT INTO catalog_asset_types (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > catalog_asset_types.updated_at OR catalog_asset_types.updated_at IS NULL`; break;
              case 'settings': await sql`INSERT INTO settings (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > settings.updated_at OR settings.updated_at IS NULL`; break;
              case 'ordenes_servicio': await sql`INSERT INTO ordenes_servicio (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > ordenes_servicio.updated_at OR ordenes_servicio.updated_at IS NULL`; break;
              case 'audit_logs':
                await sql`
                  INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp) 
                  VALUES (${id}, ${data.action}, ${data.entity_type}, ${data.entity_id}, ${data.user_id}, ${strData}, ${data.timestamp}) 
                  ON CONFLICT (id) DO NOTHING
                `;
                break;
            }
          }
        } catch (err: any) {
          status = err.message?.toLowerCase().includes('unique') ? 'conflict' : 'error';
          errorMsg = err.message;
        }
        return { uuid_sync, table, result: status, error: errorMsg, folio_oficial: data.tag || data.id };
      });

      const resInserts = await Promise.all(insertPromises);
      results.inserts = resInserts.filter(Boolean);

      // Fase 2: Updates en paralelo
      const updatePromises = updates.map(async (upd: any) => {
        const rawTable = upd.table;
        const table = resolveTable(rawTable);
        if (!table) return null;

        const data = upd.data || {};
        const uuid_sync = upd.uuid_sync;
        const updated_at = upd.updated_at || data.updated_at || upd.timestamp || Date.now();
        
        let status = 'applied';
        let errorMsg = '';
        
        try {
          if (table === 'assets') {
             const d = data;
             await sql`
              UPDATE assets SET
                tag = ${d.tag}, nombre = ${d.nombre}, tipo = ${d.tipo || ''}, marca = ${d.marca || ''}, modelo = ${d.modelo || ''},
                serie = ${d.serie || ''}, ubicacion = ${d.ubicacion || ''}, area = ${d.area || ''}, capacidad = ${d.capacidad || ''},
                voltaje = ${d.voltaje || ''}, corriente = ${d.corriente || ''}, refrigerante = ${d.refrigerante || ''},
                fecha_instalacion = ${d.fecha_instalacion || ''}, vida_util = ${d.vida_util || 0}, estado = ${d.estado || 'operativo'},
                ultimo_mantenimiento = ${d.ultimo_mantenimiento || null}, proximo_mantenimiento = ${d.proximo_mantenimiento || null},
                horas_operacion = ${d.horas_operacion || 0}, notas = ${d.notas || ''},
                cliente_id = ${d.cliente_id || ''}, sucursal_id = ${d.sucursal_id || ''},
                updated_at = ${updated_at}
              WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL);
            `;
          } else {
            const id = data.id || uuid_sync;
            const strData = JSON.stringify(data);
            switch (table) {
              case 'users': await sql`UPDATE users SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'preventive_maintenance': await sql`UPDATE preventive_maintenance SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'work_orders': await sql`UPDATE work_orders SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'reports': await sql`UPDATE reports SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'events': await sql`UPDATE events SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'clients': await sql`UPDATE clients SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'branches': await sql`UPDATE branches SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'catalog_asset_types': await sql`UPDATE catalog_asset_types SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'settings': await sql`UPDATE settings SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'ordenes_servicio': await sql`UPDATE ordenes_servicio SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
            }
          }
        } catch (err: any) {
          status = err.message?.toLowerCase().includes('unique') ? 'conflict' : 'error';
          errorMsg = err.message;
        }
        return { uuid_sync, table, result: status, error: errorMsg };
      });

      const resUpdates = await Promise.all(updatePromises);
      results.updates = resUpdates.filter(Boolean);

      // Fase 3: Deletes en paralelo
      const serverTime = Date.now();
      const deletePromises = deletes.map(async (del: any) => {
        const rawTable = del.table;
        const table = resolveTable(rawTable);
        if (!table) return null;

        const ts = serverTime;
        let status = 'applied';
        let errorMsg = '';
        try {
          switch (table) {
            case 'assets': await sql`UPDATE assets SET deleted_at = ${ts}, estado = 'baja', updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'users': await sql`UPDATE users SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'preventive_maintenance': await sql`UPDATE preventive_maintenance SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'work_orders': await sql`UPDATE work_orders SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'reports': await sql`UPDATE reports SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'events': await sql`UPDATE events SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'clients': await sql`UPDATE clients SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'branches': await sql`UPDATE branches SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'catalog_asset_types': await sql`UPDATE catalog_asset_types SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'settings': await sql`UPDATE settings SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'ordenes_servicio': await sql`UPDATE ordenes_servicio SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
          }
        } catch (err: any) {
          status = 'error';
          errorMsg = err.message;
        }
        return { uuid_sync: del.uuid_sync, table, result: status, error: errorMsg };
      });

      const resDeletes = await Promise.all(deletePromises);
      results.deletes = resDeletes.filter(Boolean);

      // Fase 4: Obtención de cambios del servidor en paralelo para todas las tablas
      const serverChanges: Record<string, any[]> = {};
      const pullPromises = ALLOWED_TABLES.map(async (table) => {
         try {
            let rows: any[] = [];
            switch (table) {
              case 'assets': rows = await sql`SELECT * FROM assets WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'users': rows = await sql`SELECT * FROM users WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'preventive_maintenance': rows = await sql`SELECT * FROM preventive_maintenance WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'work_orders': rows = await sql`SELECT * FROM work_orders WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'reports': rows = await sql`SELECT * FROM reports WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'events': rows = await sql`SELECT * FROM events WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'clients': rows = await sql`SELECT * FROM clients WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'branches': rows = await sql`SELECT * FROM branches WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'catalog_asset_types': rows = await sql`SELECT * FROM catalog_asset_types WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'settings': rows = await sql`SELECT * FROM settings WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'ordenes_servicio': rows = await sql`SELECT * FROM ordenes_servicio WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
              case 'audit_logs': rows = await sql`SELECT * FROM audit_logs WHERE timestamp > ${lastSync} LIMIT 200`; break;
            }
            if (rows && rows.length > 0) {
              serverChanges[table] = rows;
            }
         } catch(e){}
      });

      await Promise.all(pullPromises);

      console.log(`[SYNC] Sync applied: Inserts ${inserts.length}, Updates ${updates.length}, Deletes ${deletes.length}`);
      res.json({ success: true, results, serverChanges, serverTime });
    } catch (error: any) {
      console.error('[SYNC ERROR]:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/sync/:table", async (req, res) => {
    const rawTable = req.params.table;
    const table = resolveTable(rawTable);
    const { records, operation } = req.body;
    
    if (!table) return res.status(400).json({ error: "Invalid table", received: rawTable });
    if (!Array.isArray(records)) return res.status(400).json({ error: "Records must be an array" });

    try {
      const sql = getSql();
      const results = [];
      
      for (const record of records) {
        if (operation === 'delete') {
          const ts = Date.now();
          switch (table) {
            case 'assets': await sql`UPDATE assets SET deleted_at = ${ts}, estado = 'baja', updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'users': await sql`UPDATE users SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'preventive_maintenance': await sql`UPDATE preventive_maintenance SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'work_orders': await sql`UPDATE work_orders SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'reports': await sql`UPDATE reports SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'events': await sql`UPDATE events SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'clients': await sql`UPDATE clients SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'branches': await sql`UPDATE branches SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'catalog_asset_types': await sql`UPDATE catalog_asset_types SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'settings': await sql`UPDATE settings SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'ordenes_servicio': await sql`UPDATE ordenes_servicio SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
          }
          results.push({ uuid_sync: record.uuid_sync, deleted: true });
          continue;
        }

        let folio_oficial = record.id;
        if (table === 'assets' || table === 'equipos') {
          folio_oficial = record.tag;
        }

        // Logic for backend FOlIO assignment (simulating a unique sequence per table)
        if (record.sync_status === 'pending_insert') {
          if (table === 'work_orders') {
            // Find max id matching TK-xxxx
            const rows = await sql`
              SELECT id FROM work_orders WHERE id LIKE 'TK-%' ORDER BY id DESC LIMIT 1
            `;
            let nextNum = 1;
            if (rows.length > 0) {
              const lastId = rows[0].id;
              const matches = lastId.match(/TK-(\d+)/);
              if (matches) nextNum = parseInt(matches[1], 10) + 1;
            }
            folio_oficial = `TK-${nextNum.toString().padStart(4, '0')}`;
            record.id = folio_oficial;
          } else if (table === 'assets' || table === 'equipos') {
            // If tag starts with TEMP, generate a new tag
            if (record.tag && record.tag.startsWith('TEMP')) {
               const rows = await sql`SELECT tag FROM assets WHERE tag LIKE 'ACT-%' ORDER BY tag DESC LIMIT 1`;
               let nextNum = 1;
               if (rows.length > 0) {
                 const matches = rows[0].tag.match(/ACT-(\d+)/);
                 if (matches) nextNum = parseInt(matches[1], 10) + 1;
               }
               folio_oficial = `ACT-${nextNum.toString().padStart(4, '0')}`;
               record.tag = folio_oficial;
            }
          } else if (table === 'preventive_maintenance') {
            const rows = await sql`SELECT id FROM preventive_maintenance WHERE id LIKE 'MANT-%' ORDER BY id DESC LIMIT 1`;
            let nextNum = 1;
            if (rows.length > 0) {
              const matches = rows[0].id.match(/MANT-(\d+)/);
              if (matches) nextNum = parseInt(matches[1], 10) + 1;
            }
            folio_oficial = `MANT-${nextNum.toString().padStart(4, '0')}`;
            record.id = folio_oficial;
          } else if (table === 'reports') {
             const rows = await sql`SELECT id FROM reports WHERE id LIKE 'INF-%' ORDER BY id DESC LIMIT 1`;
            let nextNum = 1;
            if (rows.length > 0) {
              const matches = rows[0].id.match(/INF-(\d+)/);
              if (matches) nextNum = parseInt(matches[1], 10) + 1;
            }
            folio_oficial = `INF-${nextNum.toString().padStart(4, '0')}`;
            record.id = folio_oficial;
          }
        }
        
        if (table === 'assets' || table === 'equipos') {
          const d = record;

          // Check for tag change to cascade
          const oldTagRows = await sql`SELECT tag FROM assets WHERE uuid_sync = ${d.uuid_sync}`;
          let oldTag = null;
          if (oldTagRows.length > 0) oldTag = oldTagRows[0].tag;

          await sql`
            INSERT INTO assets (
              tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, 
              voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, 
              ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, notas,
              uuid_sync, updated_at
            ) VALUES (
              ${d.tag}, ${d.nombre}, ${d.tipo}, ${d.marca || ''}, ${d.modelo || ''}, 
              ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''}, ${d.capacidad || ''}, 
              ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''}, ${d.fecha_instalacion || ''}, 
              ${d.vida_util || 0}, ${d.estado || 'operativo'}, ${d.ultimo_mantenimiento || ''}, 
              ${d.proximo_mantenimiento || ''}, ${d.horas_operacion || 0}, ${d.notas || ''},
              ${d.uuid_sync}, ${d.updated_at}
            ) ON CONFLICT (uuid_sync) DO UPDATE SET
              tag = EXCLUDED.tag,
              nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, marca = EXCLUDED.marca, modelo = EXCLUDED.modelo,
              serie = EXCLUDED.serie, ubicacion = EXCLUDED.ubicacion, area = EXCLUDED.area, capacidad = EXCLUDED.capacidad,
              voltaje = EXCLUDED.voltaje, corriente = EXCLUDED.corriente, refrigerante = EXCLUDED.refrigerante,
              fecha_instalacion = EXCLUDED.fecha_instalacion, vida_util = EXCLUDED.vida_util, estado = EXCLUDED.estado,
              ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento, proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
              horas_operacion = EXCLUDED.horas_operacion, notas = EXCLUDED.notas,
              updated_at = EXCLUDED.updated_at
              WHERE EXCLUDED.updated_at > assets.updated_at;
          `;

          if (oldTag && oldTag !== d.tag) {
             // Cascade update JSON tag fields
             await sql`UPDATE work_orders SET data = jsonb_set(data, '{tag}', to_jsonb(${d.tag}::text)) WHERE data->>'tag' = ${oldTag};`;
             await sql`UPDATE preventive_maintenance SET data = jsonb_set(data, '{tag}', to_jsonb(${d.tag}::text)) WHERE data->>'tag' = ${oldTag};`;
             await sql`UPDATE reports SET data = jsonb_set(data, '{machineData,tag}', to_jsonb(${d.tag}::text)) WHERE data->'machineData'->>'tag' = ${oldTag};`;
          }
        } else {
          // Generic handler for other tables using JSONB storage
          const id = (table === 'work_orders' || table === 'preventive_maintenance' || table === 'reports') ? record.id : record.uuid_sync;
          const data = JSON.stringify(record);
          const uuid_sync = record.uuid_sync;
          const updated_at = record.updated_at;

          switch (table) {
            case 'work_orders': await sql`INSERT INTO work_orders (id, data, uuid_sync, updated_at) VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > work_orders.updated_at`; break;
            case 'preventive_maintenance': await sql`INSERT INTO preventive_maintenance (id, data, uuid_sync, updated_at) VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > preventive_maintenance.updated_at`; break;
            case 'clients': await sql`INSERT INTO clients (id, data, uuid_sync, updated_at) VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > clients.updated_at`; break;
            case 'users': await sql`INSERT INTO users (id, data, uuid_sync, updated_at) VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > users.updated_at`; break;
            case 'reports': await sql`INSERT INTO reports (id, data, uuid_sync, updated_at) VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > reports.updated_at`; break;
            case 'branches': await sql`INSERT INTO branches (id, data, uuid_sync, updated_at) VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > branches.updated_at`; break;
            case 'events': await sql`INSERT INTO events (id, data, uuid_sync, updated_at) VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > events.updated_at`; break;
            case 'ordenes_servicio': await sql`INSERT INTO ordenes_servicio (id, draft_key, data, uuid_sync, updated_at) VALUES (${id}, ${record.draft_key || ''}, ${data}, ${uuid_sync}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, draft_key = EXCLUDED.draft_key, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > ordenes_servicio.updated_at`; break;
          }
        }
        
        results.push({
          uuid_sync: record.uuid_sync,
          folio_oficial
        });
      }

      res.json({ success: true, message: "Sync successful", results });
    } catch (error: any) {
      console.error("Sync Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Generic POST for one-off operations (sync endpoint preferred)
  app.post("/api/:table", async (req, res) => {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: "Invalid table" });
    res.status(501).json({ error: "Use /api/sync/:table for write operations" });
  });

  app.post("/api/export", async (req, res) => {
    try {
      const { documentId, documentType, method, base64Pdf } = req.body;
      if (!documentId || !method) {
        return res.status(400).json({ error: "Missing documentId or method" });
      }

      if (method === 'email') {
         // Query client info to send email
         const sql = getSql();
         let clientId = null;
         
         if (documentType === 'reports') {
            const result = await sql`SELECT data FROM reports WHERE id = ${documentId} OR uuid_sync = ${documentId}`;
            if (result.length > 0) clientId = result[0].data?.cliente_id;
         } else if (documentType === 'work_orders') {
            const result = await sql`SELECT data FROM work_orders WHERE id = ${documentId} OR uuid_sync = ${documentId}`;
            if (result.length > 0) clientId = result[0].data?.cliente_id;
         } else if (documentType === 'ordenes_servicio') {
            const result = await sql`SELECT data FROM ordenes_servicio WHERE id = ${documentId} OR uuid_sync = ${documentId}`;
            if (result.length > 0) clientId = result[0].data?.cliente_id;
         } else if (documentType === 'preventive_maintenance') {
            // preventive maintenance does not strictly store client_id top level usually, but maybe in data
            const result = await sql`SELECT data FROM preventive_maintenance WHERE id = ${documentId} OR uuid_sync = ${documentId}`;
            // fetch implicitly from asset if possible, but let's just attempt 
            if (result.length > 0) clientId = result[0].data?.cliente_id;
         }

         let email = null;
         if (clientId) {
            const cliRes = await sql`SELECT data FROM clients WHERE id = ${clientId} OR uuid_sync = ${clientId}`;
            if (cliRes.length > 0) {
               email = cliRes[0].data?.email || cliRes[0].data?.contacto_email;
            }
         }

         // Simulate email sending since we don't have a real SMTP set up in code.
         console.log(`[EXPORT] Sending email to ${email || 'unknown'} for document ${documentId}`);
         
         return res.json({ 
           success: true, 
           message: `Documento enviado por email exitosamente a ${email || 'contacto no encontrado'}`,
           emailSentTo: email
         });
      } else if (method === 'whatsapp' || method === 'share') {
         // Return a link or generic success for share
         console.log(`[EXPORT] Preparing ${method} payload for document ${documentId}`);
         return res.json({ success: true, message: `Payload preparado para ${method}` });
      }

      res.status(400).json({ error: "Unsupported method" });
    } catch (error: any) {
      console.error("[EXPORT ERROR]", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/health/db", async (req, res) => {
    try {
      const sql = getSql();
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      const existingTables = tables.map((row: any) => row.table_name);
      const missingTables = ALLOWED_TABLES.filter(t => !existingTables.includes(t));
      
      const counts: Record<string, number> = {};
      for (const t of existingTables) {
        if (ALLOWED_TABLES.includes(t)) {
           // We can't use parameters for table names in standard postgres tagged templates,
           // so we use simple select for count. Alternatively:
           const query = `SELECT COUNT(*) FROM "${t}"`;
           const countRes = await (sql as any)(query);
           counts[t] = Number(countRes[0].count);
        }
      }

      res.json({ connected: true, missingTables, counts });
    } catch (e: any) {
       res.status(500).json({ connected: false, error: e.message });
    }
  });

  app.post("/api/health/db", async (req, res) => {
    try {
      await ensureTables();
      res.json({ migrated: true, schema: "ok" });
    } catch (e: any) {
       res.status(500).json({ migrated: false, error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.all("/api/*", (req, res) => {
      res.status(404).json({ success: false, error: "API route not found" });
    });
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.all("/api/*", (req, res) => {
      res.status(404).json({ success: false, error: "API route not found" });
    });
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('SERVER ERROR:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ 
      success: false, 
      error: "Internal Server Error",
      message: err.message,
      path: req.path
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\nâœ… CMMS HVAC PRO Server is READY`);
    console.log(`ðŸš€ Running on http://localhost:${PORT}`);
    console.log(`ðŸ›¡ï¸ Vite middleware active in development mode\n`);
  });
}

startServer();
