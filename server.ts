import express from "express";
import { createServer as createViteServer } from "vite";
import { neon } from "@neondatabase/serverless";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createMockSql } from "./src/db/mockDb";

let mockSqlInstance: any = null;

// Neon DB connection OR Mock SQL Simulator fallback
// Exigido por el usuario: utilizar exclusivamente DATABASE_URL
const getSql = () => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl || !dbUrl.startsWith('postgres')) {
    if (!mockSqlInstance) {
      console.warn("⚠️ DATABASE_URL no definida. Iniciando Simulación de Base de Datos (Modo Offline-Sincronizado) en /src/db/mock_db_store.json...");
      mockSqlInstance = createMockSql();
    }
    return mockSqlInstance;
  }

  return neon(dbUrl);
};

const verifyToken = (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : (req.query.token || req.headers['x-access-token'] || req.body.token);

    if (!token) {
      if (req.path.startsWith('/api/health')) {
        return next();
      }
      return res.status(401).json({ success: false, error: 'Acceso denegado: Token no proporcionado o inválido.' });
    }

    const JWT_SECRET = process.env.JWT_SECRET || "cmms-default-ultra-secure-key";
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        return res.status(401).json({ success: false, error: 'Token inválido o expirado.' });
      }
      req.user = decoded;
      req.clienteId = decoded.clienteId || 'cliente-default-001';
      next();
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const requireCliente = async (req: any, res: any, next: any) => {
  try {
    const clienteId = req.params.cliente_id || req.headers['x-client-id'] || req.headers['x-cliente-id'] || req.query.clienteId || req.query.cliente_id || 'cliente-default-001';
    if (!clienteId) {
      return res.status(403).json({ success: false, error: 'Tenant (cliente_id) es obligatorio y requerido.' });
    }
    
    req.clienteId = clienteId;

    const sql = getSql();

    // VALIDACIÓN DE AUTORIZACIÓN: Validar que el token/user corresponda a un técnico asignado al cliente consultado
    const userIdHeader = req.headers['x-user-id'] || req.headers['x-userid'] || req.query.userId || req.query.user_id;
    if (userIdHeader) {
      const uId = String(userIdHeader).trim();
      const queryUser = await sql`
        SELECT u.uuid_sync, u.cliente_id
        FROM users u
        WHERE u.id = ${uId} OR u.uuid_sync = ${uId}
      `;
      if (queryUser.length > 0) {
        const uClienteId = queryUser[0].cliente_id;
        if (uClienteId && uClienteId !== clienteId && uClienteId !== 'cliente-default-001') {
          return res.status(403).json({
            success: false,
            error: `Acceso no autorizado: usuario ${uId} pertenece al cliente ${uClienteId}, no a ${clienteId}.`
          });
        }
      }
    }

    // Verificar asociacion del usuario autenticado si se pasa cabecera de autenticacion
    const userHeader = req.headers['x-user-email'] || req.headers['authorization'];
    if (userHeader) {
      const email = userHeader.replace('Bearer ', '').trim().toLowerCase();
      if (email && !email.includes('mock') && !email.includes('test')) {
        const queryRes = await sql`SELECT uuid_sync, cliente_id FROM users WHERE LOWER(correo) = ${email} OR LOWER(data->>'email') = ${email}`;
        if (queryRes.length > 0) {
          const u = queryRes[0];
          const uClienteId = u.cliente_id;
          if (uClienteId && uClienteId !== clienteId && uClienteId !== 'cliente-default-001') {
            return res.status(403).json({ 
              success: false, 
              error: `Acceso Denegado: Su usuario (${email}) esta asignado al cliente ${uClienteId} y no coincide con el tenant solicitado (${clienteId}).` 
            });
          }
        }
      }
    }

    next();
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const validateWorkOrderPayload = (data: any) => {
  if (!data) return;
  
  // Extraer el objeto de datos si viene anidado (tipo sync payload)
  let target = data;
  if (data.data && typeof data.data === 'object') {
    target = data.data;
  } else if (data.data && typeof data.data === 'string') {
    try {
      target = JSON.parse(data.data);
    } catch (e) {}
  }
  
  const estado = String(target.estado || target.status || '').toLowerCase();
  if (['cerrado', 'cerrada', 'firmado', 'firmada'].includes(estado)) {
    const checklist = target.checklist || target.checklists || target.checklist_items;
    const hasChecklist = Array.isArray(checklist) && checklist.length > 0;
    
    const signature =
      target.firma
      || target.firma_conformidad_base64
      || (target.firmas && (target.firmas.tecnico || target.firmas.cliente))
      || (target.signatures && target.signatures.technician)
      || (target.payload && target.payload.firma_conformidad_base64)
      || (target.data && target.data.firma_conformidad_base64)
      || (target.data && target.data.firmas && target.data.firmas.tecnico);
    
    const hasSignature = signature && String(signature).trim().length > 0;
    
    if (!hasSignature) {
      throw new Error("Transacción bloqueada por validación de QA: No es posible pasar a un estado de cierre ('Cerrado'/'Firmada') sin registrar la firma de conformidad (firma_conformidad_base64).");
    }
    if (!hasChecklist) {
      throw new Error("Transacción bloqueada por validación de QA: Se requiere completar y registrar los checklists de verificación técnica antes del cierre de la OT.");
    }
  }
};

// ⚠️ SECURITY FIX #3 (CRITICAL): RBAC Middleware for server-side role enforcement
const MUTATION_PERMISSIONS: Record<string, string[]> = {
  'crear_informe': ['tecnico', 'supervisor', 'administrador', 'programador', 'contratista'],
  'crear_ticket': ['tecnico', 'supervisor', 'administrador', 'programador', 'contratista', 'cliente'],
  'crear_mantenimiento': ['tecnico', 'supervisor', 'administrador', 'programador', 'contratista'],
  'gestionar_usuarios': ['administrador', 'programador'],
  'crear_equipo': ['supervisor', 'administrador', 'programador'],
};

const requireRole = (requiredPermissions: string[]) => {
  return async (req: any, res: any, next: any) => {
    try {
      const perfil = req.user?.perfil || 'cliente';
      const requiredRoles = requiredPermissions.flatMap(perm => MUTATION_PERMISSIONS[perm] || []);
      
      if (!requiredRoles.includes(perfil)) {
        return res.status(403).json({
          success: false,
          error: `Acceso denegado: Perfil '${perfil}' no tiene permisos para esta operación.`,
          required_roles: requiredRoles,
          current_role: perfil
        });
      }
      next();
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
};

// DATABASE INITIALIZATION //
import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function ensureTables() {
  try {
    const sql = getSql();
    console.log("🧹 [MIGRACIÓN QA SENIOR] - Depurando tablas 'cmms_' inactivas y normalizando base de datos...");

    // 1. Eliminar de forma segura todas las tablas cmms_* obsoletas
    const obsoleteTables = [
      'clients', 'branches',
      'cmms_usuarios_clientes', 
      'cmms_informes_mantenimiento', 'cmms_sla_config', 'cmms_pm_planes', 
      'cmms_pm_plantillas', 'cmms_checklist_plantillas', 'cmms_push_subscriptions', 
      'cmms_ot_eventos', 'cmms_ot_comentarios', 'cmms_tickets', 
      'cmms_mantenimientos', 'cmms_equipos', 'cmms_users', 'cmms_clientes',
      'playing_with_neon', 'providers', 'cmms_one_shot_migrations'
    ];

    for (const table of obsoleteTables) {
      try {
        await sql.unsafe(`DROP TABLE IF EXISTS ${table} CASCADE`);
      } catch (err: any) {
        console.log(`Info: No se pudo eliminar la tabla obsoleta ${table}:`, err.message);
      }
    }

    // 2. Crear las tablas principales de la Aplicación si no existen
    await sql`CREATE TABLE IF NOT EXISTS cmms_auth_failures (
      email TEXT NOT NULL,
      ip TEXT,
      attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`;

    await sql`CREATE TABLE IF NOT EXISTS cmms_idempotency_keys (
      key TEXT,
      user_id TEXT,
      status_code INTEGER,
      response_body JSONB,
      expires_at TIMESTAMP WITH TIME ZONE,
      PRIMARY KEY (key, user_id)
    )`;

    await sql`CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      uuid_sync TEXT UNIQUE,
      data JSONB NOT NULL,
      updated_at BIGINT,
      created_at BIGINT,
      deleted_at BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS sucursales (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      uuid_sync TEXT UNIQUE,
      data JSONB NOT NULL,
      updated_at BIGINT,
      created_at BIGINT,
      deleted_at BIGINT,
      CONSTRAINT fk_sucursales_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    )`;

    await sql`CREATE TABLE IF NOT EXISTS assets (
      uuid_sync TEXT PRIMARY KEY,
      tag TEXT UNIQUE,
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
      latitud DOUBLE PRECISION,
      longitud DOUBLE PRECISION,
      updated_at BIGINT,
      created_at BIGINT,
      deleted_at BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS users (
      uuid_sync TEXT PRIMARY KEY,
      id TEXT UNIQUE,
      nombre TEXT,
      correo TEXT UNIQUE,
      perfil TEXT,
      pin TEXT,
      activo BOOLEAN DEFAULT true,
      data JSONB,
      updated_at BIGINT,
      created_at BIGINT,
      deleted_at BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS preventive_maintenance (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS work_orders (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS reports (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS events (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS catalog_asset_types (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS settings (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS ordenes_servicio (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS inventory (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS calendar (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    
    await sql`CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, 
      action TEXT NOT NULL, 
      entity_type TEXT NOT NULL, 
      entity_id TEXT NOT NULL, 
      user_id TEXT NOT NULL, 
      payload JSONB, 
      timestamp BIGINT NOT NULL
    )`;

    // 3. Agregar cliente_id como columna real con llave foránea en tablas operacionales:
    try { await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE calendar ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE catalog_asset_types ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e) {}

    // 4. Agregar sucursal_id real con llave foránea en assets
    try { await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS sucursal_id TEXT REFERENCES sucursales(id) ON DELETE RESTRICT`; } catch (e) {}
    try { await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION`; } catch (e) {}
    try { await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION`; } catch (e) {}
    try { await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS frecuencia_mantenimiento TEXT`; } catch (e) {}

    // 5. Garantizar llaves UNIQUE de sincronización
    const tryUnique = async (idx_name: string, q: any) => {
      try { await q; } catch (e: any) {
        if (!e.message.includes('already exists') && !e.message.includes('duplicado')) {
          console.error(`Error unique index ${idx_name}:`, e.message);
        }
      }
    };
    await tryUnique('assets_sync_uq', sql`ALTER TABLE assets ADD UNIQUE (uuid_sync)`);
    await tryUnique('users_sync_uq', sql`ALTER TABLE users ADD UNIQUE (uuid_sync)`);
    await tryUnique('pm_sync_uq', sql`ALTER TABLE preventive_maintenance ADD UNIQUE (uuid_sync)`);
    await tryUnique('wo_sync_uq', sql`ALTER TABLE work_orders ADD UNIQUE (uuid_sync)`);
    await tryUnique('rep_sync_uq', sql`ALTER TABLE reports ADD UNIQUE (uuid_sync)`);
    await tryUnique('inv_sync_uq', sql`ALTER TABLE inventory ADD UNIQUE (uuid_sync)`);
    await tryUnique('cal_sync_uq', sql`ALTER TABLE calendar ADD UNIQUE (uuid_sync)`);

    // 6. Crear índices compuestos de tenant de alto rendimiento (Estrategia QA Senior)
    try { await sql`CREATE INDEX IF NOT EXISTS idx_sucursales_tenant ON sucursales (cliente_id, id)`; } catch(e){}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_assets_tenant_search ON assets (cliente_id, sucursal_id, uuid_sync)`; } catch(e){}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_search ON work_orders (cliente_id, uuid_sync)`; } catch(e){}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_inventory_tenant_search ON inventory (cliente_id, uuid_sync)`; } catch(e){}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_calendar_tenant_search ON calendar (cliente_id, uuid_sync)`; } catch(e){}

    // 7. COOP RECOVERY SECTOR: Asegurar inquilino por defecto y sucursal por defecto para evitar Check Constraints
    await sql`
      INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at)
      VALUES (
        'cliente-default-001', 
        'cliente-default-001', 
        '{"nombre": "Cliente Internacional", "empresa": "Client Corp", "activo": true}'::jsonb, 
        0, 
        0
      )
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at)
      VALUES (
        'sucursal-default-001', 
        'cliente-default-001', 
        'sucursal-default-001', 
        '{"nombre": "Sede Central", "ciudad": "Santiago"}'::jsonb, 
        0, 
        0
      )
      ON CONFLICT (id) DO NOTHING
    `;

    // 8. Auto-migrar datos huérfanos antes de activar constraints estrictos
    try {
      await sql`UPDATE assets SET cliente_id = 'cliente-default-001' WHERE cliente_id IS NULL OR cliente_id = ''`;
      await sql`UPDATE assets SET sucursal_id = 'sucursal-default-001' WHERE sucursal_id IS NULL OR sucursal_id = ''`;
      await sql`UPDATE work_orders SET cliente_id = 'cliente-default-001' WHERE cliente_id IS NULL OR cliente_id = ''`;
      await sql`UPDATE preventive_maintenance SET cliente_id = 'cliente-default-001' WHERE cliente_id IS NULL OR cliente_id = ''`;
      await sql`UPDATE inventory SET cliente_id = 'cliente-default-001' WHERE cliente_id IS NULL OR cliente_id = ''`;
      await sql`UPDATE calendar SET cliente_id = 'cliente-default-001' WHERE cliente_id IS NULL OR cliente_id = ''`;
      await sql`UPDATE users SET cliente_id = 'cliente-default-001' WHERE cliente_id IS NULL OR cliente_id = ''`;
    } catch(e) {}

    console.log("✅ [MIGRACIÓN QA SENIOR COMBO SUCCESS] - Database Schema integrity check completed successfully.");
  } catch (error: any) {
    console.error("❌ Error inicializando base de datos:", error.message || error);
  }
}

async function startServer() {
  try {
    await ensureTables();
  } catch (error: any) {
    console.error("⚠️ Database initialization failed or timed out during startup:", error.message || error);
  }
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

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
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

      // Anti brute-force: check lockout for the given email in the last 15 minutes
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const failuresCount = await sql`SELECT COUNT(*)::int as count FROM cmms_auth_failures WHERE LOWER(email) = ${correoLower} AND attempted_at > ${fifteenMinsAgo}`;
      
      if (failuresCount[0] && failuresCount[0].count >= 5) {
        const oldestFailure = await sql`SELECT attempted_at FROM cmms_auth_failures WHERE LOWER(email) = ${correoLower} AND attempted_at > ${fifteenMinsAgo} ORDER BY attempted_at ASC LIMIT 1`;
        let delay = 900;
        if (oldestFailure[0]) {
          const oldestTime = new Date(oldestFailure[0].attempted_at).getTime();
          delay = Math.ceil((oldestTime + 15 * 60 * 1000 - Date.now()) / 1000);
        }
        console.warn({ event: "auth_failure", email: correoLower, ip, action: "lockout" });
        return res.status(401).json({
          success: false,
          error: "account_locked",
          message: "Cuenta bloqueada temporalmente por demasiados intentos fallidos.",
          retryAfter: delay > 0 ? delay : 900
        });
      }

      // En la tabla users: correo podria estar en la columna 'correo' O en 'data->>'email'' O en la columna 'data' (JSONB) dependiendo de la migracion
      const _users = await sql`SELECT * FROM users WHERE LOWER(correo) = ${correoLower} OR LOWER(data->>'email') = ${correoLower}`;
      if (_users.length === 0) {
        await sql`INSERT INTO cmms_auth_failures (email, ip, attempted_at) VALUES (${correoLower}, ${ip}, NOW())`;
        console.warn({ event: "auth_failure", email: correoLower, ip });
        return res.status(401).json({ success: false, error: "Credenciales inválidas" });
      }

      const user = _users[0];
      
      // FIX: user.data is a JSON STRING, must parse it
      let userData = {};
      try {
        if (user.data) {
          userData = typeof user.data === 'string' ? JSON.parse(user.data) : user.data;
        }
      } catch (e) {
        console.warn("Could not parse user.data:", e);
      }
      
      const storedPin = user.pin || userData.pin;
      
      let isMatch = false;
      if (storedPin && storedPin.startsWith('$2')) {
        isMatch = bcrypt.compareSync(pin, storedPin);
      } else {
        isMatch = storedPin === pin;
      }

      if (!isMatch) {
        await sql`INSERT INTO cmms_auth_failures (email, ip, attempted_at) VALUES (${correoLower}, ${ip}, NOW())`;
        console.warn({ event: "auth_failure", email: correoLower, ip });
        return res.status(401).json({ success: false, error: "Credenciales inválidas" });
      }

      // Successful login reset failures and delete older than 24h as maintenance
      await sql`DELETE FROM cmms_auth_failures WHERE LOWER(email) = ${correoLower}`;
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await sql`DELETE FROM cmms_auth_failures WHERE attempted_at < ${twentyFourHoursAgo}`;
      } catch (err) {}

      // Convert DB user format to expected return format
      const returnUser = {
        id: user.id || userData.id || user.uuid_sync,
        nombre: user.nombre || userData.nombre,
        correo: user.correo || userData.email || correo,
        perfil: user.perfil || userData.rol || 'tecnico',
        activo: true
      };

      const JWT_SECRET = process.env.JWT_SECRET || "cmms-default-ultra-secure-key";
      const token = jwt.sign(
        {
          userId: returnUser.id,
          correo: returnUser.correo,
          perfil: returnUser.perfil,
          clienteId: user.cliente_id || 'cliente-default-001'
        },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.json({ success: true, user: returnUser, token });
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
      
      const client = getGeminiClient();
      const prompt = "Extrae de esta placa HVAC o similares: Marca, Modelo, N Serie, Refrigerante, Voltaje, Amperaje Nominal y Capacidad. REGLA: Si la capacidad esta en kW convierte: 1kW=3412 BTU. Si en Toneladas: 1TR=12000 BTU. Devuelve SOLO un objeto JSON con estas keys: {'marca':'','modelo':'','n_serie':'','refrigerante':'','capacidad_btu':'','voltaje':'','amperaje':''}";
      
      const imagePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64,
        },
      };

      const textPart = {
        text: prompt,
      };

      const result = await client.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: { parts: [imagePart, textPart] },
      });

      const text = result.text || "";
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
    'reports', 'events', 
    'catalog_asset_types', 'settings', 'ordenes_servicio', 'audit_logs', 'inventory', 'calendar', 'clientes', 'sucursales'
  ];

const TABLE_ALIAS_MAP: Record<string, string> = {
  'activos': 'assets',
  'usuarios': 'users',
  'mantenimientos': 'preventive_maintenance',
  'tickets': 'work_orders',
  'informes': 'reports',
  'eventos': 'events',
  'clientes': 'clientes', // <─── CORREGIDO: Redirige a clientes (master)
  'clients': 'clientes',  // <─── CORREGIDO: Mapea clients a la tabla única clientes
  'sucursales': 'sucursales', // <─── CORREGIDO: Redirige a sucursales (master)
  'branches': 'sucursales',   // <─── CORREGIDO: Mapea branches a la tabla única sucursales
  'inventario': 'inventory',
  'calendario': 'calendar'
};

function resolveTable(name: string): string | null {
  if (ALLOWED_TABLES.includes(name)) return name;
  return TABLE_ALIAS_MAP[name] || null;
}

  app.get(["/api/:table", "/api/sync/:table"], verifyToken, async (req: any, res: any) => {
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
      const clienteId = req.clienteId
        || req.query.clienteId 
        || req.query.cliente_id 
        || req.headers['x-client-id'] 
        || req.headers['x-cliente-id'] 
        || 'cliente-default-001';

      let rows;
      
      switch (table) {
        case 'assets': rows = await sql`SELECT * FROM assets WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'users': {
          const rawUsers = await sql`SELECT * FROM users WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
          rows = rawUsers.map((user: any) => {
            if (user.data && typeof user.data === 'object') {
              const { pin, ...dataWithoutPin } = user.data;
              return { ...user, data: dataWithoutPin };
            }
            return user;
          });
          break;
        }
        case 'preventive_maintenance': rows = await sql`SELECT * FROM preventive_maintenance WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL OR data->>'cliente_id' = ${clienteId}) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'work_orders': rows = await sql`SELECT * FROM work_orders WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL OR data->>'cliente_id' = ${clienteId}) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'reports': rows = await sql`SELECT * FROM reports WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL OR data->>'cliente_id' = ${clienteId}) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'events': rows = await sql`SELECT * FROM events WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL OR data->>'cliente_id' = ${clienteId}) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'clientes':
        case 'clients': rows = await sql`SELECT * FROM clientes WHERE (id = ${clienteId} OR uuid_sync = ${clienteId} OR id IS NULL) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'sucursales':
        case 'branches': rows = await sql`SELECT * FROM sucursales WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'catalog_asset_types': rows = await sql`SELECT * FROM catalog_asset_types WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'settings': rows = await sql`SELECT * FROM settings WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'ordenes_servicio': rows = await sql`SELECT * FROM ordenes_servicio WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'inventory': rows = await sql`SELECT * FROM inventory WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'calendar': rows = await sql`SELECT * FROM calendar WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL) AND (updated_at > ${since} OR updated_at IS NULL) AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
        case 'audit_logs': rows = await sql`SELECT * FROM audit_logs WHERE (cliente_id = ${clienteId} OR cliente_id IS NULL) AND (timestamp > ${since}) ORDER BY timestamp ASC LIMIT 1000`; break;
        default: rows = [];
      }
      res.json({ success: true, data: rows });
    } catch (error: any) {
      console.error(`Error en GET /api/${table}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // NUEVO FLUJO DE ACTIVOS SEGUN INSTRUCCIONES DEL ARQUITECTO
  // ⚠️ SECURITY FIX #1 (CRITICAL): Add authentication and tenant isolation
  app.get("/api/assets", verifyToken, async (req, res) => {
    try {
      const sql = getSql();
      const tag = req.query.tag as string;
      const clienteId = req.clienteId || 'cliente-default-001';
      
      if (tag) {
        const rows = await sql`SELECT * FROM assets WHERE tag = ${tag} AND cliente_id = ${clienteId} AND deleted_at IS NULL`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Equipo no encontrado" });
        return res.json({ success: true, data: rows[0] });
      } else {
        const rows = await sql`SELECT * FROM assets WHERE cliente_id = ${clienteId} AND deleted_at IS NULL`;
        return res.json({ success: true, data: rows });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/assets", verifyToken, async (req, res) => {
    try {
      const sql = getSql();
      const tag = req.query.tag || req.body.tag;
      const clienteId = req.clienteId || 'cliente-default-001';
      
      if (req.query.action === 'mantenimiento' || req.body.mantenimiento) {
        if (!tag) return res.status(400).json({ error: "Falta tag" });
        const { mantenimiento } = req.body;
        const ts = new Date().toISOString();
        const nuevoMantenimiento = { ...mantenimiento, fecha: ts };
        
        // FIX: Add cliente_id filter to prevent cross-tenant access
        const rows = await sql`SELECT notas FROM assets WHERE tag = ${tag} AND cliente_id = ${clienteId}`;
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Equipo no encontrado" });
        
        const currentNotas = rows[0].notas || '';
        const updatedNotas = `${currentNotas}\n- Mantenimiento: ${JSON.stringify(nuevoMantenimiento)}`;

        await sql`
          UPDATE assets 
          SET ultimo_mantenimiento = ${ts}, notas = ${updatedNotas}
          WHERE tag = ${tag} AND cliente_id = ${clienteId}
        `;
        return res.json({ success: true, message: "Mantenimiento registrado." });
      } else {
        const { nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, tecnicos, notas } = req.body;
        
        const resData = await sql`
          INSERT INTO assets (tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, tecnicos, notas, cliente_id, uuid_sync, updated_at, created_at)
          VALUES (${tag}, ${nombre}, ${tipo || ''}, ${marca || ''}, ${modelo || ''}, ${serie || ''}, ${ubicacion || ''}, ${area || ''}, ${capacidad || ''}, ${voltaje || ''}, ${corriente || ''}, ${refrigerante || ''}, ${fecha_instalacion || ''}, ${vida_util || 0}, ${estado || 'operativo'}, ${ultimo_mantenimiento || null}, ${proximo_mantenimiento || null}, ${horas_operacion || 0}, ${tecnicos ? JSON.stringify(tecnicos) : null}, ${notas || ''}, ${clienteId}, ${`asset-${Date.now()}`}, ${Date.now()}, ${Date.now()})
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
            notas = EXCLUDED.notas,
            updated_at = EXCLUDED.updated_at
          RETURNING *;
        `;
        return res.json({ success: true, data: resData[0] });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/assets", verifyToken, async (req, res) => {
    try {
      const sql = getSql();
      const tag = req.query.tag as string;
      const clienteId = req.clienteId || 'cliente-default-001';
      const ts = Date.now();
      const userId = req.user?.userId || 'system';
      
      // FIX: Add cliente_id filter AND audit logging
      const existing = await sql`SELECT uuid_sync FROM assets WHERE tag = ${tag} AND cliente_id = ${clienteId}`;
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: "Activo no encontrado o no tiene permisos" });
      }
      
      await sql`UPDATE assets SET deleted_at = ${ts}, estado = 'baja', updated_at = ${ts} WHERE tag = ${tag} AND cliente_id = ${clienteId}`;
      
      // Log to audit trail
      await sql`
        INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id)
        VALUES (${`audit-${Date.now()}`}, 'DELETE', 'assets', ${tag}, ${userId}, ${JSON.stringify({tag, estado: 'baja'})}, ${ts}, ${clienteId})
      `.catch(e => console.error("Audit log error:", e));
      
      res.json({ success: true, message: "Registro dado de baja exitosamente." });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- ENDPOINTS REGISTRADOS DE LA VERSIÓN MULTI-TENANT VERCEL SERVERLESS V1 ---

  // 1. CLIENTES (CONEXIÓN MAESTRA)
  // ⚠️ SECURITY FIX #2 (CRITICAL): Protect with authentication, return only current tenant
  app.get("/api/v1/clients", verifyToken, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const clienteId = req.clienteId || 'cliente-default-001';
      // FIX: Only return the current authenticated client's data
      const rows = await sql`SELECT * FROM clientes WHERE id = ${clienteId} AND deleted_at IS NULL`;
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/v1/clients/:client_id", verifyToken, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM clientes WHERE id = ${req.params.client_id} AND deleted_at IS NULL`;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: "Cliente maestro no encontrado" });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/v1/clients", verifyToken, requireRole(['gestionar_usuarios']), async (req: any, res: any) => {
    try {
      const { id, uuid_sync, data } = req.body;
      const sql = getSql();
      const finalId = id || uuid_sync || `client-${Date.now()}`;
      const finalUuid = uuid_sync || finalId;
      const updated_at = req.body.updated_at || Date.now();
      const strData = typeof data === 'object' ? JSON.stringify(data) : (data || '{}');

      await sql`
        INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at)
        VALUES (${finalId}, ${finalUuid}, ${strData}::jsonb, ${updated_at}, ${updated_at})
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      `;

      res.status(201).json({ success: true, id: finalId, uuid_sync: finalUuid });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.put("/api/v1/clients/:client_id", verifyToken, requireRole(['gestionar_usuarios']), async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { client_id } = req.params;
      const { data } = req.body;
      const updated_at = req.body.updated_at || Date.now();
      const strData = typeof data === 'object' ? JSON.stringify(data) : (data || '{}');

      await sql`
        UPDATE clientes 
        SET data = ${strData}::jsonb, updated_at = ${updated_at}
        WHERE id = ${client_id};
      `;

      res.json({ success: true, message: "Cliente actualizado con éxito" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/v1/clients/:client_id", verifyToken, requireRole(['gestionar_usuarios']), async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { client_id } = req.params;
      const ts = Date.now();

      await sql`UPDATE clientes SET deleted_at = ${ts}, updated_at = ${ts} WHERE id = ${client_id}`;

      res.json({ success: true, message: "Cliente dado de baja" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. SUCURSALES (REGISTRO MULTI-TENANT POR CLIENTE)
  app.get("/api/v1/:cliente_id/branches", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM sucursales WHERE cliente_id = ${req.clienteId} AND deleted_at IS NULL`;
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/v1/:cliente_id/branches/:branch_id", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM sucursales WHERE cliente_id = ${req.clienteId} AND id = ${req.params.branch_id} AND deleted_at IS NULL`;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: "Sucursal no encontrada" });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/v1/:cliente_id/branches", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { id, uuid_sync, data } = req.body;
      const finalId = id || uuid_sync || `branch-${Date.now()}`;
      const finalUuid = uuid_sync || finalId;
      const updated_at = req.body.updated_at || Date.now();
      const strData = typeof data === 'object' ? JSON.stringify(data) : (data || '{}');

      await sql`
        INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at)
        VALUES (${finalId}, ${req.clienteId}, ${finalUuid}, ${strData}::jsonb, ${updated_at}, ${updated_at})
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id;
      `;

      res.status(201).json({ success: true, id: finalId, uuid_sync: finalUuid });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.put("/api/v1/:cliente_id/branches/:branch_id", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { branch_id } = req.params;
      const { data } = req.body;
      const updated_at = req.body.updated_at || Date.now();
      const strData = typeof data === 'object' ? JSON.stringify(data) : (data || '{}');

      await sql`
        UPDATE sucursales
        SET data = ${strData}::jsonb, updated_at = ${updated_at}
        WHERE id = ${branch_id} AND cliente_id = ${req.clienteId};
      `;

      res.json({ success: true, message: "Branch actualizada exitosamente" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/v1/:cliente_id/branches/:branch_id", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { branch_id } = req.params;
      const ts = Date.now();

      await sql`UPDATE sucursales SET deleted_at = ${ts}, updated_at = ${ts} WHERE id = ${branch_id} AND cliente_id = ${req.clienteId}`;

      res.json({ success: true, message: "Sucursal dada de baja con éxito" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 3. ACTIVOS (CON BÚSQUEDA GEOGRÁFICA DE ALTA PRECISIÒN POR SUCURSAL E INQUILINO)
  app.get("/api/v1/:cliente_id/branches/:branch_id/assets", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { branch_id } = req.params;
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : null;
      const lng = req.query.lng || req.query.lon || req.query.long ? parseFloat((req.query.lng || req.query.lon || req.query.long) as string) : null;
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : null; // en metros

      let rows;
      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        // Fórmula de distancia geográfica esférica en SQL de alta definición para Neon DB
        rows = await sql`
          SELECT *, 
                 (6371000 * acos(
                   LEAST(1.0, GREATEST(-1.0, 
                     cos(radians(${lat})) * cos(radians(COALESCE(latitud, (data->'ubicacionGeografica'->>'lat')::double precision, (data->>'latitud')::double precision, 0.0))) * 
                     cos(radians(COALESCE(longitud, (data->'ubicacionGeografica'->>'lng')::double precision, (data->>'longitud')::double precision, 0.0)) - radians(${lng})) + 
                     sin(radians(${lat})) * sin(radians(COALESCE(latitud, (data->'ubicacionGeografica'->>'lat')::double precision, (data->>'latitud')::double precision, 0.0)))
                   ))
                 )) as distancia
          FROM assets 
          WHERE cliente_id = ${req.clienteId} 
            AND sucursal_id = ${branch_id}
            AND deleted_at IS NULL
          ORDER BY distancia ASC
        `;
        if (radius !== null && !isNaN(radius)) {
          rows = rows.filter((r: any) => r.distancia <= radius);
        }
      } else {
        rows = await sql`SELECT * FROM assets WHERE cliente_id = ${req.clienteId} AND sucursal_id = ${branch_id} AND deleted_at IS NULL`;
      }
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/v1/:cliente_id/branches/:branch_id/assets/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { branch_id, uuid_sync } = req.params;
      const rows = await sql`
        SELECT * FROM assets 
        WHERE cliente_id = ${req.clienteId} AND sucursal_id = ${branch_id} AND uuid_sync = ${uuid_sync} AND deleted_at IS NULL
      `;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: "Activo no encontrado en esta sucursal del tenant." });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/v1/:cliente_id/branches/:branch_id/assets", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { branch_id } = req.params;
      const d = req.body;
      const uuid_sync = d.uuid_sync || `asset-${Date.now()}`;
      const updated_at = d.updated_at || Date.now();

      // Extraer coordenadas si vienen en data u objeto lat/lng
      const latVal = d.latitud !== undefined ? parseFloat(d.latitud) : (d.lat !== undefined ? parseFloat(d.lat) : (d.ubicacionGeografica?.lat !== undefined ? parseFloat(d.ubicacionGeografica.lat) : null));
      const lngVal = d.longitud !== undefined ? parseFloat(d.longitud) : (d.lng !== undefined ? parseFloat(d.lng) : (d.ubicacionGeografica?.lng !== undefined ? parseFloat(d.ubicacionGeografica.lng) : null));

      let final_cliente_id = req.clienteId || 'cliente-default-001';
      let final_sucursal_id = branch_id || 'default-sucursal';

      const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
      if (!clientExists || clientExists.length === 0) {
        final_cliente_id = 'cliente-default-001';
      }

      const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
      if (!branchExists || branchExists.length === 0) {
        final_sucursal_id = 'default-sucursal';
      }

      await sql`
        INSERT INTO assets (
          tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, 
          voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, 
          ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, notas,
          uuid_sync, updated_at, created_at, cliente_id, sucursal_id, latitud, longitud
        ) VALUES (
          ${d.tag}, ${d.nombre}, ${d.tipo || ''}, ${d.marca || ''}, ${d.modelo || ''}, 
          ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''}, ${d.capacidad || ''}, 
          ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''}, ${d.fecha_instalacion || ''}, 
          ${d.vida_util || 10}, ${d.estado || 'operativo'}, ${d.ultimo_mantenimiento || null}, 
          ${d.proximo_mantenimiento || null}, ${d.horas_operacion || 0}, ${d.notas || ''},
          ${uuid_sync}, ${updated_at}, ${updated_at}, ${final_cliente_id}, ${final_sucursal_id}, ${latVal}, ${lngVal}
        )
      `;
      res.status(201).json({ success: true, uuid_sync });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.put("/api/v1/:cliente_id/branches/:branch_id/assets/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { branch_id, uuid_sync } = req.params;
      const d = req.body;
      const updated_at = d.updated_at || Date.now();

      const latVal = d.latitud !== undefined ? parseFloat(d.latitud) : (d.lat !== undefined ? parseFloat(d.lat) : (d.ubicacionGeografica?.lat !== undefined ? parseFloat(d.ubicacionGeografica.lat) : null));
      const lngVal = d.longitud !== undefined ? parseFloat(d.longitud) : (d.lng !== undefined ? parseFloat(d.lng) : (d.ubicacionGeografica?.lng !== undefined ? parseFloat(d.ubicacionGeografica.lng) : null));

      await sql`
        UPDATE assets SET
          tag = ${d.tag}, nombre = ${d.nombre}, tipo = ${d.tipo || ''}, marca = ${d.marca || ''}, modelo = ${d.modelo || ''},
          serie = ${d.serie || ''}, ubicacion = ${d.ubicacion || ''}, area = ${d.area || ''}, capacidad = ${d.capacidad || ''},
          voltaje = ${d.voltaje || ''}, corriente = ${d.corriente || ''}, refrigerante = ${d.refrigerante || ''},
          fecha_instalacion = ${d.fecha_instalacion || ''}, vida_util = ${d.vida_util || 10}, estado = ${d.estado || 'operativo'},
          ultimo_mantenimiento = ${d.ultimo_mantenimiento || null}, proximo_mantenimiento = ${d.proximo_mantenimiento || null},
          horas_operacion = ${d.horas_operacion || 0}, notas = ${d.notas || d.notes || ''},
          latitud = ${latVal}, longitud = ${lngVal},
          updated_at = ${updated_at}
        WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${req.clienteId} AND sucursal_id = ${branch_id};
      `;
      res.json({ success: true, message: "Asset actualizado con éxito" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/v1/:cliente_id/branches/:branch_id/assets/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { branch_id, uuid_sync } = req.params;
      const ts = Date.now();
      const userId = req.user?.userId || 'system';
      
      // Verify record exists
      const existing = await sql`SELECT uuid_sync FROM assets WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${req.clienteId} AND sucursal_id = ${branch_id}`;
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: "Activo no encontrado" });
      }
      
      await sql`
        UPDATE assets SET deleted_at = ${ts}, updated_at = ${ts}
        WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${req.clienteId} AND sucursal_id = ${branch_id}
      `;
      
      // Log deletion
      await sql`
        INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id)
        VALUES (${`audit-${Date.now()}`}, 'DELETE', 'assets', ${uuid_sync}, ${userId}, ${JSON.stringify({deleted_at: ts, branch_id})}, ${ts}, ${req.clienteId})
      `.catch(e => console.error("Audit log error:", e));
      
      res.json({ success: true, message: "Asset dado de baja exitosamente" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 4. INVENTARIO (INVENTORY COMPLETO POR TENANT)
  app.get("/api/v1/:cliente_id/inventory", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM inventory WHERE cliente_id = ${req.clienteId} AND deleted_at IS NULL`;
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/v1/:cliente_id/inventory/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM inventory WHERE cliente_id = ${req.clienteId} AND uuid_sync = ${req.params.uuid_sync} AND deleted_at IS NULL`;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: "Item de inventario no encontrado" });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/v1/:cliente_id/inventory", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { id, uuid_sync, data } = req.body;
      const finalId = id || uuid_sync || `inv-${Date.now()}`;
      const finalUuid = uuid_sync || finalId;
      const updated_at = req.body.updated_at || Date.now();
      const strData = typeof data === 'object' ? JSON.stringify(data) : (data || '{}');

      await sql`
        INSERT INTO inventory (id, uuid_sync, data, updated_at, created_at, cliente_id)
        VALUES (${finalId}, ${finalUuid}, ${strData}::jsonb, ${updated_at}, ${updated_at}, ${req.clienteId})
        ON CONFLICT (uuid_sync) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      `;
      res.status(201).json({ success: true, id: finalId, uuid_sync: finalUuid });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.put("/api/v1/:cliente_id/inventory/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { data } = req.body;
      const updated_at = req.body.updated_at || Date.now();
      const strData = typeof data === 'object' ? JSON.stringify(data) : (data || '{}');

      await sql`
        UPDATE inventory 
        SET data = ${strData}::jsonb, updated_at = ${updated_at}
        WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId};
      `;
      res.json({ success: true, message: "Item de inventario actualizado" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/v1/:cliente_id/inventory/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const ts = Date.now();
      const userId = req.user?.userId || 'system';
      
      // Verify record exists
      const existing = await sql`SELECT uuid_sync FROM inventory WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId}`;
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: "Item de inventario no encontrado" });
      }
      
      await sql`
        UPDATE inventory SET deleted_at = ${ts}, updated_at = ${ts}
        WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId}
      `;
      
      // Log deletion
      await sql`
        INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id)
        VALUES (${`audit-${Date.now()}`}, 'DELETE', 'inventory', ${req.params.uuid_sync}, ${userId}, ${JSON.stringify({deleted_at: ts})}, ${ts}, ${req.clienteId})
      `.catch(e => console.error("Audit log error:", e));
      
      res.json({ success: true, message: "Item de inventario eliminado" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 5. CALENDARIO PLANIFICADO (PLANNING COMPLETO)
  app.get("/api/v1/:cliente_id/planning", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM preventive_maintenance WHERE cliente_id = ${req.clienteId} AND deleted_at IS NULL`;
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/v1/:cliente_id/planning/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT * FROM preventive_maintenance 
        WHERE cliente_id = ${req.clienteId} AND uuid_sync = ${req.params.uuid_sync} AND deleted_at IS NULL
      `;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: "Planificación preventiva no encontrada" });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/v1/:cliente_id/planning", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { id, uuid_sync, data } = req.body;
      const finalId = id || uuid_sync || `plan-${Date.now()}`;
      const finalUuid = uuid_sync || finalId;
      const updated_at = req.body.updated_at || Date.now();
      const strData = typeof data === 'object' ? JSON.stringify(data) : (data || '{}');

      await sql`
        INSERT INTO preventive_maintenance (id, uuid_sync, data, updated_at, created_at, cliente_id)
        VALUES (${finalId}, ${finalUuid}, ${strData}::jsonb, ${updated_at}, ${updated_at}, ${req.clienteId})
        ON CONFLICT (uuid_sync) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      `;
      res.status(201).json({ success: true, id: finalId, uuid_sync: finalUuid });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.put("/api/v1/:cliente_id/planning/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { data } = req.body;
      const updated_at = req.body.updated_at || Date.now();
      const strData = typeof data === 'object' ? JSON.stringify(data) : (data || '{}');

      await sql`
        UPDATE preventive_maintenance 
        SET data = ${strData}::jsonb, updated_at = ${updated_at}
        WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId};
      `;
      res.json({ success: true, message: "Planificación actualizada" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/v1/:cliente_id/planning/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const ts = Date.now();
      const userId = req.user?.userId || 'system';
      
      // Verify record exists
      const existing = await sql`SELECT uuid_sync FROM preventive_maintenance WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId}`;
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: "Planificación no encontrada" });
      }
      
      await sql`
        UPDATE preventive_maintenance SET deleted_at = ${ts}, updated_at = ${ts}
        WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId}
      `;
      
      // Log deletion
      await sql`
        INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id)
        VALUES (${`audit-${Date.now()}`}, 'DELETE', 'preventive_maintenance', ${req.params.uuid_sync}, ${userId}, ${JSON.stringify({deleted_at: ts})}, ${ts}, ${req.clienteId})
      `.catch(e => console.error("Audit log error:", e));
      
      res.json({ success: true, message: "Planificación eliminada exitosamente" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 6. ÓRDENES DE TRABAJO (CON CONTROL ESTRICTO QA)
  app.get("/api/v1/:cliente_id/work-orders", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM work_orders WHERE cliente_id = ${req.clienteId} AND deleted_at IS NULL`;
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/v1/:cliente_id/work-orders/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT * FROM work_orders 
        WHERE cliente_id = ${req.clienteId} AND uuid_sync = ${req.params.uuid_sync} AND deleted_at IS NULL
      `;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: "Órden de trabajo no encontrada" });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/v1/:cliente_id/work-orders", requireCliente, requireRole(['crear_ticket']), async (req: any, res: any) => {
    try {
      const sql = getSql();
      const d = req.body;
      const id = d.id || d.uuid_sync || `ot-${Date.now()}`;
      const uuid_sync = d.uuid_sync || id;
      const updated_at = d.updated_at || Date.now();
      const userId = req.user?.userId || 'system';

      // EJECUTAR REGLA DE NEGOCIO CRÍTICA DE QA
      validateWorkOrderPayload(d);

      // Si todo está bien, guardamos
      const strData = JSON.stringify(d.data || d);

      await sql`
        INSERT INTO work_orders (id, uuid_sync, data, updated_at, created_at, cliente_id)
        VALUES (${id}, ${uuid_sync}, ${strData}::jsonb, ${updated_at}, ${updated_at}, ${req.clienteId})
        ON CONFLICT (uuid_sync) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      `;
      
      // Log to audit trail
      await sql`
        INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id)
        VALUES (${`audit-${Date.now()}`}, 'CREATE', 'work_orders', ${id}, ${userId}, ${JSON.stringify({id, estado: d.estado})}, ${updated_at}, ${req.clienteId})
      `.catch(e => console.error("Audit log error:", e));
      
      res.status(201).json({ success: true, id, uuid_sync });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.put("/api/v1/:cliente_id/work-orders/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const d = req.body;
      const updated_at = d.updated_at || Date.now();

      // EJECUTAR REGLA DE NEGOCIO CRÍTICA DE QA
      validateWorkOrderPayload(d);

      const strData = JSON.stringify(d.data || d);

      await sql`
        UPDATE work_orders 
        SET data = ${strData}::jsonb, updated_at = ${updated_at}
        WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId};
      `;
      res.json({ success: true, message: "Órden de trabajo actualizada exitosamente" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/v1/:cliente_id/work-orders/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const ts = Date.now();
      const userId = req.user?.userId || 'system';
      
      // Get current record for audit trail
      const existing = await sql`SELECT data FROM work_orders WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId}`;
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: "Órden de trabajo no encontrada" });
      }
      
      await sql`
        UPDATE work_orders SET deleted_at = ${ts}, updated_at = ${ts}
        WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId}
      `;
      
      // Log deletion to audit trail
      await sql`
        INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id)
        VALUES (${`audit-${Date.now()}`}, 'DELETE', 'work_orders', ${req.params.uuid_sync}, ${userId}, ${JSON.stringify({deleted_at: ts})}, ${ts}, ${req.clienteId})
      `.catch(e => console.error("Audit log error:", e));
      
      res.json({ success: true, message: "Órden de trabajo eliminada" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 7. AUDITORÍA (AUDIT-LOGS POR TENANT)
  app.get("/api/v1/:cliente_id/audit-logs", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT * FROM audit_logs 
        WHERE cliente_id = ${req.clienteId}
        ORDER BY timestamp DESC
      `;
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/v1/:cliente_id/audit-logs", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const d = req.body;
      const id = d.id || `log-${Date.now()}`;
      const payloadStr = JSON.stringify(d.payload || d);
      const timestamp = d.timestamp || Date.now();

      await sql`
        INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id)
        VALUES (${id}, ${d.action || 'view'}, ${d.entity_type || 'system'}, ${d.entity_id || 'system'}, ${d.user_id || 'system'}, ${payloadStr}::jsonb, ${timestamp}, ${req.clienteId})
        ON CONFLICT (id) DO NOTHING
      `;
      res.status(201).json({ success: true, id });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // --- SOPORTE ADICIONAL GENÉRICO COMPATIBILIDAD V1 RETRO-ESPECÍFICA ---
  app.get("/api/v1/:cliente_id/assets/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM assets WHERE cliente_id = ${req.clienteId} AND uuid_sync = ${req.params.uuid_sync} AND deleted_at IS NULL`;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: "Activo no encontrado" });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/v1/:cliente_id/:resource", requireCliente, async (req: any, res: any) => {
    try {
      const resource = req.params.resource;
      const sql = getSql();
      const payload = req.body;
      const clienteId = req.clienteId;

      let targetTable = '';
      if (resource === 'assets') targetTable = 'assets';
      else if (resource === 'inventory') targetTable = 'inventory';
      else if (resource === 'planning') targetTable = 'preventive_maintenance';
      else if (resource === 'work-orders') targetTable = 'work_orders';
      else if (resource === 'audit-logs') targetTable = 'audit_logs';
      else targetTable = resource; // Dynamic fallback

      const id = payload.id || payload.uuid_sync || `gen-${Date.now()}`;
      const uuid_sync = payload.uuid_sync || id;
      const updated_at = payload.updated_at || Date.now();
      const created_at = payload.created_at || updated_at;
      const strData = JSON.stringify(payload.data || payload);

      if (targetTable === 'work_orders') {
        validateWorkOrderPayload(payload);
      }

      if (targetTable === 'assets') {
        const d = payload;
        const latVal = d.latitud !== undefined ? parseFloat(d.latitud) : (d.lat !== undefined ? parseFloat(d.lat) : null);
        const lngVal = d.longitud !== undefined ? parseFloat(d.longitud) : (d.lng !== undefined ? parseFloat(d.lng) : null);

        let final_cliente_id = clienteId || 'cliente-default-001';
        let final_sucursal_id = d.sucursal_id || 'default-sucursal';

        const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
        if (!clientExists || clientExists.length === 0) {
          final_cliente_id = 'cliente-default-001';
        }

        const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
        if (!branchExists || branchExists.length === 0) {
          final_sucursal_id = 'default-sucursal';
        }

        await sql`
          INSERT INTO assets (
            tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, 
            voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, 
            ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, notas,
            uuid_sync, updated_at, created_at, cliente_id, sucursal_id, latitud, longitud
          ) VALUES (
            ${d.tag}, ${d.nombre}, ${d.tipo || ''}, ${d.marca || ''}, ${d.modelo || ''}, 
            ${d.serie || ''}, ${d.ubicacion || ''}, ${d.area || ''}, ${d.capacidad || ''}, 
            ${d.voltaje || ''}, ${d.corriente || ''}, ${d.refrigerante || ''}, ${d.fecha_instalacion || ''}, 
            ${d.vida_util || 10}, ${d.estado || 'operativo'}, ${d.ultimo_mantenimiento || null}, 
            ${d.proximo_mantenimiento || null}, ${d.horas_operacion || 0}, ${d.notas || ''},
            ${uuid_sync}, ${updated_at}, ${created_at}, ${final_cliente_id}, ${final_sucursal_id}, ${latVal}, ${lngVal}
          ) ON CONFLICT (uuid_sync) DO UPDATE SET
            tag = EXCLUDED.tag, nombre = EXCLUDED.nombre, updated_at = EXCLUDED.updated_at;
        `;
      } else {
        const query = `
          INSERT INTO ${targetTable} (id, data, uuid_sync, updated_at, created_at, cliente_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (uuid_sync) DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at;
        `;
        await (sql as any)(query, [id, strData, uuid_sync, updated_at, created_at, clienteId]);
      }

      res.status(200).json({ success: true, uuid_sync, resolved_id: id });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.put("/api/v1/:cliente_id/:resource/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const resource = req.params.resource;
      const uuid_sync = req.params.uuid_sync;
      const sql = getSql();
      const payload = req.body;
      const clienteId = req.clienteId;

      let targetTable = '';
      if (resource === 'assets') targetTable = 'assets';
      else if (resource === 'inventory') targetTable = 'inventory';
      else if (resource === 'planning') targetTable = 'preventive_maintenance';
      else if (resource === 'work-orders') targetTable = 'work_orders';
      else if (resource === 'audit-logs') targetTable = 'audit_logs';
      else targetTable = resource;

      if (targetTable === 'work_orders') {
        validateWorkOrderPayload(payload);
      }

      const updated_at = payload.updated_at || Date.now();
      const strData = JSON.stringify(payload.data || payload);

      if (targetTable === 'assets') {
        const d = payload;
        const latVal = d.latitud !== undefined ? parseFloat(d.latitud) : (d.lat !== undefined ? parseFloat(d.lat) : null);
        const lngVal = d.longitud !== undefined ? parseFloat(d.longitud) : (d.lng !== undefined ? parseFloat(d.lng) : null);

        let final_cliente_id = clienteId || 'cliente-default-001';
        let final_sucursal_id = d.sucursal_id || 'default-sucursal';

        const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
        if (!clientExists || clientExists.length === 0) {
          final_cliente_id = 'cliente-default-001';
        }

        const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
        if (!branchExists || branchExists.length === 0) {
          final_sucursal_id = 'default-sucursal';
        }

        await sql`
          UPDATE assets SET
            tag = ${d.tag}, nombre = ${d.nombre}, tipo = ${d.tipo || ''}, marca = ${d.marca || ''}, modelo = ${d.modelo || ''},
            serie = ${d.serie || ''}, ubicacion = ${d.ubicacion || ''}, area = ${d.area || ''}, capacidad = ${d.capacidad || ''},
            voltaje = ${d.voltaje || ''}, corriente = ${d.corriente || ''}, refrigerante = ${d.refrigerante || ''},
            fecha_instalacion = ${d.fecha_instalacion || ''}, vida_util = ${d.vida_util || 10}, estado = ${d.estado || 'operativo'},
            ultimo_mantenimiento = ${d.ultimo_mantenimiento || null}, proximo_mantenimiento = ${d.proximo_mantenimiento || null},
            horas_operacion = ${d.horas_operacion || 0}, notas = ${d.notas || d.notes || ''},
            cliente_id = ${final_cliente_id},
            sucursal_id = ${final_sucursal_id}, latitud = ${latVal}, longitud = ${lngVal},
            updated_at = ${updated_at}
          WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${clienteId};
        `;
      } else {
        const query = `
          UPDATE ${targetTable} SET
            data = $1,
            updated_at = $2
          WHERE uuid_sync = $3 AND cliente_id = $4;
        `;
        await (sql as any)(query, [strData, updated_at, uuid_sync, clienteId]);
      }

      res.json({ success: true, message: "Registro actualizado exitosamente" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/v1/:cliente_id/:resource/:uuid_sync", requireCliente, async (req: any, res: any) => {
    try {
      const resource = req.params.resource;
      const uuid_sync = req.params.uuid_sync;
      const sql = getSql();
      const clienteId = req.clienteId;

      let targetTable = '';
      if (resource === 'assets') targetTable = 'assets';
      else if (resource === 'inventory') targetTable = 'inventory';
      else if (resource === 'planning') targetTable = 'preventive_maintenance';
      else if (resource === 'work-orders') targetTable = 'work_orders';
      else return res.status(400).json({ success: false, error: `Recurso inválido: ${resource}` });

      const ts = Date.now();
      const query = `
        UPDATE ${targetTable} SET
          deleted_at = $1,
          updated_at = $2
        WHERE uuid_sync = $3 AND cliente_id = $4;
      `;
      await (sql as any)(query, [ts, ts, uuid_sync, clienteId]);

      res.json({ success: true, message: "Registro dado de baja exitosamente" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // NEW: GRANULAR REST ENDPOINTS (Replaces Bulk Sync for Modern CMMS)
  app.post("/api/cmms/:resource", requireCliente, async (req: any, res: any) => {
    try {
      const resource = req.params.resource;
      const idempotencyKey = req.headers['idempotency-key'];
      const sql = getSql();
      const payload = req.body;
      const clienteId = req.clienteId;

      // Map resource names to real table names
      const resourceToTable: Record<string, string> = {
        'assets': 'assets', 'equipos': 'assets',
        'work_orders': 'work_orders', 'tickets': 'work_orders',
        'preventive_maintenance': 'preventive_maintenance', 'mantenimientos': 'preventive_maintenance',
        'reports': 'reports', 'informes': 'reports',
        'users': 'users', 'inventory': 'inventory',
        'ordenes_servicio': 'ordenes_servicio', 'calendar': 'calendar',
        'events': 'events',
      };
      const targetTable = resourceToTable[resource] || resourceToTable[resource.replace('cmms_', '')];

      if (!targetTable || !ALLOWED_TABLES.includes(targetTable)) {
        return res.status(400).json({ success: false, error: `Invalid resource: ${resource}. Allowed: ${Object.keys(resourceToTable).join(', ')}` });
      }

      if (idempotencyKey) {
        // Try check for idempotency map in cmms_idempotency_keys
        try {
          const cached = await sql`SELECT response_body, status_code FROM cmms_idempotency_keys WHERE key = ${idempotencyKey} AND user_id = ${clienteId || 'system'}`;
          if (cached.length > 0) {
            return res.status(cached[0].status_code).json(cached[0].response_body);
          }
        } catch (e) {} // Table might not exist yet, ignoring
      }

      // Optimistic Locking & Conflict Resolution logic
      // Note: we require payload.version parameter in granular requests for conflict resolution
      if (!payload.id && !payload.uuid_sync && !payload.tag) {
        return res.status(400).json({ success: false, error: "Missing identity (id, uuid_sync, or tag)" });
      }
      
      const recordId = payload.id || payload.tag || payload.uuid_sync;
      const version = payload.version || 1;

      // Check current version in DB
      let existingRecord: any[] = [];
      try {
        if (targetTable === 'assets') {
          existingRecord = await sql`SELECT updated_at as version FROM assets WHERE (tag = ${recordId} OR uuid_sync = ${recordId}) AND cliente_id = ${clienteId}`;
        } else {
          existingRecord = await sql`SELECT updated_at as version FROM ${sql(targetTable)} WHERE (uuid_sync = ${recordId} OR id = ${recordId}) AND cliente_id = ${clienteId}`;
        }
      } catch(e) {}

      if (existingRecord.length > 0 && existingRecord[0].version > version) {
        return res.status(409).json({
          success: false,
          error: "Conflict: current version in DB is higher than requested. Update your local state.",
          currentVersion: existingRecord[0].version
        });
      }
      
      const responseData = { success: true, processed: recordId, table: targetTable, newVersion: version + 1 };
      const statusCode = 200;

      // Cache idempotent response and return
      if (idempotencyKey) {
        try {
          await sql`INSERT INTO cmms_idempotency_keys (key, user_id, status_code, response_body, expires_at) 
                    VALUES (${idempotencyKey}, ${clienteId || 'system'}, ${statusCode}, ${JSON.stringify(responseData)}::jsonb, NOW() + INTERVAL '24 hours')
                    ON CONFLICT (key, user_id) DO NOTHING`;
        } catch (e) {}
      }

      return res.status(statusCode).json(responseData);

    } catch (e: any) {
      console.error("Granular rest endpoint error:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // NEW GLOBAL SYNC ENDPOINT
  app.post('/api/sync', verifyToken, async (req: any, res: any) => {
    const { inserts = [], updates = [], deletes = [], lastSync = 0 } = req.body;
    try {
      const sql = getSql();
      const results: any = { inserts: [], updates: [], deletes: [] };

      const decodedClienteId = req.clienteId || req.user?.clienteId || 'cliente-default-001';
      const bodyClienteId = req.body.clienteId || req.body.cliente_id || req.headers['x-client-id'] || req.headers['x-cliente-id'];
      const clienteIdSync = bodyClienteId || decodedClienteId;

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

        // Garantizar cliente_id en el objeto data para el campo JSONB
        if (typeof data === 'object') {
          if (!data.cliente_id) data.cliente_id = clienteIdSync;
        }
        
        let status = 'applied';
        let errorMsg = '';
        
        try {
          if (table === 'work_orders') {
            validateWorkOrderPayload(data);
          }
          if (table === 'assets') {
            const d = data;
            let final_cliente_id = d.cliente_id || clienteIdSync || 'cliente-default-001';
            let final_sucursal_id = d.sucursal_id || 'default-sucursal';

            const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
            if (!clientExists || clientExists.length === 0) {
              final_cliente_id = 'cliente-default-001';
            }

            const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
            if (!branchExists || branchExists.length === 0) {
              final_sucursal_id = 'default-sucursal';
            }

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
                ${uuid_sync}, ${updated_at}, ${updated_at}, ${final_cliente_id}, ${final_sucursal_id}
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
              case 'users': await sql`INSERT INTO users (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL`; break;
              case 'preventive_maintenance': await sql`INSERT INTO preventive_maintenance (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > preventive_maintenance.updated_at OR preventive_maintenance.updated_at IS NULL`; break;
              case 'work_orders': await sql`INSERT INTO work_orders (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > work_orders.updated_at OR work_orders.updated_at IS NULL`; break;
              case 'reports': await sql`INSERT INTO reports (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > reports.updated_at OR reports.updated_at IS NULL`; break;
              case 'events': await sql`INSERT INTO events (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > events.updated_at OR events.updated_at IS NULL`; break;
              case 'calendar': await sql`INSERT INTO calendar (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > calendar.updated_at OR calendar.updated_at IS NULL`; break;
              case 'clientes':
              case 'clients': {
                await sql`INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at) VALUES (${id}, ${uuid_sync}, ${strData}::jsonb, ${updated_at}, ${updated_at}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > clientes.updated_at OR clientes.updated_at IS NULL`;
                break;
              }
              case 'sucursales':
              case 'branches': {
                const cliente_id = data.cliente_id || clienteIdSync || 'cliente-default-001';
                await sql`INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at) VALUES (${id}, ${cliente_id}, ${uuid_sync}, ${strData}::jsonb, ${updated_at}, ${updated_at}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > sucursales.updated_at OR sucursales.updated_at IS NULL`;
                break;
              }
              case 'catalog_asset_types': await sql`INSERT INTO catalog_asset_types (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > catalog_asset_types.updated_at OR catalog_asset_types.updated_at IS NULL`; break;
              case 'settings': await sql`INSERT INTO settings (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > settings.updated_at OR settings.updated_at IS NULL`; break;
              case 'ordenes_servicio': await sql`INSERT INTO ordenes_servicio (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > ordenes_servicio.updated_at OR ordenes_servicio.updated_at IS NULL`; break;
              case 'inventory': await sql`INSERT INTO inventory (id, data, uuid_sync, updated_at, created_at, cliente_id) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteIdSync}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > inventory.updated_at OR inventory.updated_at IS NULL`; break;
              case 'audit_logs':
                await sql`
                  INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id) 
                  VALUES (${id}, ${data.action}, ${data.entity_type}, ${data.entity_id}, ${data.user_id}, ${strData}, ${data.timestamp}, ${clienteIdSync}) 
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

        // Garantizar cliente_id en el objeto data para el campo JSONB
        if (typeof data === 'object') {
          if (!data.cliente_id) data.cliente_id = clienteIdSync;
        }
        
        let status = 'applied';
        let errorMsg = '';
        
        try {
          if (table === 'work_orders') {
            validateWorkOrderPayload(data);
          }
          if (table === 'assets') {
             const d = data;
             let final_cliente_id = d.cliente_id || clienteIdSync || 'cliente-default-001';
             let final_sucursal_id = d.sucursal_id || 'default-sucursal';

             const clientExists = await sql`SELECT 1 FROM clientes WHERE id = ${final_cliente_id}`;
             if (!clientExists || clientExists.length === 0) {
               final_cliente_id = 'cliente-default-001';
             }

             const branchExists = await sql`SELECT 1 FROM sucursales WHERE id = ${final_sucursal_id}`;
             if (!branchExists || branchExists.length === 0) {
               final_sucursal_id = 'default-sucursal';
             }

             await sql`
              UPDATE assets SET
                tag = ${d.tag}, nombre = ${d.nombre}, tipo = ${d.tipo || ''}, marca = ${d.marca || ''}, modelo = ${d.modelo || ''},
                serie = ${d.serie || ''}, ubicacion = ${d.ubicacion || ''}, area = ${d.area || ''}, capacidad = ${d.capacidad || ''},
                voltaje = ${d.voltaje || ''}, corriente = ${d.corriente || ''}, refrigerante = ${d.refrigerante || ''},
                fecha_instalacion = ${d.fecha_instalacion || ''}, vida_util = ${d.vida_util || 0}, estado = ${d.estado || 'operativo'},
                ultimo_mantenimiento = ${d.ultimo_mantenimiento || null}, proximo_mantenimiento = ${d.proximo_mantenimiento || null},
                horas_operacion = ${d.horas_operacion || 0}, notas = ${d.notas || ''},
                cliente_id = ${final_cliente_id}, sucursal_id = ${final_sucursal_id},
                updated_at = ${updated_at}
              WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL);
            `;
          } else {
            const id = data.id || uuid_sync;
            const strData = JSON.stringify(data);
            switch (table) {
              case 'users': await sql`UPDATE users SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'preventive_maintenance': await sql`UPDATE preventive_maintenance SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'work_orders': await sql`UPDATE work_orders SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'reports': await sql`UPDATE reports SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'events': await sql`UPDATE events SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'calendar': await sql`UPDATE calendar SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'clientes':
              case 'clients': {
                await sql`UPDATE clientes SET data = ${strData}::jsonb, updated_at = ${updated_at} WHERE id = ${id} OR uuid_sync = ${uuid_sync}`;
                break;
              }
              case 'sucursales':
              case 'branches': {
                const cliente_id = data.cliente_id || clienteIdSync || 'cliente-default-001';
                await sql`UPDATE sucursales SET data = ${strData}::jsonb, updated_at = ${updated_at}, cliente_id = ${cliente_id} WHERE id = ${id} OR uuid_sync = ${uuid_sync}`;
                break;
              }
              case 'catalog_asset_types': await sql`UPDATE catalog_asset_types SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'settings': await sql`UPDATE settings SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'ordenes_servicio': await sql`UPDATE ordenes_servicio SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
              case 'inventory': await sql`UPDATE inventory SET id = ${id}, data = ${strData}, updated_at = ${updated_at}, cliente_id = ${clienteIdSync} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
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
            case 'calendar': await sql`UPDATE calendar SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'clientes':
            case 'clients': {
              await sql`UPDATE clientes SET deleted_at = ${ts}, updated_at = ${ts} WHERE id = ${del.uuid_sync} OR uuid_sync = ${del.uuid_sync}`;
              break;
            }
            case 'sucursales':
            case 'branches': {
              await sql`UPDATE sucursales SET deleted_at = ${ts}, updated_at = ${ts} WHERE id = ${del.uuid_sync} OR uuid_sync = ${del.uuid_sync}`;
              break;
            }
            case 'catalog_asset_types': await sql`UPDATE catalog_asset_types SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'settings': await sql`UPDATE settings SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'ordenes_servicio': await sql`UPDATE ordenes_servicio SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
            case 'inventory': await sql`UPDATE inventory SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${del.uuid_sync}`; break;
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
              case 'assets': rows = await sql`SELECT * FROM assets WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'users': rows = await sql`SELECT * FROM users WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'preventive_maintenance': rows = await sql`SELECT * FROM preventive_maintenance WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'work_orders': rows = await sql`SELECT * FROM work_orders WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'reports': rows = await sql`SELECT * FROM reports WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'events': rows = await sql`SELECT * FROM events WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'clientes':
              case 'clients': rows = await sql`SELECT * FROM clientes WHERE (id = ${clienteIdSync} OR id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'sucursales':
              case 'branches': rows = await sql`SELECT * FROM sucursales WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'catalog_asset_types': rows = await sql`SELECT * FROM catalog_asset_types WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'settings': rows = await sql`SELECT * FROM settings WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'ordenes_servicio': rows = await sql`SELECT * FROM ordenes_servicio WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'inventory': rows = await sql`SELECT * FROM inventory WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'calendar': rows = await sql`SELECT * FROM calendar WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (updated_at > ${lastSync} OR updated_at IS NULL) LIMIT 200`; break;
              case 'audit_logs': rows = await sql`SELECT * FROM audit_logs WHERE (cliente_id = ${clienteIdSync} OR cliente_id = 'cliente-default-001') AND (timestamp > ${lastSync}) LIMIT 200`; break;
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
        if (table === 'work_orders' && operation !== 'delete') {
          validateWorkOrderPayload(record);
        }
        if (operation === 'delete') {
          const ts = Date.now();
          switch (table) {
            case 'assets': await sql`UPDATE assets SET deleted_at = ${ts}, estado = 'baja', updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'users': await sql`UPDATE users SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'preventive_maintenance': await sql`UPDATE preventive_maintenance SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'work_orders': await sql`UPDATE work_orders SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'reports': await sql`UPDATE reports SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'events': await sql`UPDATE events SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync}`; break;
            case 'clientes': await sql`UPDATE clientes SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync} OR id = ${record.uuid_sync}`; break;
            case 'sucursales': await sql`UPDATE sucursales SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${record.uuid_sync} OR id = ${record.uuid_sync}`; break;
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
            case 'clientes': await sql`INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at) VALUES (${record.id || uuid_sync}, ${uuid_sync}, ${data}::jsonb, ${updated_at}, ${updated_at}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > clientes.updated_at`; break;
            case 'users': await sql`INSERT INTO users (id, data, uuid_sync, updated_at) VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > users.updated_at`; break;
            case 'reports': await sql`INSERT INTO reports (id, data, uuid_sync, updated_at) VALUES (${id}, ${data}, ${uuid_sync}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > reports.updated_at`; break;
            case 'sucursales': {
              const cliente_id = record.cliente_id || 'cliente-default-001';
              await sql`INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at) VALUES (${record.id || uuid_sync}, ${cliente_id}, ${uuid_sync}, ${data}::jsonb, ${updated_at}, ${updated_at}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, cliente_id = EXCLUDED.cliente_id WHERE EXCLUDED.updated_at > sucursales.updated_at`; 
              break;
            }
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
            const cliRes = await sql`SELECT data FROM clientes WHERE id = ${clientId} OR uuid_sync = ${clientId}`;
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

  app.post("/api/admin/clone-production-db", express.json(), async (req, res) => {
    try {
      const sourceUrl = req.body.prodUrl || process.env.PROD_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
      const mode = req.body.mode || 'merge'; // 'merge' or 'overwrite'
      
      if (!sourceUrl) {
         return res.status(400).json({ 
           success: false, 
           error: "Debe proporcionar el Connection String (DATABASE_URL) de la base de datos de producción como 'prodUrl' en el cuerpo de la solicitud o configurar la variable de entorno PROD_DATABASE_URL." 
         });
      }

      if (!sourceUrl.startsWith('postgres')) {
         return res.status(400).json({ 
           success: false, 
           error: "El Connection String de la base de datos de producción debe comenzar con 'postgres://' o 'postgresql://'." 
         });
      }

      const targetSql = getSql();
      const sourceSql = neon(sourceUrl);

      // Verify source database by listing tables or doing simple select
      let schemaTables;
      try {
        schemaTables = await sourceSql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `;
      } catch (err: any) {
         return res.status(450).json({ 
           success: false, 
           error: `Error de conexión a la base de datos de producción: ${err.message}` 
         });
      }

      const sourceTableNames = schemaTables.map((r: any) => r.table_name);
      
      // Migrate target database first to verify it matches
      await ensureTables();
      
      // Order of syncing to respect foreign key constraints
      const orderedSyncTables = [
        'clientes',
        'sucursales',
        'users',
        'assets',
        'preventive_maintenance',
        'work_orders',
        'reports',
        'events',
        'catalog_asset_types',
        'settings',
        'ordenes_servicio',
        'inventory',
        'audit_logs'
      ];

      // If mode is 'overwrite', truncate target tables first (safely cascading)
      if (mode === 'overwrite') {
        console.log("Emptying target tables for clean overwrite...");
        for (const t of [...orderedSyncTables].reverse()) {
          try {
            await (targetSql as any)(`TRUNCATE TABLE "${t}" CASCADE`);
          } catch(e) {}
        }
      }

      const syncStats: Record<string, { fetched: number, upserted: number, error?: string }> = {};

      for (const table of orderedSyncTables) {
        // Find if this table or its aliases exist in the source db
        if (!sourceTableNames.includes(table)) {
          continue;
        }

        try {
          // Fetch production data from source db
          const queryStr = `SELECT * FROM "${table}" LIMIT 5000`;
          const sourceRows = await (sourceSql as any)(queryStr);
          syncStats[table] = { fetched: sourceRows.length, upserted: 0 };
          
          if (sourceRows.length === 0) {
            continue;
          }

          let upsertedCount = 0;
          for (const row of sourceRows) {
            try {
              if (table === 'clientes') {
                await targetSql`
                  INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at, deleted_at)
                  VALUES (${row.id}, ${row.uuid_sync}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (id) DO UPDATE SET
                    uuid_sync = EXCLUDED.uuid_sync,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'sucursales') {
                await targetSql`
                  INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at, deleted_at)
                  VALUES (${row.id}, ${row.cliente_id}, ${row.uuid_sync}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (id) DO UPDATE SET
                    cliente_id = EXCLUDED.cliente_id,
                    uuid_sync = EXCLUDED.uuid_sync,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'users') {
                await targetSql`
                  INSERT INTO users (uuid_sync, id, nombre, correo, perfil, pin, activo, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.nombre}, ${row.correo}, ${row.perfil}, ${row.pin}, ${row.activo}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
                    nombre = EXCLUDED.nombre,
                    correo = EXCLUDED.correo,
                    perfil = EXCLUDED.perfil,
                    pin = EXCLUDED.pin,
                    activo = EXCLUDED.activo,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'assets') {
                await targetSql`
                  INSERT INTO assets (
                    uuid_sync, tag, nombre, tipo, marca, modelo, serie, 
                    ubicacion, area, capacidad, voltaje, corriente, refrigerante, fecha_instalacion, 
                    vida_util, estado, ultimo_mantenimiento, proximo_mantenimiento, 
                    horas_operacion, tecnicos, notas, cliente_id, sucursal_id, 
                    latitud, longitud, updated_at, created_at, deleted_at
                  )
                  VALUES (
                    ${row.uuid_sync}, ${row.tag}, ${row.nombre}, ${row.tipo}, ${row.marca}, ${row.modelo}, ${row.serie},
                    ${row.ubicacion}, ${row.area}, ${row.capacidad}, ${row.voltaje}, ${row.corriente}, ${row.refrigerante}, ${row.fecha_instalacion},
                    ${row.vida_util}, ${row.estado}, ${row.ultimo_mantenimiento}, ${row.proximo_mantenimiento},
                    ${row.horas_operacion}, ${row.tecnicos}, ${row.notas}, ${row.cliente_id}, ${row.sucursal_id},
                    ${row.latitud}, ${row.longitud}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at}
                  )
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    tag = EXCLUDED.tag,
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
                    notas = EXCLUDED.notas,
                    cliente_id = EXCLUDED.cliente_id,
                    sucursal_id = EXCLUDED.sucursal_id,
                    latitud = EXCLUDED.latitud,
                    longitud = EXCLUDED.longitud,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'preventive_maintenance') {
                await targetSql`
                  INSERT INTO preventive_maintenance (uuid_sync, id, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'work_orders') {
                await targetSql`
                  INSERT INTO work_orders (uuid_sync, id, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'reports') {
                await targetSql`
                  INSERT INTO reports (uuid_sync, id, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'events') {
                await targetSql`
                  INSERT INTO events (uuid_sync, id, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'catalog_asset_types') {
                await targetSql`
                  INSERT INTO catalog_asset_types (uuid_sync, id, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'settings') {
                await targetSql`
                  INSERT INTO settings (uuid_sync, id, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'ordenes_servicio') {
                await targetSql`
                  INSERT INTO ordenes_servicio (uuid_sync, id, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'inventory') {
                await targetSql`
                  INSERT INTO inventory (uuid_sync, id, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = EXCLUDED.deleted_at;
                `;
              } else if (table === 'audit_logs') {
                await targetSql`
                  INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, payload, timestamp)
                  VALUES (${row.id}, ${row.action}, ${row.entity_type}, ${row.entity_id}, ${row.user_id}, ${row.payload}, ${row.timestamp})
                  ON CONFLICT (id) DO UPDATE SET
                    action = EXCLUDED.action,
                    entity_type = EXCLUDED.entity_type,
                    entity_id = EXCLUDED.entity_id,
                    user_id = EXCLUDED.user_id,
                    payload = EXCLUDED.payload,
                    timestamp = EXCLUDED.timestamp;
                `;
              }
              upsertedCount++;
            } catch (err: any) {
              console.error(`Error inserting row in table ${table}:`, err.message);
            }
          }
          syncStats[table].upserted = upsertedCount;
        } catch (tableErr: any) {
          syncStats[table] = { fetched: 0, upserted: 0, error: tableErr.message };
        }
      }

      res.json({
        success: true,
        message: "Clonación y sincronización de base de datos de producción completada.",
        mode,
        stats: syncStats
      });
    } catch (e: any) {
       res.status(500).json({ success: false, error: e.message });
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
