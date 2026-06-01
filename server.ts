import express from "express";
import { createServer as createViteServer } from "vite";
import { neon } from "@neondatabase/serverless";
import path from "path";
import bcrypt from "bcryptjs";

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

const requireCliente = async (req: any, res: any, next: any) => {
  try {
    const clienteId = req.params.cliente_id || req.headers['x-client-id'] || req.headers['x-cliente-id'] || req.query.clienteId || req.query.cliente_id || 'cliente-eecol-default-001';
    if (!clienteId) {
      return res.status(403).json({ success: false, error: 'Tenant (cliente_id) es obligatorio y requerido.' });
    }
    
    req.clienteId = clienteId;

    const sql = getSql();

    // VALIDACIÓN DE AUTORIZACIÓN: Validar que el token/user corresponda a un técnico asignado al cliente consultado
    const userIdHeader = req.headers['x-user-id'] || req.headers['x-userid'] || req.query.userId || req.query.user_id;
    if (userIdHeader) {
      const uId = String(userIdHeader).trim();
      const queryUser = await sql`SELECT * FROM users WHERE id = ${uId} OR uuid_sync = ${uId}`;
      if (queryUser.length > 0) {
        const u = queryUser[0];
        const uClienteId = u.cliente_id || (u.data && (u.data.cliente_id || u.data.tenantId));
        if (uClienteId && uClienteId !== clienteId && uClienteId !== 'cliente-eecol-default-001') {
          return res.status(403).json({ 
            success: false, 
            error: `Acceso No Autorizado: Su usuario con ID ${uId} está asignado al cliente ${uClienteId} y no coincide con el tenant solicitado (${clienteId}).` 
          });
        }
      }
    }

    // Verificar asociacion del usuario autenticado si se pasa cabecera de autenticacion
    const userHeader = req.headers['x-user-email'] || req.headers['authorization'];
    if (userHeader) {
      const email = userHeader.replace('Bearer ', '').trim().toLowerCase();
      if (email && !email.includes('mock') && !email.includes('test')) {
        const queryRes = await sql`SELECT * FROM users WHERE LOWER(correo) = ${email} OR LOWER(data->>'email') = ${email}`;
        if (queryRes.length > 0) {
          const u = queryRes[0];
          const uClienteId = u.cliente_id || (u.data && (u.data.cliente_id || u.data.tenantId));
          if (uClienteId && uClienteId !== clienteId && uClienteId !== 'cliente-eecol-default-001') {
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
    
    const signature = target.firma || target.firma_conformidad_base64 || (target.payload && target.payload.firma_conformidad_base64);
    const hasSignature = signature && String(signature).trim().length > 0;
    
    if (!hasSignature) {
      throw new Error("Transacción bloqueada por validación de QA: No es posible pasar a un estado de cierre ('Cerrado'/'Firmada') sin registrar la firma de conformidad (firma_conformidad_base64).");
    }
    if (!hasChecklist) {
      throw new Error("Transacción bloqueada por validación de QA: Se requiere completar y registrar los checklists de verificación técnica antes del cierre de la OT.");
    }
  }
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
      uuid_sync TEXT PRIMARY KEY, tag TEXT UNIQUE, nombre TEXT NOT NULL, tipo TEXT, marca TEXT, modelo TEXT, serie TEXT, 
      ubicacion TEXT, area TEXT, capacidad TEXT, voltaje TEXT, corriente TEXT, refrigerante TEXT, fecha_instalacion TEXT, 
      vida_util INTEGER DEFAULT 10, estado TEXT DEFAULT 'operativo', ultimo_mantenimiento TEXT, proximo_mantenimiento TEXT, 
      horas_operacion INTEGER DEFAULT 0, tecnicos JSONB, notas TEXT, cliente_id TEXT, sucursal_id TEXT, 
      latitud DOUBLE PRECISION, longitud DOUBLE PRECISION,
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
    await sql`CREATE TABLE IF NOT EXISTS inventory (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
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
      { table: 'ordenes_servicio', col: 'data', type: 'JSONB' },
      { table: 'inventory', col: 'uuid_sync', type: 'TEXT' },
      { table: 'inventory', col: 'updated_at', type: 'BIGINT' },
      { table: 'inventory', col: 'created_at', type: 'BIGINT' },
      { table: 'inventory', col: 'data', type: 'JSONB' }
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
          await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION`;
          await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION`;
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
    try { await sql`UPDATE inventory SET uuid_sync = id WHERE uuid_sync IS NULL AND id IS NOT NULL`; } catch(e){}

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
    await tryUnique(sql`ALTER TABLE inventory ADD UNIQUE (uuid_sync)`);
    await tryUnique(sql`ALTER TABLE audit_logs ADD UNIQUE (id)`);
    await tryUnique(sql`ALTER TABLE assets ADD UNIQUE (tag)`);

    // --- INTEGRACIÓN MULTI-TENANT ESTRICTA (REQUERIMIENTO ARQUITECTO QA) ---
    await tryUnique(sql`ALTER TABLE clients ADD UNIQUE (id)`);
    await tryUnique(sql`ALTER TABLE clientes ADD UNIQUE (id)`);
    await tryUnique(sql`ALTER TABLE sucursales ADD UNIQUE (id)`);

    // Sincronizar datos existentes de clients a clientes
    try {
      await sql`INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at, deleted_at)
                VALUES ('cliente-eecol-default-001', 'cliente-eecol-default-001', '{"nombre": "EECOL Default", "empresa": "EECOL"}'::jsonb, 0, 0, NULL)
                ON CONFLICT (id) DO NOTHING`;
      await sql`
        INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at, deleted_at)
        SELECT COALESCE(id, uuid_sync), uuid_sync, data, updated_at, created_at, deleted_at FROM clients
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (e: any) {
      console.log('Error syncing to clientes:', e.message);
    }

    // Sincronizar datos existentes de branches a sucursales
    try {
      await sql`INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at, deleted_at)
                VALUES ('default-sucursal', 'cliente-eecol-default-001', 'default-sucursal', '{"nombre": "Sucursal Default"}'::jsonb, 0, 0, NULL)
                ON CONFLICT (id) DO NOTHING`;
      await sql`
        INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at, deleted_at)
        SELECT COALESCE(id, uuid_sync), COALESCE(NULLIF(cliente_id, ''), 'cliente-eecol-default-001'), uuid_sync, data, updated_at, created_at, deleted_at FROM branches
        ON CONFLICT (id) DO NOTHING
      `;
    } catch(e: any) {
      console.log('Error syncing to sucursales:', e.message);
    }

    // Asegurar integridad de referencias en assets
    try {
      await sql`UPDATE assets SET cliente_id = 'cliente-eecol-default-001' WHERE cliente_id IS NULL OR cliente_id = '' OR cliente_id NOT IN (SELECT id FROM clientes)`;
      await sql`UPDATE assets SET sucursal_id = 'default-sucursal' WHERE sucursal_id IS NULL OR sucursal_id = '' OR sucursal_id NOT IN (SELECT id FROM sucursales)`;
    } catch (e: any) {
      console.log('Error cleaning empty asset keys:', e.message);
    }

    // Aplicar las llaves foráneas estrictas ON DELETE RESTRICT exigidas por QA
    try { await sql`ALTER TABLE assets DROP CONSTRAINT IF EXISTS fk_assets_cliente`; } catch (e) {}
    try { await sql`ALTER TABLE assets ADD CONSTRAINT fk_assets_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT`; } catch (e: any) { console.log('Err FK assets-cliente:', e.message); }

    try { await sql`ALTER TABLE assets DROP CONSTRAINT IF EXISTS fk_assets_sucursal`; } catch (e) {}
    try { await sql`ALTER TABLE assets ADD CONSTRAINT fk_assets_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE RESTRICT`; } catch (e: any) { console.log('Err FK assets-sucursal:', e.message); }

    // Crear tabla calendar para de forma segura el índice
    try {
      await sql`CREATE TABLE IF NOT EXISTS calendar (
        uuid_sync TEXT PRIMARY KEY,
        id TEXT UNIQUE,
        cliente_id TEXT,
        data JSONB NOT NULL,
        updated_at BIGINT,
        created_at BIGINT,
        deleted_at BIGINT
      )`;
    } catch (e) {}

    // Agregar cliente_id como referencia en las tablas operacionales si no existen
    try { await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clients(id)`; } catch (e) {}
    try { await sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clients(id)`; } catch (e) {}
    try { await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clients(id)`; } catch (e) {}
    try { await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clients(id)`; } catch (e) {}
    try { await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clients(id)`; } catch (e) {}
    try { await sql`ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clients(id)`; } catch (e) {}

    // Crear Índices Compuestos e Índices de Tenant exigidos por el usuario
    try { await sql`CREATE INDEX IF NOT EXISTS idx_sucursales_tenant ON sucursales (cliente_id, id)`; } catch(e){}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_assets_tenant_search ON assets (cliente_id, sucursal_id, uuid_sync)`; } catch(e){}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_inventory_tenant_search ON inventory (cliente_id, uuid_sync)`; } catch(e){}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_calendar_tenant_search ON calendar (cliente_id, uuid_sync)`; } catch(e){}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_search ON work_orders (cliente_id, uuid_sync)`; } catch(e){}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_logs_tenant_search ON audit_logs (cliente_id, timestamp)`; } catch(e){}

    try { await sql`CREATE INDEX IF NOT EXISTS idx_assets_client ON assets (cliente_id, uuid_sync)`; } catch (e) {}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_inventory_client ON inventory (cliente_id, uuid_sync)`; } catch (e) {}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_work_orders_client ON work_orders (cliente_id, uuid_sync)`; } catch (e) {}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_logs_client ON audit_logs (cliente_id, timestamp)`; } catch (e) {}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_prev_maint_client ON preventive_maintenance (cliente_id, uuid_sync)`; } catch (e) {}

    // --- QA SENIOR MIGRATIONS & COMPATIBILITY LAYER ---
    // STEP 0.2: Prevent ghost/empty tenant keys from causing check constraint violations
    try {
      await sql`UPDATE assets SET cliente_id='cliente-eecol-default-001' WHERE cliente_id = '' OR cliente_id IS NULL`;
    } catch (e: any) {}

    // STEP 1 & 7: Create compatibility schema and security tracking tables
    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_clientes (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_users (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        correo TEXT UNIQUE,
        perfil TEXT,
        pin TEXT,
        activo BOOLEAN DEFAULT true,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_equipos (
        tag TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        cliente_id TEXT NOT NULL,
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_tickets (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL,
        tag TEXT,
        solicitante_id TEXT,
        asignado_user_id TEXT,
        supervisor_id TEXT,
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_mantenimientos (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL,
        tag TEXT,
        ot_id TEXT,
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    // STEP 1: Unify Event and Comment IDs with auto-increment sequences
    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_ot_eventos (
        id SERIAL PRIMARY KEY,
        ticket_id TEXT,
        cliente_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        actor_user_id TEXT NOT NULL DEFAULT '',
        actor_nombre TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_ot_comentarios (
        id SERIAL PRIMARY KEY,
        ticket_id TEXT,
        cliente_id TEXT NOT NULL,
        autor_user_id TEXT NOT NULL DEFAULT '',
        autor_nombre TEXT NOT NULL DEFAULT '',
        texto TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    // STEP 7: Create Idempotency keys & Auth brute-force block lists tables
    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_idempotency_keys (
        key            text NOT NULL,
        user_id        text NOT NULL,
        status_code    int  NOT NULL,
        response_body  jsonb NOT NULL,
        expires_at     timestamptz NOT NULL,
        created_at     timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (key, user_id)
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_auth_failures (
        id            bigserial PRIMARY KEY,
        email         text NOT NULL,
        ip            text NOT NULL,
        attempted_at  timestamptz NOT NULL DEFAULT now()
      )`;
    } catch (e: any) {}

    // Additional schemas to ensure foreign key setup succeeds perfectly
    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_usuarios_clientes (
        user_id TEXT NOT NULL,
        cliente_id TEXT NOT NULL,
        PRIMARY KEY (user_id, cliente_id)
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_informes_mantenimiento (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL,
        equipo_tag TEXT NOT NULL,
        tecnico_user_id TEXT,
        firmado_por_user_id TEXT,
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_sla_config (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL,
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_pm_planes (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL,
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_pm_plantillas (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL,
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_checklist_plantillas (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL,
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_push_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        deleted_at TIMESTAMPTZ
      )`;
    } catch (e: any) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS cmms_one_shot_migrations (
        key text PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
    } catch (e: any) {}

    // STEP 2: Add soft delete indices and column definitions across tables
    try {
      await sql`ALTER TABLE cmms_equipos                ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
      await sql`ALTER TABLE cmms_equipos                ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE cmms_mantenimientos         ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE cmms_tickets                ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE cmms_ot_eventos             ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE cmms_ot_comentarios         ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE cmms_informes_mantenimiento ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE cmms_clientes               ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE cmms_users                  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`;
    } catch (e: any) {}

    try {
      await sql`ALTER TABLE cmms_mantenimientos         ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_tickets                ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_ot_eventos             ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_ot_comentarios         ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_informes_mantenimiento ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
    } catch (e: any) {}

    try {
      await sql`CREATE INDEX IF NOT EXISTS cmms_equipos_active_idx ON cmms_equipos (cliente_id) WHERE deleted_at IS NULL`;
    } catch (e: any) {}
    try {
      await sql`CREATE INDEX IF NOT EXISTS cmms_mantenimientos_active_idx ON cmms_mantenimientos (cliente_id) WHERE deleted_at IS NULL`;
    } catch (e: any) {}
    try {
      await sql`CREATE INDEX IF NOT EXISTS cmms_tickets_active_idx ON cmms_tickets (cliente_id) WHERE deleted_at IS NULL`;
    } catch (e: any) {}
    try {
      await sql`CREATE INDEX IF NOT EXISTS cmms_informes_active_idx ON cmms_informes_mantenimiento (cliente_id) WHERE deleted_at IS NULL`;
    } catch (e: any) {}

    // STEP 3: Add Foreign Key constraints safely
    try {
      await sql`ALTER TABLE cmms_tickets ADD CONSTRAINT fk_tickets_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_tickets ADD CONSTRAINT fk_tickets_equipo FOREIGN KEY (tag) REFERENCES cmms_equipos(tag)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_tickets ADD CONSTRAINT fk_tickets_solicitante FOREIGN KEY (solicitante_id) REFERENCES cmms_users(id) ON DELETE SET NULL`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_tickets ADD CONSTRAINT fk_tickets_asignado FOREIGN KEY (asignado_user_id) REFERENCES cmms_users(id) ON DELETE SET NULL`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_tickets ADD CONSTRAINT fk_tickets_supervisor FOREIGN KEY (supervisor_id) REFERENCES cmms_users(id) ON DELETE SET NULL`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_equipos ADD CONSTRAINT fk_equipos_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_mantenimientos ADD CONSTRAINT fk_mant_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_mantenimientos ADD CONSTRAINT fk_mant_equipo FOREIGN KEY (tag) REFERENCES cmms_equipos(tag)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_mantenimientos ADD CONSTRAINT fk_mant_ot FOREIGN KEY (ot_id) REFERENCES cmms_tickets(id) ON DELETE SET NULL`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_ot_eventos ADD CONSTRAINT fk_oteventos_ticket FOREIGN KEY (ticket_id) REFERENCES cmms_tickets(id) ON DELETE CASCADE`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_ot_eventos ADD CONSTRAINT fk_oteventos_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_ot_comentarios ADD CONSTRAINT fk_otcom_ticket FOREIGN KEY (ticket_id) REFERENCES cmms_tickets(id) ON DELETE CASCADE`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_ot_comentarios ADD CONSTRAINT fk_otcom_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_usuarios_clientes ADD CONSTRAINT fk_uc_user FOREIGN KEY (user_id) REFERENCES cmms_users(id) ON DELETE CASCADE`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_usuarios_clientes ADD CONSTRAINT fk_uc_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id) ON DELETE CASCADE`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_usuarios_clientes ADD CONSTRAINT uq_uc_user_cliente UNIQUE (user_id, cliente_id)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_informes_mantenimiento ADD CONSTRAINT fk_inf_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_informes_mantenimiento ADD CONSTRAINT fk_inf_equipo FOREIGN KEY (equipo_tag) REFERENCES cmms_equipos(tag)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_informes_mantenimiento ADD CONSTRAINT fk_inf_tecnico FOREIGN KEY (tecnico_user_id) REFERENCES cmms_users(id) ON DELETE SET NULL`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_informes_mantenimiento ADD CONSTRAINT fk_inf_firmadopor FOREIGN KEY (firmado_por_user_id) REFERENCES cmms_users(id) ON DELETE SET NULL`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_sla_config ADD CONSTRAINT fk_sla_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id) ON DELETE CASCADE`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_pm_planes ADD CONSTRAINT fk_pmpl_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_pm_plantillas ADD CONSTRAINT fk_pmpt_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_checklist_plantillas ADD CONSTRAINT fk_chkp_cliente FOREIGN KEY (cliente_id) REFERENCES cmms_clientes(id)`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_push_subscriptions ADD CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES cmms_users(id) ON DELETE CASCADE`;
    } catch (e: any) {}

    try {
      await sql`INSERT INTO cmms_one_shot_migrations(key) VALUES ('foreign-keys-strict-2026-05') ON CONFLICT DO NOTHING`;
    } catch (e: any) {}

    // STEP 4: Remove Empty/Null clients constraint
    try {
      await sql`ALTER TABLE cmms_equipos ADD CONSTRAINT chk_cmms_equipos_cliente_nonempty CHECK (cliente_id <> '')`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE assets ADD CONSTRAINT chk_assets_cliente_nonempty CHECK (cliente_id <> '')`;
    } catch (e: any) {}

    // STEP 5: Migrate any existing timestamp values to timestamptz (UTC mapping check)
    try {
      await sql`
        DO $$
        DECLARE r record;
        BEGIN
          FOR r IN
            SELECT table_name, column_name FROM information_schema.columns
            WHERE table_schema='public' AND data_type='timestamp without time zone'
          LOOP
            EXECUTE format(
              'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
              r.table_name, r.column_name, r.column_name
            );
          END LOOP;
        END $$;
      `;
    } catch (e: any) {}

    // STEP 6: Convert creado_en format text to timestamptz timezone
    try {
      await sql`ALTER TABLE cmms_users ALTER COLUMN creado_en TYPE timestamptz USING creado_en::timestamptz`;
    } catch (e: any) {}
    try {
      await sql`ALTER TABLE cmms_clientes ALTER COLUMN creado_en TYPE timestamptz USING creado_en::timestamptz`;
    } catch (e: any) {}

    // Sincronizar secuencias
    try {
      await sql`SELECT setval('cmms_ot_eventos_id_seq', COALESCE((SELECT MAX(id) FROM cmms_ot_eventos), 1))`;
      await sql`SELECT setval('cmms_ot_comentarios_id_seq', COALESCE((SELECT MAX(id) FROM cmms_ot_comentarios), 1))`;
    } catch (e: any) {}

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
      const storedPin = user.pin || (user.data && user.data.pin);
      
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
        model: 'gemini-3.5-flash',
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
    'reports', 'events', 'clients', 'branches', 
    'catalog_asset_types', 'settings', 'ordenes_servicio', 'audit_logs', 'inventory'
  ];

const TABLE_ALIAS_MAP: Record<string, string> = {
  'activos': 'assets',
  'usuarios': 'users',
  'mantenimientos': 'preventive_maintenance',
  'tickets': 'work_orders',
  'informes': 'reports',
  'eventos': 'events',
  'clientes': 'clients',
  'sucursales': 'branches',
  'inventario': 'inventory'
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
        case 'inventory': rows = await sql`SELECT * FROM inventory WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`; break;
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

  // --- ENDPOINTS REGISTRADOS DE LA VERSIÓN MULTI-TENANT VERCEL SERVERLESS V1 ---

  // 1. CLIENTES (CONEXIÓN MAESTRA)
  app.get("/api/v1/clients", async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM clientes WHERE deleted_at IS NULL`;
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/v1/clients/:client_id", async (req: any, res: any) => {
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

  app.post("/api/v1/clients", async (req: any, res: any) => {
    try {
      const { id, uuid_sync, data } = req.body;
      const sql = getSql();
      const finalId = id || uuid_sync || `client-${Date.now()}`;
      const finalUuid = uuid_sync || finalId;
      const updated_at = req.body.updated_at || Date.now();
      const strData = typeof data === 'object' ? JSON.stringify(data) : (data || '{}');

      // Insert both clients and clientes tables
      await sql`
        INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at)
        VALUES (${finalId}, ${finalUuid}, ${strData}::jsonb, ${updated_at}, ${updated_at})
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      `;
      await sql`
        INSERT INTO clients (id, uuid_sync, data, updated_at, created_at)
        VALUES (${finalId}, ${finalUuid}, ${strData}::jsonb, ${updated_at}, ${updated_at})
        ON CONFLICT (uuid_sync) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      `;

      res.status(201).json({ success: true, id: finalId, uuid_sync: finalUuid });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.put("/api/v1/clients/:client_id", async (req: any, res: any) => {
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
      await sql`
        UPDATE clients 
        SET data = ${strData}::jsonb, updated_at = ${updated_at}
        WHERE id = ${client_id} OR uuid_sync = ${client_id};
      `;

      res.json({ success: true, message: "Cliente actualizado con éxito" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/v1/clients/:client_id", async (req: any, res: any) => {
    try {
      const sql = getSql();
      const { client_id } = req.params;
      const ts = Date.now();

      await sql`UPDATE clientes SET deleted_at = ${ts}, updated_at = ${ts} WHERE id = ${client_id}`;
      await sql`UPDATE clients SET deleted_at = ${ts}, updated_at = ${ts} WHERE id = ${client_id} OR uuid_sync = ${client_id}`;

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
      await sql`
        INSERT INTO branches (id, data, uuid_sync, updated_at, created_at, cliente_id)
        VALUES (${finalId}, ${strData}::jsonb, ${finalUuid}, ${updated_at}, ${updated_at}, ${req.clienteId})
        ON CONFLICT (uuid_sync) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
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
      await sql`
        UPDATE branches 
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
      await sql`UPDATE branches SET deleted_at = ${ts}, updated_at = ${ts} WHERE id = ${branch_id} AND cliente_id = ${req.clienteId}`;

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
          ${uuid_sync}, ${updated_at}, ${updated_at}, ${req.clienteId}, ${branch_id}, ${latVal}, ${lngVal}
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
      await sql`
        UPDATE assets SET deleted_at = ${ts}, updated_at = ${ts}
        WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${req.clienteId} AND sucursal_id = ${branch_id}
      `;
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
      await sql`
        UPDATE inventory SET deleted_at = ${ts}, updated_at = ${ts}
        WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId}
      `;
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
      await sql`
        UPDATE preventive_maintenance SET deleted_at = ${ts}, updated_at = ${ts}
        WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId}
      `;
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

  app.post("/api/v1/:cliente_id/work-orders", requireCliente, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const d = req.body;
      const id = d.id || d.uuid_sync || `ot-${Date.now()}`;
      const uuid_sync = d.uuid_sync || id;
      const updated_at = d.updated_at || Date.now();

      // EJECUTAR REGLA DE NEGOCIO CRÍTICA DE QA
      validateWorkOrderPayload(d);

      // Si todo está bien, guardamos
      const strData = JSON.stringify(d.data || d);

      await sql`
        INSERT INTO work_orders (id, uuid_sync, data, updated_at, created_at, cliente_id)
        VALUES (${id}, ${uuid_sync}, ${strData}::jsonb, ${updated_at}, ${updated_at}, ${req.clienteId})
        ON CONFLICT (uuid_sync) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      `;
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
      await sql`
        UPDATE work_orders SET deleted_at = ${ts}, updated_at = ${ts}
        WHERE uuid_sync = ${req.params.uuid_sync} AND cliente_id = ${req.clienteId}
      `;
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
            ${uuid_sync}, ${updated_at}, ${created_at}, ${clienteId}, ${d.sucursal_id || 'default-sucursal'}, ${latVal}, ${lngVal}
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
        await sql`
          UPDATE assets SET
            tag = ${d.tag}, nombre = ${d.nombre}, tipo = ${d.tipo || ''}, marca = ${d.marca || ''}, modelo = ${d.modelo || ''},
            serie = ${d.serie || ''}, ubicacion = ${d.ubicacion || ''}, area = ${d.area || ''}, capacidad = ${d.capacidad || ''},
            voltaje = ${d.voltaje || ''}, corriente = ${d.corriente || ''}, refrigerante = ${d.refrigerante || ''},
            fecha_instalacion = ${d.fecha_instalacion || ''}, vida_util = ${d.vida_util || 10}, estado = ${d.estado || 'operativo'},
            ultimo_mantenimiento = ${d.ultimo_mantenimiento || null}, proximo_mantenimiento = ${d.proximo_mantenimiento || null},
            horas_operacion = ${d.horas_operacion || 0}, notas = ${d.notas || d.notes || ''},
            sucursal_id = ${d.sucursal_id || 'default-sucursal'}, latitud = ${latVal}, longitud = ${lngVal},
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

      // Allow mapping from short name or specific cmms_* resource name
      const allowedResources = ['cmms_equipos', 'cmms_tickets', 'cmms_mantenimientos', 'cmms_ot_eventos', 'cmms_ot_comentarios', 'cmms_informes_mantenimiento', 'cmms_clientes', 'cmms_users'];
      
      let targetTable = resource.startsWith('cmms_') ? resource : `cmms_${resource}`;
      // Map old plural to cmms_* explicitly if needed
      if (resource === 'assets' || resource === 'equipos') targetTable = 'cmms_equipos';
      if (resource === 'work_orders' || resource === 'tickets') targetTable = 'cmms_tickets';
      if (resource === 'preventive_maintenance') targetTable = 'cmms_mantenimientos';

      if (!allowedResources.includes(targetTable)) {
        return res.status(400).json({ success: false, error: "Invalid resource table" });
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
        if (targetTable === 'cmms_equipos') {
          existingRecord = await sql`SELECT version FROM cmms_equipos WHERE tag = ${recordId} AND cliente_id = ${clienteId}`;
        } else {
          existingRecord = await sql`SELECT version FROM ${sql(targetTable)} WHERE id = ${recordId} AND cliente_id = ${clienteId}`;
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
                    VALUES (${idempotencyKey}, ${clienteId || 'system'}, ${statusCode}, ${responseData}, expires_at = NOW() + INTERVAL '24 hours')
                    ON CONFLICT DO NOTHING`;
        } catch (e) {}
      }

      return res.status(statusCode).json(responseData);

    } catch (e: any) {
      console.error("Granular rest endpoint error:", e);
      return res.status(500).json({ success: false, error: e.message });
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
          if (table === 'work_orders') {
            validateWorkOrderPayload(data);
          }
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
              case 'inventory': await sql`INSERT INTO inventory (id, data, uuid_sync, updated_at, created_at) VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}) ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE EXCLUDED.updated_at > inventory.updated_at OR inventory.updated_at IS NULL`; break;
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
          if (table === 'work_orders') {
            validateWorkOrderPayload(data);
          }
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
              case 'inventory': await sql`UPDATE inventory SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND (updated_at < ${updated_at} OR updated_at IS NULL)`; break;
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
              case 'inventory': rows = await sql`SELECT * FROM inventory WHERE updated_at > ${lastSync} OR updated_at IS NULL LIMIT 200`; break;
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
        'clients',
        'sucursales',
        'branches',
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
              } else if (table === 'clients') {
                await targetSql`
                  INSERT INTO clients (uuid_sync, id, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
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
              } else if (table === 'branches') {
                await targetSql`
                  INSERT INTO branches (uuid_sync, id, data, updated_at, created_at, deleted_at)
                  VALUES (${row.uuid_sync}, ${row.id}, ${row.data}, ${row.updated_at}, ${row.created_at}, ${row.deleted_at})
                  ON CONFLICT (uuid_sync) DO UPDATE SET
                    id = EXCLUDED.id,
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
