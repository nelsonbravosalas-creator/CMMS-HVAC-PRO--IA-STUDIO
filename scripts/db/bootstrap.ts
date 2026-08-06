import { neon } from "@neondatabase/serverless";
import { pathToFileURL } from "url";
import { seedParametricData } from "./parametric-seed.js";
import {
  ensureOneShotMigrationTable,
  markFreshStartComplete,
  needsFreshStartReset,
  resetApplicationData
} from "./one-time-fresh-start.js";
import { migrateOrderReports } from "./one-time-order-reports.js";

type SqlClient = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export async function ensureDbSchema(sql: SqlClient) {
  await ensureOneShotMigrationTable(sql);

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
    id TEXT UNIQUE,
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
    pin_hash TEXT,
    activo BOOLEAN DEFAULT true,
    data JSONB,
    updated_at BIGINT,
    created_at BIGINT,
    deleted_at BIGINT
  )`;

  await sql`CREATE TABLE IF NOT EXISTS user_clientes (
    uuid_sync TEXT PRIMARY KEY,
    id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(uuid_sync) ON DELETE CASCADE,
    cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    created_at BIGINT NOT NULL,
    UNIQUE (user_id, cliente_id)
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

  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS id TEXT`;
  await sql`ALTER TABLE assets ALTER COLUMN id SET DEFAULT ('PEND-' || gen_random_uuid()::text)`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS sucursal_id TEXT REFERENCES sucursales(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS orden_servicio_uuid TEXT`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS sucursal_id TEXT`;
  await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE calendar ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT`;
  await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS estado TEXT`;
  await sql`ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS estado TEXT`;
  await sql`ALTER TABLE catalog_asset_types ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS sucursal_id TEXT`;
  await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT`;

  await sql`CREATE INDEX IF NOT EXISTS idx_sucursales_tenant ON sucursales (cliente_id, id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_tenant_search ON assets (cliente_id, sucursal_id, uuid_sync)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_search ON work_orders (cliente_id, uuid_sync)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reports_order ON reports (cliente_id, orden_servicio_uuid, deleted_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_inventory_tenant_search ON inventory (cliente_id, uuid_sync)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_calendar_tenant_search ON calendar (cliente_id, uuid_sync)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_clientes_user ON user_clientes (user_id, cliente_id)`;

  await sql`UPDATE assets SET id = COALESCE(NULLIF(id, ''), tag, uuid_sync) WHERE id IS NULL OR id = ''`;
  // Los TAG e ID de activos son correlativos de cada cliente/sucursal. No deben
  // bloquear a otro tenant que use el mismo código (por ejemplo MATR.AC.001).
  await sql`ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_tag_key`;
  await sql`ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_id_key`;
  await sql`DROP INDEX IF EXISTS idx_assets_id_unique`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_tenant_tag_unique ON assets (cliente_id, tag)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_tenant_id_unique ON assets (cliente_id, id)`;
  await sql`ALTER TABLE assets ALTER COLUMN id SET NOT NULL`;
  await sql`UPDATE work_orders SET id = COALESCE(NULLIF(id, ''), 'PEND-' || uuid_sync) WHERE id IS NULL OR id = ''`;
  await sql`UPDATE preventive_maintenance SET id = COALESCE(NULLIF(id, ''), 'PEND-' || uuid_sync) WHERE id IS NULL OR id = ''`;
  await sql`UPDATE reports SET id = COALESCE(NULLIF(id, ''), 'PEND-' || uuid_sync) WHERE id IS NULL OR id = ''`;
  await sql`UPDATE events SET id = COALESCE(NULLIF(id, ''), 'PEND-' || uuid_sync) WHERE id IS NULL OR id = ''`;
  await sql`UPDATE catalog_asset_types SET id = COALESCE(NULLIF(id, ''), 'PEND-' || uuid_sync) WHERE id IS NULL OR id = ''`;
  await sql`UPDATE settings SET id = COALESCE(NULLIF(id, ''), 'PEND-' || uuid_sync) WHERE id IS NULL OR id = ''`;
  await sql`UPDATE ordenes_servicio SET id = COALESCE(NULLIF(id, ''), 'PEND-' || uuid_sync) WHERE id IS NULL OR id = ''`;
  await sql`UPDATE inventory SET id = COALESCE(NULLIF(id, ''), 'PEND-' || uuid_sync) WHERE id IS NULL OR id = ''`;
  await sql`UPDATE calendar SET id = COALESCE(NULLIF(id, ''), 'PEND-' || uuid_sync) WHERE id IS NULL OR id = ''`;
  await sql`UPDATE work_orders SET estado = COALESCE(NULLIF(estado, ''), data->>'estado', 'abierto')`;
  await sql`UPDATE ordenes_servicio SET estado = COALESCE(NULLIF(estado, ''), data->>'estado', 'abierto')`;
  await sql`UPDATE work_orders SET estado = 'firmado' WHERE estado = 'firmada'`;
  await sql`UPDATE work_orders SET estado = 'completado' WHERE estado = 'completada'`;
  await sql`UPDATE ordenes_servicio SET estado = 'firmado' WHERE estado = 'firmada'`;
  await sql`UPDATE ordenes_servicio SET estado = 'completado' WHERE estado = 'completada'`;
  await sql`UPDATE work_orders SET estado = 'abierto' WHERE estado NOT IN ('abierto', 'en_progreso', 'completado', 'firmado', 'cerrado')`;
  await sql`UPDATE ordenes_servicio SET estado = 'abierto' WHERE estado NOT IN ('abierto', 'en_progreso', 'completado', 'firmado', 'cerrado')`;
  await sql`
    UPDATE users
    SET activo = false,
        deleted_at = COALESCE(deleted_at, ${Date.now()}),
        updated_at = ${Date.now()}
    WHERE LOWER(perfil) = 'programador'
       OR LOWER(data->>'rol') = 'programador'
  `;
  await sql`
    INSERT INTO user_clientes (uuid_sync, id, user_id, cliente_id, created_at)
    SELECT
      'UC-' || uuid_sync || '-' || cliente_id,
      'UC-' || id || '-' || cliente_id,
      uuid_sync,
      cliente_id,
      COALESCE(created_at, ${Date.now()})
    FROM users
    WHERE cliente_id IS NOT NULL
    ON CONFLICT (user_id, cliente_id) DO NOTHING
  `;
}

export async function runDbBootstrap(sql?: SqlClient) {
  const dbUrl = process.env.DATABASE_URL;
  const client = sql || (dbUrl ? neon(dbUrl) : null);

  if (!client) {
    throw new Error("DATABASE_URL no configurada");
  }
  if (!sql && !dbUrl?.startsWith("postgres")) {
    throw new Error("DATABASE_URL debe ser una conexion postgres");
  }

  await ensureDbSchema(client);
  const orderReportsMigrated = await migrateOrderReports(client);
  if (orderReportsMigrated) {
    console.log("One-time orphan report cleanup completed.");
  }
  await client`
    ALTER TABLE reports
    DROP CONSTRAINT IF EXISTS fk_reports_orden_servicio
  `;
  await client`
    ALTER TABLE reports
    ADD CONSTRAINT fk_reports_orden_servicio
    FOREIGN KEY (orden_servicio_uuid)
    REFERENCES ordenes_servicio(uuid_sync)
    ON DELETE RESTRICT
  `;
  await client`ALTER TABLE reports ALTER COLUMN orden_servicio_uuid SET NOT NULL`;
  const shouldReset = await needsFreshStartReset(client);
  if (shouldReset) {
    console.log("Applying one-time fresh-start reset...");
    await resetApplicationData(client);
  }
  await seedParametricData(client);
  if (shouldReset) {
    await markFreshStartComplete(client);
    console.log("One-time fresh-start reset completed.");
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runDbBootstrap()
    .then(() => {
      console.log("Database bootstrap completed.");
    })
    .catch((error) => {
      console.error("Database bootstrap failed:", error);
      process.exit(1);
    });
}
