import express from "express";
import { createServer as createViteServer } from "vite";
import { applySyncOperations } from "./api/_sync";
import { ensureDatabaseSchema, getDatabaseHealth } from "./api/_schema";
import { getDb } from "./api/_db";
import authHandler from "./api/auth";
import logsHandler from "./api/logs";
import { hashPin, requireRole } from "./api/_auth";
import { USUARIOS_MOCK } from "./src/data/users";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const getSql = () => {
  return getDb();
};

async function persistSystemLog(entry: {
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  context: string;
  message: string;
  data?: unknown;
  path?: string;
  userAgent?: string;
}) {
  try {
    const sql = getSql();
    await sql`
      INSERT INTO system_logs (id, timestamp, level, source, context, message, data, path, user_agent)
      VALUES (
        ${crypto.randomUUID()},
        ${Date.now()},
        ${entry.level},
        ${entry.source},
        ${entry.context},
        ${entry.message},
        ${JSON.stringify(entry.data || null)},
        ${entry.path || null},
        ${entry.userAgent || null}
      )
    `;
  } catch {
    // Logging must never break the request path.
  }
}

// DATABASE INITIALIZATION //
import { GoogleGenerativeAI } from "@google/generative-ai";

async function ensureTables() {
  try {
    const sql = getSql();
    console.log("📦 Initializing Database Schema (Sync with Scripts)...");
    await ensureDatabaseSchema(sql);
    const userCountRows = await sql`SELECT count(*)::int AS count FROM users`;
    if (Number(userCountRows[0]?.count || 0) === 0 && process.env.BOOTSTRAP_ADMIN_PIN) {
      const now = Date.now();
      const id = process.env.BOOTSTRAP_ADMIN_ID || 'U-BOOTSTRAP';
      const nombre = process.env.BOOTSTRAP_ADMIN_NAME || 'Administrador Inicial';
      const correo = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@example.local';
      await sql`
        INSERT INTO users (id, nombre, correo, perfil, pin, pin_hash, activo, data, uuid_sync, updated_at, created_at)
        VALUES (${id}, ${nombre}, ${correo}, 'administrador', NULL, ${hashPin(process.env.BOOTSTRAP_ADMIN_PIN)}, true, ${JSON.stringify({ id, nombre, correo, perfil: 'administrador' })}, ${id}, ${now}, ${now})
        ON CONFLICT (id) DO NOTHING
      `;
    } else if (Number(userCountRows[0]?.count || 0) === 0 && process.env.SEED_DEMO_USERS === 'true') {
      const now = Date.now();
      for (const user of USUARIOS_MOCK) {
        await sql`
          INSERT INTO users (id, nombre, correo, perfil, pin, pin_hash, activo, data, uuid_sync, updated_at, created_at)
          VALUES (${user.id}, ${user.nombre}, ${user.correo}, ${user.perfil}, NULL, ${hashPin(user.pin)}, ${user.activo}, ${JSON.stringify({ ...user, pin: undefined })}, ${user.id}, ${now}, ${now})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }
    const legacyPinRows = await sql`SELECT id, pin FROM users WHERE pin IS NOT NULL AND pin_hash IS NULL`;
    for (const user of legacyPinRows) {
      await sql`UPDATE users SET pin_hash = ${hashPin(user.pin)}, pin = NULL WHERE id = ${user.id}`;
    }
    console.log("✅ Database Schema integrity check completed");
    return;
    
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
      updated_at BIGINT, created_at BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS users (
      uuid_sync TEXT PRIMARY KEY, id TEXT UNIQUE, nombre TEXT, correo TEXT UNIQUE, perfil TEXT, pin TEXT, 
      activo BOOLEAN DEFAULT true, data JSONB, updated_at BIGINT, created_at BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS preventive_maintenance (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS work_orders (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS reports (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS events (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS clients (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS branches (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT)`;

    // 2. Migration for existing tables - ensure columns exist
    const columnMigrations = [
      { table: 'assets', col: 'uuid_sync', type: 'TEXT' },
      { table: 'assets', col: 'updated_at', type: 'BIGINT' },
      { table: 'assets', col: 'created_at', type: 'BIGINT' },
      { table: 'users', col: 'uuid_sync', type: 'TEXT' },
      { table: 'users', col: 'updated_at', type: 'BIGINT' },
      { table: 'users', col: 'created_at', type: 'BIGINT' },
      { table: 'preventive_maintenance', col: 'uuid_sync', type: 'TEXT' },
      { table: 'preventive_maintenance', col: 'updated_at', type: 'BIGINT' },
      { table: 'work_orders', col: 'uuid_sync', type: 'TEXT' },
      { table: 'work_orders', col: 'updated_at', type: 'BIGINT' },
      { table: 'reports', col: 'uuid_sync', type: 'TEXT' },
      { table: 'reports', col: 'updated_at', type: 'BIGINT' },
      { table: 'events', col: 'uuid_sync', type: 'TEXT' },
      { table: 'events', col: 'updated_at', type: 'BIGINT' },
      { table: 'clients', col: 'uuid_sync', type: 'TEXT' },
      { table: 'clients', col: 'updated_at', type: 'BIGINT' },
      { table: 'branches', col: 'uuid_sync', type: 'TEXT' },
      { table: 'branches', col: 'updated_at', type: 'BIGINT' }
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
        } else if (t === 'users') {
          await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
        } else if (t === 'preventive_maintenance') {
          await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
        } else if (t === 'work_orders') {
          await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
        } else if (t === 'reports') {
          await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
        } else if (t === 'events') {
          await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
        } else if (t === 'clients') {
          await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
        } else if (t === 'branches') {
          await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
          await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
          await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS created_at BIGINT`;
          await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;
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

    console.log("✅ Database Schema integrity check completed");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
  }
}

async function startServer() {
  await ensureTables();
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || "0.0.0.0";
  const payloadTouchesUsers = (payload: any) => {
    const buckets = [payload?.inserts, payload?.updates, payload?.deletes];
    return buckets.some((bucket) => Array.isArray(bucket) && bucket.some((item: any) => item?.table === 'users'));
  };
  const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
  const rateLimit = (name: string, limit: number, windowMs: number) => (req: any, res: any, next: any) => {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const key = `${name}:${forwarded || req.socket.remoteAddress || 'unknown'}`;
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= limit) {
      return res.status(429).json({ success: false, error: 'Demasiados intentos. Intenta nuevamente más tarde.' });
    }
    bucket.count += 1;
    next();
  };

  app.use(express.json());
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      if (res.statusCode < 400) return;
      persistSystemLog({
        level: res.statusCode >= 500 ? 'error' : 'warn',
        source: 'backend',
        context: 'HTTP',
        message: `${req.method} ${req.originalUrl} -> ${res.statusCode}`,
        data: { statusCode: res.statusCode, durationMs: Date.now() - startedAt },
        path: req.originalUrl,
        userAgent: req.headers['user-agent']
      });
    });
    next();
  });

  // API ROUTES //
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/ocr", async (req, res) => {
    try {
      const user = requireRole(['administrador', 'programador', 'supervisor', 'tecnico', 'contratista'])(req, res);
      if (!user) return;
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

  app.post("/api/auth", rateLimit('auth', 10, 60_000), authHandler);
  app.get("/api/logs", logsHandler);
  app.post("/api/logs", rateLimit('logs', 60, 60_000), logsHandler);

  const READABLE_TABLES = ['assets', 'preventive_maintenance', 'work_orders', 'reports', 'events', 'clients', 'branches'];
  const SYNCABLE_TABLES = ['assets', 'users', 'preventive_maintenance', 'work_orders', 'reports', 'events', 'clients', 'branches'];

  app.get("/api/users", async (req, res) => {
    try {
      const user = requireRole(['administrador', 'programador'])(req, res);
      if (!user) return;
      const sql = getSql();
      const rows = await sql`
        SELECT uuid_sync, id, nombre, correo, perfil, activo, updated_at, created_at, deleted_at
        FROM users
        WHERE deleted_at IS NULL
        ORDER BY nombre ASC
      `;
      res.json({ success: true, data: rows });
    } catch (error: any) {
      console.error("Error en GET /api/users:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const user = requireRole(['administrador', 'programador'])(req, res);
      if (!user) return;
      const sql = getSql();
      const body = req.body || {};
      const id = body.id || `U-${Date.now()}`;
      const now = Date.now();
      if (!body.nombre || !body.pin) {
        return res.status(400).json({ success: false, error: 'nombre y pin requeridos' });
      }
      const safeData = { ...body, pin: undefined, pin_hash: undefined };
      const rows = await sql`
        INSERT INTO users (id, nombre, correo, perfil, pin, pin_hash, activo, data, uuid_sync, updated_at, created_at)
        VALUES (${id}, ${body.nombre || ''}, ${body.correo || body.email || ''}, ${body.perfil || body.rol || 'tecnico'}, NULL, ${hashPin(body.pin)}, ${body.activo !== false}, ${JSON.stringify(safeData)}, ${body.uuid_sync || id}, ${now}, ${now})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          correo = EXCLUDED.correo,
          perfil = EXCLUDED.perfil,
          pin = NULL,
          pin_hash = EXCLUDED.pin_hash,
          activo = EXCLUDED.activo,
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
        RETURNING uuid_sync, id, nombre, correo, perfil, activo, updated_at, created_at, deleted_at
      `;
      res.status(201).json({ success: true, data: rows[0] });
    } catch (error: any) {
      console.error("Error en POST /api/users:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get(["/api/:table", "/api/sync/:table"], async (req, res, next) => {
    const table = req.params.table;
    if (table === 'equipos' || table === 'users') return next('route');
    if (!READABLE_TABLES.includes(table)) return res.status(400).json({ error: "Invalid table" });
    try {
      const user = requireRole(['administrador', 'programador', 'supervisor', 'tecnico', 'contratista'])(req, res);
      if (!user) return;
      const sql = getSql();
      // Usar Number para evitar problemas con BigInt si el valor es pequeño o null
      const since = req.query.since ? Number(req.query.since) : 0;
      let rows;
      
      if (table === 'assets') {
        rows = await sql`SELECT * FROM assets WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
      } else {
        // Generic tables
        switch (table) {
          case 'preventive_maintenance': rows = await sql`SELECT * FROM preventive_maintenance WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
          case 'work_orders': rows = await sql`SELECT * FROM work_orders WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
          case 'reports': rows = await sql`SELECT * FROM reports WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
          case 'events': rows = await sql`SELECT * FROM events WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
          case 'clients': rows = await sql`SELECT * FROM clients WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
          case 'branches': rows = await sql`SELECT * FROM branches WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
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
      const user = requireRole(['administrador', 'programador', 'supervisor', 'tecnico', 'contratista'])(req, res);
      if (!user) return;
      const sql = getSql();
      const tag = req.query.tag;
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

  app.post("/api/equipos", async (req, res) => {
    try {
      const user = requireRole(['administrador', 'programador', 'supervisor'])(req, res);
      if (!user) return;
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

  app.delete("/api/equipos", async (req, res) => {
    try {
      const user = requireRole(['administrador', 'programador', 'supervisor'])(req, res);
      if (!user) return;
      const sql = getSql();
      const tag = req.query.tag;
      const now = Date.now();
      await sql`UPDATE assets SET estado = 'baja', deleted_at = ${now}, updated_at = ${now} WHERE tag = ${tag}`;
      res.json({ success: true, message: "Registro borrado exitosamente." });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Generic POST for one-off operations (sync endpoint preferred)
  app.post("/api/:table", async (req, res, next) => {
    const table = req.params.table;
    if (table === 'sync') return next();
    const user = requireRole(['administrador', 'programador'])(req, res);
    if (!user) return;
    if (!SYNCABLE_TABLES.includes(table)) return res.status(400).json({ error: "Invalid table" });
    res.status(501).json({ error: "Use /api/sync/:table for write operations" });
  });

  // NEW GLOBAL SYNC ENDPOINT
  app.get('/api/health/db', async (_req, res) => {
    try {
      const user = requireRole(['administrador', 'programador'])(_req, res);
      if (!user) return;
      const sql = getSql();
      const health = await getDatabaseHealth(sql);
      res.json({ success: true, ...health });
    } catch (error: any) {
      res.status(503).json({ success: false, configured: Boolean(process.env.DATABASE_URL), connected: false, error: error.message });
    }
  });

  app.post('/api/health/db', async (_req, res) => {
    try {
      const user = requireRole(['administrador', 'programador'])(_req, res);
      if (!user) return;
      const sql = getSql();
      await ensureTables();
      const health = await getDatabaseHealth(sql);
      res.json({ success: true, migrated: true, ...health });
    } catch (error: any) {
      res.status(503).json({ success: false, configured: Boolean(process.env.DATABASE_URL), connected: false, error: error.message });
    }
  });

  app.post('/api/sync', async (req, res) => {
    try {
      const touchesUsers = payloadTouchesUsers(req.body);
      const user = requireRole(touchesUsers
        ? ['administrador', 'programador']
        : ['administrador', 'programador', 'supervisor', 'tecnico', 'contratista'])(req, res);
      if (!user) return;
      const sql = getSql();
      const payload = await applySyncOperations(sql, req.body);
      const status = payload.success ? 200 : 207;
      res.status(status).json(payload);
    } catch (error: any) {
      console.error('[SYNC ERROR]:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/sync/:table", async (req, res) => {
    const table = req.params.table;
    const { records, operation } = req.body;

    const user = requireRole(table === 'users'
      ? ['administrador', 'programador']
      : ['administrador', 'programador', 'supervisor', 'tecnico', 'contratista'])(req, res);
    if (!user) return;
    if (!SYNCABLE_TABLES.includes(table) && table !== 'equipos') return res.status(400).json({ error: "Invalid table" });
    if (!Array.isArray(records)) return res.status(400).json({ error: "Records must be an array" });

    try {
      const sql = getSql();
      const opName = operation === 'delete' ? 'deletes' : operation === 'update' ? 'updates' : 'inserts';
      const payload = await applySyncOperations(sql, {
        inserts: opName === 'inserts' ? records.map((record: any) => ({ ...record, table, data: record, uuid_sync: record.uuid_sync, updated_at: record.updated_at })) : [],
        updates: opName === 'updates' ? records.map((record: any) => ({ ...record, table, data: record, uuid_sync: record.uuid_sync, updated_at: record.updated_at })) : [],
        deletes: opName === 'deletes' ? records.map((record: any) => ({ ...record, table, data: record, uuid_sync: record.uuid_sync, updated_at: record.updated_at || record.deleted_at })) : [],
        lastSync: req.body.lastSync || 0
      });
      res.status(payload.success ? 200 : 207).json({ success: payload.success, message: "Sync successful", results: payload.results[opName], serverChanges: payload.serverChanges, serverTime: payload.serverTime });
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

  app.listen(PORT, HOST, () => {
    console.log(`\nCMMS HVAC PRO Server is READY`);
    console.log(`Running on http://localhost:${PORT}`);
    console.log(`Listening on ${HOST}:${PORT} in ${process.env.NODE_ENV || "development"} mode\n`);
  });
}

startServer();
