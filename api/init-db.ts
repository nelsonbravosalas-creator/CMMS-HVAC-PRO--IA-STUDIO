import { getDb } from './_db.js';

export default async function handler(req: any, res: any) {
  try {
    let dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ success: false, error: "DATABASE_URL no configurado en variables de entorno" });
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ success: false, error: "Método no permitido" });
    }

    const sql = getDb();

    // Reset database schema and recreate as defined in specifications
    const schemaSql = `
      -- Limpiar todo
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;

      -- CLIENTES
      CREATE TABLE clientes (
        id           TEXT PRIMARY KEY,
        uuid_sync    TEXT UNIQUE NOT NULL,
        data         JSONB NOT NULL DEFAULT '{}',
        updated_at   BIGINT,
        created_at   BIGINT,
        deleted_at   BIGINT
      );

      -- SUCURSALES
      CREATE TABLE sucursales (
        id           TEXT PRIMARY KEY,
        cliente_id   TEXT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
        uuid_sync    TEXT UNIQUE NOT NULL,
        data         JSONB NOT NULL DEFAULT '{}',
        updated_at   BIGINT,
        created_at   BIGINT,
        deleted_at   BIGINT
      );

      -- ASSETS (equipos)
      CREATE TABLE assets (
        uuid_sync             TEXT PRIMARY KEY,
        tag                   TEXT UNIQUE NOT NULL,
        nombre                TEXT NOT NULL,
        tipo                  TEXT,
        marca                 TEXT,
        modelo                TEXT,
        serie                 TEXT,
        ubicacion             TEXT,
        area                  TEXT,
        capacidad             TEXT,
        voltaje               TEXT,
        corriente             TEXT,
        refrigerante          TEXT,
        fecha_instalacion     TEXT,
        vida_util             INTEGER DEFAULT 10,
        estado                TEXT DEFAULT 'operativo',
        ultimo_mantenimiento  TEXT,
        proximo_mantenimiento TEXT,
        frecuencia_mantenimiento TEXT,
        horas_operacion       INTEGER DEFAULT 0,
        tecnicos              JSONB DEFAULT '[]',
        notas                 TEXT,
        cliente_id            TEXT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
        sucursal_id           TEXT NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
        latitud               DOUBLE PRECISION,
        longitud              DOUBLE PRECISION,
        updated_at            BIGINT,
        created_at            BIGINT,
        deleted_at            BIGINT
      );

      -- USERS
      CREATE TABLE users (
        uuid_sync  TEXT PRIMARY KEY,
        id         TEXT UNIQUE,
        nombre     TEXT,
        correo     TEXT UNIQUE,
        perfil     TEXT,
        pin        TEXT,
        activo     BOOLEAN DEFAULT true,
        cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
        data       JSONB DEFAULT '{}',
        updated_at BIGINT,
        created_at BIGINT,
        deleted_at BIGINT
      );

      -- WORK ORDERS (órdenes de trabajo)
      CREATE TABLE work_orders (
        uuid_sync      TEXT PRIMARY KEY,
        id             TEXT UNIQUE,
        titulo         TEXT,
        descripcion    TEXT,
        prioridad      TEXT DEFAULT 'media',
        estado         TEXT DEFAULT 'abierto',
        equipo_tag     TEXT,
        cliente_id     TEXT REFERENCES clientes(id) ON DELETE RESTRICT,
        creado_por     TEXT,
        asignado_a     TEXT,
        fecha_creacion TEXT,
        fecha_cierre   TEXT,
        data           JSONB DEFAULT '{}',
        updated_at     BIGINT,
        created_at     BIGINT,
        deleted_at     BIGINT
      );

      -- PREVENTIVE MAINTENANCE (informes de mantenimiento)
      CREATE TABLE preventive_maintenance (
        uuid_sync   TEXT PRIMARY KEY,
        id          TEXT UNIQUE,
        equipo_tag  TEXT,
        tecnico_id  TEXT,
        tipo        TEXT,
        fecha       TEXT,
        proxima_fecha TEXT,
        estado      TEXT DEFAULT 'Planificado',
        hallazgos   TEXT,
        acciones    TEXT,
        repuestos   TEXT,
        cliente_id  TEXT REFERENCES clientes(id) ON DELETE RESTRICT,
        data        JSONB DEFAULT '{}',
        updated_at  BIGINT,
        created_at  BIGINT,
        deleted_at  BIGINT
      );

      -- REPORTS (informes HVAC)
      CREATE TABLE reports (
        uuid_sync  TEXT PRIMARY KEY,
        id         TEXT UNIQUE,
        cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT,
        data       JSONB NOT NULL DEFAULT '{}',
        updated_at BIGINT,
        created_at BIGINT,
        deleted_at BIGINT
      );

      -- INVENTORY (repuestos e insumos)
      CREATE TABLE inventory (
        uuid_sync     TEXT PRIMARY KEY,
        id            TEXT UNIQUE,
        nombre        TEXT,
        categoria     TEXT,
        codigo        TEXT,
        cantidad      NUMERIC DEFAULT 0,
        unidad_medida TEXT,
        marca         TEXT,
        modelo        TEXT,
        estado        TEXT DEFAULT 'disponible',
        cliente_id    TEXT REFERENCES clientes(id) ON DELETE RESTRICT,
        data          JSONB DEFAULT '{}',
        updated_at    BIGINT,
        created_at    BIGINT,
        deleted_at    BIGINT
      );

      -- EVENTS
      CREATE TABLE events (
        uuid_sync  TEXT PRIMARY KEY,
        id         TEXT UNIQUE,
        cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT,
        data       JSONB NOT NULL DEFAULT '{}',
        updated_at BIGINT,
        created_at BIGINT,
        deleted_at BIGINT
      );

      -- CALENDAR
      CREATE TABLE calendar (
        uuid_sync  TEXT PRIMARY KEY,
        id         TEXT UNIQUE,
        cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT,
        data       JSONB NOT NULL DEFAULT '{}',
        updated_at BIGINT,
        created_at BIGINT,
        deleted_at BIGINT
      );

      -- ORDENES SERVICIO
      CREATE TABLE ordenes_servicio (
        uuid_sync  TEXT PRIMARY KEY,
        id         TEXT UNIQUE,
        cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT,
        data       JSONB NOT NULL DEFAULT '{}',
        updated_at BIGINT,
        created_at BIGINT,
        deleted_at BIGINT
      );

      -- CATALOG ASSET TYPES
      CREATE TABLE catalog_asset_types (
        uuid_sync  TEXT PRIMARY KEY,
        id         TEXT UNIQUE,
        cliente_id TEXT,
        data       JSONB NOT NULL DEFAULT '{}',
        updated_at BIGINT,
        created_at BIGINT,
        deleted_at BIGINT
      );

      -- SETTINGS
      CREATE TABLE settings (
        uuid_sync  TEXT PRIMARY KEY,
        id         TEXT UNIQUE,
        cliente_id TEXT,
        data       JSONB NOT NULL DEFAULT '{}',
        updated_at BIGINT,
        created_at BIGINT,
        deleted_at BIGINT
      );

      -- AUDIT LOGS (append-only, sin deleted_at)
      CREATE TABLE audit_logs (
        id          TEXT PRIMARY KEY,
        action      TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id   TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        cliente_id  TEXT,
        payload     JSONB,
        timestamp   BIGINT NOT NULL
      );

      -- AUTH FAILURES
      CREATE TABLE cmms_auth_failures (
        id           BIGSERIAL PRIMARY KEY,
        email        TEXT NOT NULL,
        ip           TEXT NOT NULL,
        attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- ÍNDICES
      CREATE INDEX idx_assets_tenant        ON assets (cliente_id, sucursal_id);
      CREATE INDEX idx_assets_tag           ON assets (tag);
      CREATE INDEX idx_wo_tenant            ON work_orders (cliente_id, updated_at);
      CREATE INDEX idx_wo_estado            ON work_orders (estado);
      CREATE INDEX idx_pm_tenant            ON preventive_maintenance (cliente_id, equipo_tag);
      CREATE INDEX idx_inventory_tenant     ON inventory (cliente_id, codigo);
      CREATE INDEX idx_reports_tenant       ON reports (cliente_id, updated_at);
      CREATE INDEX idx_audit_tenant         ON audit_logs (cliente_id, timestamp);
      CREATE INDEX idx_users_correo         ON users (correo);
      CREATE INDEX idx_auth_email           ON cmms_auth_failures (email, attempted_at);
      CREATE INDEX idx_sucursales_cliente   ON sucursales (cliente_id);

      -- SEED OBLIGATORIO
      INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at)
      VALUES (
        'cliente-default-001',
        'cliente-default-001',
        '{"nombre":"EECOL Default","empresa":"EECOL"}'::jsonb,
        0, 0
      );

      INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at)
      VALUES (
        'default-sucursal',
        'cliente-default-001',
        'default-sucursal',
        '{"nombre":"Bodega Central","codigo":"21-STK","ciudad":"Santiago","region":"RM"}'::jsonb,
        0, 0
      );

      INSERT INTO users (uuid_sync, id, nombre, correo, perfil, pin, activo, cliente_id, updated_at, created_at)
      VALUES (
        'user-nelson-admin-uuid',
        '1',
        'Nelson Bravo',
        'nelson.bravo.salas@gmail.com',
        'administrador',
        '3517',
        true,
        'cliente-default-001',
        0, 0
      );
    `;

    await sql(schemaSql);

    return res.status(200).json({ success: true, message: "Base de datos inicializada con el esquema definitivo de Neon" });
  } catch (error: any) {
    console.error("Error al inicializar la base de datos:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
