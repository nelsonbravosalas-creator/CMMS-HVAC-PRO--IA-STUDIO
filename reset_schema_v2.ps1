# =============================================================================
# CMMS HVAC PRO — Schema v2: offline-first corregido
#
# Mejoras vs v1:
#   1. server_seq BIGSERIAL  — cursor monotónico inmune a clock drift
#   2. Columnas explícitas   — elimina data JSONB redundante en tablas estructuradas
#   3. uuid_sync PK uniforme — ON CONFLICT (uuid_sync) en todas las tablas de sync
#   4. Índices compuestos    — (cliente_id, server_seq) para queries de pull
#
# Uso:
#   cd "CMMS-HVAC-PRO--IA-STUDIO"
#   .\reset_schema_v2.ps1
#   .\reset_schema_v2.ps1 -SoloGuardarSQL    # solo genera el .sql
# =============================================================================

param([switch]$SoloGuardarSQL)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Leer DATABASE_URL desde .env
# ---------------------------------------------------------------------------
$dbUrl = $null
foreach ($f in @('.env', '.env.local', '.env.production')) {
  if (Test-Path $f) {
    $line = Get-Content $f | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($line) {
      $dbUrl = ($line -replace '^\s*DATABASE_URL\s*=\s*', '') -replace '^["'']|["'']$', ''
      break
    }
  }
}
if (-not $dbUrl -and -not $SoloGuardarSQL) {
  Write-Error 'DATABASE_URL no encontrado en .env. Usa -SoloGuardarSQL para solo generar el SQL.'
  exit 1
}

# ---------------------------------------------------------------------------
# SQL DDL v2
# ---------------------------------------------------------------------------
$sql = @'
-- =============================================================================
-- CMMS HVAC PRO — Schema v2
-- server_seq: BIGINT asignado por Postgres (secuencia compartida, monotónica)
-- Cursor de sync: server_seq > ${lastSeq}  (en lugar de updated_at > ${since})
-- updated_at: se mantiene para lógica de negocio y display en UI
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- DROP en orden inverso de dependencias
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS audit_logs              CASCADE;
DROP TABLE IF EXISTS settings                CASCADE;
DROP TABLE IF EXISTS ordenes_servicio        CASCADE;
DROP TABLE IF EXISTS calendar                CASCADE;
DROP TABLE IF EXISTS inventory               CASCADE;
DROP TABLE IF EXISTS events                  CASCADE;
DROP TABLE IF EXISTS reports                 CASCADE;
DROP TABLE IF EXISTS work_orders             CASCADE;
DROP TABLE IF EXISTS preventive_maintenance  CASCADE;
DROP TABLE IF EXISTS assets                  CASCADE;
DROP TABLE IF EXISTS catalog_asset_types     CASCADE;
DROP TABLE IF EXISTS users                   CASCADE;
DROP TABLE IF EXISTS sucursales              CASCADE;
DROP TABLE IF EXISTS clientes                CASCADE;
DROP TABLE IF EXISTS cmms_auth_failures      CASCADE;
DROP SEQUENCE IF EXISTS cmms_sync_seq;
DROP FUNCTION IF EXISTS cmms_refresh_seq();

-- =============================================================================
-- SECUENCIA GLOBAL + TRIGGER
-- Una sola secuencia compartida → todos los server_seq son globalmente comparables
-- El cliente puede usar un único cursor en lugar de uno por tabla
-- =============================================================================
CREATE SEQUENCE cmms_sync_seq START 1 INCREMENT 1 NO CYCLE;

CREATE OR REPLACE FUNCTION cmms_refresh_seq()
RETURNS TRIGGER AS $$
BEGIN
  NEW.server_seq = nextval('cmms_sync_seq');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- NIVEL 1: clientes  (raíz de tenant)
-- PK: uuid_sync  |  id: clave de negocio (ej: 'cliente-acme-001'), UNIQUE
-- Las sucursales referencian clientes(id) — FK sobre columna UNIQUE, válido en PG
-- Sin data JSONB: columnas explícitas cubren todos los campos de LocalCliente
-- =============================================================================
CREATE TABLE clientes (
  uuid_sync         TEXT        PRIMARY KEY,
  id                TEXT        UNIQUE NOT NULL,
  server_seq        BIGINT      NOT NULL DEFAULT nextval('cmms_sync_seq'),
  nombre            TEXT        NOT NULL DEFAULT '',
  rut               TEXT,
  empresa           TEXT        DEFAULT '',
  email             TEXT        DEFAULT '',
  telefono          TEXT        DEFAULT '',
  direccion         TEXT        DEFAULT '',
  region            TEXT        DEFAULT '',
  activo            BOOLEAN     DEFAULT TRUE,
  contacto_nombre   TEXT,
  contacto_correo   TEXT,
  contacto_cargo    TEXT,
  updated_at        BIGINT,
  created_at        BIGINT,
  deleted_at        BIGINT
);
CREATE TRIGGER trg_clientes_seq
  BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

-- =============================================================================
-- NIVEL 2: sucursales
-- PK: uuid_sync  |  id: clave de negocio, UNIQUE
-- Sin data JSONB: columnas explícitas cubren todos los campos de LocalSucursal
-- =============================================================================
CREATE TABLE sucursales (
  uuid_sync         TEXT        PRIMARY KEY,
  id                TEXT        UNIQUE NOT NULL,
  server_seq        BIGINT      NOT NULL DEFAULT nextval('cmms_sync_seq'),
  cliente_id        TEXT        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre            TEXT        NOT NULL DEFAULT '',
  codigo            TEXT        DEFAULT '',
  direccion         TEXT        DEFAULT '',
  ciudad            TEXT        DEFAULT '',
  region            TEXT        DEFAULT '',
  activo            BOOLEAN     DEFAULT TRUE,
  contacto_nombre   TEXT,
  contacto_correo   TEXT,
  contacto_cargo    TEXT,
  updated_at        BIGINT,
  created_at        BIGINT,
  deleted_at        BIGINT
);
CREATE TRIGGER trg_sucursales_seq
  BEFORE UPDATE ON sucursales FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

-- =============================================================================
-- NIVEL 3: catalog_asset_types  (tipo de equipo)
-- cliente_id NULL = catálogo global compartido
-- Sin data JSONB: schema simple (codigo / descripcion / activo)
-- =============================================================================
CREATE TABLE catalog_asset_types (
  uuid_sync         TEXT        PRIMARY KEY,
  id                TEXT,
  server_seq        BIGINT      NOT NULL DEFAULT nextval('cmms_sync_seq'),
  cliente_id        TEXT        REFERENCES clientes(id) ON DELETE CASCADE,
  codigo            TEXT        NOT NULL DEFAULT '',
  descripcion       TEXT        NOT NULL DEFAULT '',
  activo            BOOLEAN     DEFAULT TRUE,
  updated_at        BIGINT,
  created_at        BIGINT,
  deleted_at        BIGINT
);
CREATE TRIGGER trg_cat_seq
  BEFORE UPDATE ON catalog_asset_types FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

-- =============================================================================
-- NIVEL 4: assets  (tags de equipo)
-- Sin data JSONB: schema completo explícito
-- tecnicos JSONB: es un array de IDs, no un data dump — se mantiene
-- =============================================================================
CREATE TABLE assets (
  uuid_sync                TEXT        PRIMARY KEY,
  server_seq               BIGINT      NOT NULL DEFAULT nextval('cmms_sync_seq'),
  tag                      TEXT        NOT NULL DEFAULT '',
  nombre                   TEXT        NOT NULL DEFAULT '',
  tipo                     TEXT        DEFAULT '',
  marca                    TEXT        DEFAULT '',
  modelo                   TEXT        DEFAULT '',
  serie                    TEXT        DEFAULT '',
  ubicacion                TEXT        DEFAULT '',
  area                     TEXT        DEFAULT '',
  capacidad                TEXT        DEFAULT '',
  voltaje                  TEXT        DEFAULT '',
  corriente                TEXT        DEFAULT '',
  refrigerante             TEXT        DEFAULT '',
  fecha_instalacion        TEXT        DEFAULT '',
  vida_util                INTEGER     DEFAULT 10,
  estado                   TEXT        DEFAULT 'operativo',
  ultimo_mantenimiento     TEXT,
  proximo_mantenimiento    TEXT,
  frecuencia_mantenimiento TEXT        DEFAULT '',
  horas_operacion          INTEGER     DEFAULT 0,
  tecnicos                 JSONB       DEFAULT '[]',
  notas                    TEXT        DEFAULT '',
  cliente_id               TEXT        NOT NULL REFERENCES clientes(id)    ON DELETE CASCADE,
  sucursal_id              TEXT        NOT NULL REFERENCES sucursales(id),
  latitud                  NUMERIC,
  longitud                 NUMERIC,
  updated_at               BIGINT,
  created_at               BIGINT,
  deleted_at               BIGINT
);
CREATE TRIGGER trg_assets_seq
  BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

-- =============================================================================
-- users
-- Sin data JSONB: columnas explícitas (nombre, correo, perfil, pin, activo)
-- pin: sigue siendo TEXT para soportar hash bcrypt ($2b$...) o texto plano legado
-- =============================================================================
CREATE TABLE users (
  uuid_sync         TEXT        PRIMARY KEY,
  id                TEXT,
  server_seq        BIGINT      NOT NULL DEFAULT nextval('cmms_sync_seq'),
  nombre            TEXT        NOT NULL DEFAULT '',
  correo            TEXT        DEFAULT '',
  perfil            TEXT        DEFAULT 'tecnico',
  pin               TEXT        DEFAULT '',
  activo            BOOLEAN     DEFAULT TRUE,
  cliente_id        TEXT        REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at        BIGINT,
  created_at        BIGINT,
  deleted_at        BIGINT
);
CREATE TRIGGER trg_users_seq
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

-- =============================================================================
-- work_orders
-- MANTIENE data JSONB: almacena checklist, firmas (firma_conformidad_base64),
--   imagenes, y cualquier payload extendido de OT. Los campos clave (estado,
--   prioridad, cliente_id) son explícitos para queries e índices.
-- =============================================================================
CREATE TABLE work_orders (
  uuid_sync         TEXT        PRIMARY KEY,
  id                TEXT,
  server_seq        BIGINT      NOT NULL DEFAULT nextval('cmms_sync_seq'),
  titulo            TEXT        DEFAULT '',
  descripcion       TEXT        DEFAULT '',
  prioridad         TEXT        DEFAULT 'media',
  estado            TEXT        DEFAULT 'abierto',
  equipo_tag        TEXT        DEFAULT '',
  cliente_id        TEXT        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  creado_por        TEXT        DEFAULT '',
  asignado_a        TEXT        DEFAULT '',
  fecha_creacion    TEXT        DEFAULT '',
  data              JSONB,
  updated_at        BIGINT,
  created_at        BIGINT,
  deleted_at        BIGINT
);
CREATE TRIGGER trg_wo_seq
  BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

-- =============================================================================
-- preventive_maintenance
-- MANTIENE data JSONB: almacena ubicacionGeografica, fotos, checklists técnicos
-- =============================================================================
CREATE TABLE preventive_maintenance (
  uuid_sync         TEXT        PRIMARY KEY,
  id                TEXT,
  server_seq        BIGINT      NOT NULL DEFAULT nextval('cmms_sync_seq'),
  equipo_tag        TEXT        DEFAULT '',
  tecnico_id        TEXT        DEFAULT '',
  tipo              TEXT        DEFAULT '',
  fecha             TEXT        DEFAULT '',
  proxima_fecha     TEXT        DEFAULT '',
  estado            TEXT        DEFAULT 'Planificado',
  hallazgos         TEXT        DEFAULT '',
  acciones          TEXT        DEFAULT '',
  repuestos         TEXT        DEFAULT '',
  cliente_id        TEXT        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  data              JSONB,
  updated_at        BIGINT,
  created_at        BIGINT,
  deleted_at        BIGINT
);
CREATE TRIGGER trg_pm_seq
  BEFORE UPDATE ON preventive_maintenance FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

-- =============================================================================
-- inventory
-- Sin data JSONB: columnas explícitas cubren todos los campos de LocalInventario
-- =============================================================================
CREATE TABLE inventory (
  uuid_sync       TEXT        PRIMARY KEY,
  id              TEXT,
  server_seq      BIGINT      NOT NULL DEFAULT nextval('cmms_sync_seq'),
  categoria       TEXT        DEFAULT '',
  codigo          TEXT        DEFAULT '',
  nombre          TEXT        NOT NULL DEFAULT '',
  cantidad        NUMERIC     DEFAULT 0,
  unidad_medida   TEXT        DEFAULT '',
  marca           TEXT        DEFAULT '',
  modelo          TEXT        DEFAULT '',
  estado          TEXT        DEFAULT 'disponible',
  cliente_id      TEXT        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at      BIGINT,
  created_at      BIGINT,
  deleted_at      BIGINT
);
CREATE TRIGGER trg_inv_seq
  BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

-- =============================================================================
-- reports | events | calendar | ordenes_servicio | settings
-- MANTIENEN data JSONB: contenido variable, no estructurado de forma fija
-- =============================================================================
CREATE TABLE reports (
  uuid_sync   TEXT    PRIMARY KEY,
  id          TEXT,
  server_seq  BIGINT  NOT NULL DEFAULT nextval('cmms_sync_seq'),
  data        JSONB,
  cliente_id  TEXT    REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at  BIGINT,
  created_at  BIGINT,
  deleted_at  BIGINT
);
CREATE TRIGGER trg_reports_seq
  BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

CREATE TABLE events (
  uuid_sync   TEXT    PRIMARY KEY,
  id          TEXT,
  server_seq  BIGINT  NOT NULL DEFAULT nextval('cmms_sync_seq'),
  data        JSONB,
  cliente_id  TEXT    REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at  BIGINT,
  created_at  BIGINT,
  deleted_at  BIGINT
);
CREATE TRIGGER trg_events_seq
  BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

CREATE TABLE calendar (
  uuid_sync   TEXT    PRIMARY KEY,
  id          TEXT,
  server_seq  BIGINT  NOT NULL DEFAULT nextval('cmms_sync_seq'),
  data        JSONB,
  cliente_id  TEXT    REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at  BIGINT,
  created_at  BIGINT,
  deleted_at  BIGINT
);
CREATE TRIGGER trg_calendar_seq
  BEFORE UPDATE ON calendar FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

CREATE TABLE ordenes_servicio (
  uuid_sync   TEXT    PRIMARY KEY,
  id          TEXT,
  server_seq  BIGINT  NOT NULL DEFAULT nextval('cmms_sync_seq'),
  estado      TEXT    DEFAULT 'borrador',
  draft_key   TEXT,
  data        JSONB,
  cliente_id  TEXT    REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at  BIGINT,
  created_at  BIGINT,
  deleted_at  BIGINT
);
CREATE TRIGGER trg_os_seq
  BEFORE UPDATE ON ordenes_servicio FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

CREATE TABLE settings (
  uuid_sync   TEXT    PRIMARY KEY,
  id          TEXT,
  server_seq  BIGINT  NOT NULL DEFAULT nextval('cmms_sync_seq'),
  data        JSONB,
  cliente_id  TEXT    REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at  BIGINT,
  created_at  BIGINT,
  deleted_at  BIGINT
);
CREATE TRIGGER trg_settings_seq
  BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

-- =============================================================================
-- audit_logs
-- payload JSONB: estructura libre por diseño
-- =============================================================================
CREATE TABLE audit_logs (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  server_seq    BIGINT      NOT NULL DEFAULT nextval('cmms_sync_seq'),
  action        TEXT        NOT NULL DEFAULT '',
  entity_type   TEXT        DEFAULT '',
  entity_id     TEXT        DEFAULT '',
  user_id       TEXT        DEFAULT '',
  payload       JSONB,
  timestamp     BIGINT,
  cliente_id    TEXT        REFERENCES clientes(id) ON DELETE CASCADE
);
CREATE TRIGGER trg_audit_seq
  BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION cmms_refresh_seq();

-- =============================================================================
-- cmms_auth_failures  (standalone, sin sync)
-- =============================================================================
CREATE TABLE cmms_auth_failures (
  id            SERIAL      PRIMARY KEY,
  email         TEXT        NOT NULL DEFAULT '',
  ip            TEXT        NOT NULL DEFAULT '',
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ÍNDICES
-- Patrón: (cliente_id, server_seq) para el query de pull de sync
--   → satisface WHERE cliente_id = $1 AND server_seq > $2 en un solo scan
-- =============================================================================

-- clientes
CREATE INDEX idx_clientes_server_seq    ON clientes(server_seq);

-- sucursales
CREATE INDEX idx_suc_sync               ON sucursales(cliente_id, server_seq);

-- catalog_asset_types
CREATE INDEX idx_cat_sync               ON catalog_asset_types(cliente_id, server_seq);
CREATE INDEX idx_cat_codigo             ON catalog_asset_types(codigo);

-- assets
CREATE INDEX idx_assets_sync            ON assets(cliente_id, server_seq);
CREATE INDEX idx_assets_sucursal        ON assets(sucursal_id);
CREATE INDEX idx_assets_estado          ON assets(estado);
CREATE INDEX idx_assets_tag             ON assets(tag);

-- users
CREATE INDEX idx_users_sync             ON users(cliente_id, server_seq);
CREATE INDEX idx_users_correo           ON users(correo);

-- work_orders
CREATE INDEX idx_wo_sync                ON work_orders(cliente_id, server_seq);
CREATE INDEX idx_wo_estado              ON work_orders(estado);

-- preventive_maintenance
CREATE INDEX idx_pm_sync                ON preventive_maintenance(cliente_id, server_seq);
CREATE INDEX idx_pm_equipo              ON preventive_maintenance(equipo_tag);

-- inventory
CREATE INDEX idx_inv_sync               ON inventory(cliente_id, server_seq);

-- reports / events / calendar / ordenes_servicio / settings
CREATE INDEX idx_reports_sync           ON reports(cliente_id, server_seq);
CREATE INDEX idx_events_sync            ON events(cliente_id, server_seq);
CREATE INDEX idx_calendar_sync          ON calendar(cliente_id, server_seq);
CREATE INDEX idx_os_sync                ON ordenes_servicio(cliente_id, server_seq);
CREATE INDEX idx_settings_sync          ON settings(cliente_id, server_seq);

-- audit_logs
CREATE INDEX idx_audit_sync             ON audit_logs(cliente_id, server_seq);
CREATE INDEX idx_audit_user             ON audit_logs(user_id);
CREATE INDEX idx_audit_ts               ON audit_logs(timestamp);

-- cmms_auth_failures
CREATE INDEX idx_authfail_email         ON cmms_auth_failures(email);
CREATE INDEX idx_authfail_ip_email      ON cmms_auth_failures(ip, email, attempted_at);

-- =============================================================================
-- SEED DATA
-- Mismos IDs que usa Dexie populate() en src/db/database.ts
-- =============================================================================
INSERT INTO clientes (uuid_sync, id, nombre, empresa, email, activo, updated_at, created_at)
VALUES (
  'cliente-default-001', 'cliente-default-001',
  'Cliente EECOL S.A.', 'EECOL Industrial', 'contacto@eecol.cl', TRUE,
  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

INSERT INTO sucursales (uuid_sync, id, cliente_id, nombre, codigo, ciudad, region, activo, updated_at, created_at)
VALUES (
  'default-sucursal', 'default-sucursal', 'cliente-default-001',
  'Bodega Central', '21-STK', 'Santiago', 'RM', TRUE,
  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

INSERT INTO catalog_asset_types (uuid_sync, cliente_id, codigo, descripcion, activo, updated_at, created_at) VALUES
  (gen_random_uuid()::TEXT, NULL, 'AC', 'Aire acondicionado',  TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT*1000, EXTRACT(EPOCH FROM NOW())::BIGINT*1000),
  (gen_random_uuid()::TEXT, NULL, 'VH', 'Vehículo',            TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT*1000, EXTRACT(EPOCH FROM NOW())::BIGINT*1000),
  (gen_random_uuid()::TEXT, NULL, 'GE', 'Grupo electrógeno',   TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT*1000, EXTRACT(EPOCH FROM NOW())::BIGINT*1000),
  (gen_random_uuid()::TEXT, NULL, 'EB', 'Equipo de Bodega',    TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT*1000, EXTRACT(EPOCH FROM NOW())::BIGINT*1000),
  (gen_random_uuid()::TEXT, NULL, 'GO', 'Grúa horquilla',      TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT*1000, EXTRACT(EPOCH FROM NOW())::BIGINT*1000),
  (gen_random_uuid()::TEXT, NULL, 'XX', 'Otros Activos',       TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT*1000, EXTRACT(EPOCH FROM NOW())::BIGINT*1000);

COMMIT;
'@

# ---------------------------------------------------------------------------
# Guardar SQL
# ---------------------------------------------------------------------------
$ts      = Get-Date -Format 'yyyyMMdd_HHmmss'
$sqlFile = "reset_schema_v2_$ts.sql"
$sql | Out-File -FilePath $sqlFile -Encoding utf8NoBOM
Write-Host "`nSQL v2 generado: $sqlFile" -ForegroundColor Cyan

if ($SoloGuardarSQL) {
  Write-Host 'Modo -SoloGuardarSQL: no se conecta.' -ForegroundColor Yellow
  Write-Host "Pega '$sqlFile' en Neon Console → SQL Editor"
  exit 0
}

# ---------------------------------------------------------------------------
# Ejecutar via psql
# ---------------------------------------------------------------------------
$psqlCmd = $null
try { $psqlCmd = (Get-Command psql -ErrorAction Stop).Source } catch {}

if ($psqlCmd) {
  Write-Host "`npsql: $psqlCmd" -ForegroundColor Green
  Write-Host 'ADVERTENCIA: borra TODOS los datos. Ctrl+C para cancelar.' -ForegroundColor Red
  Write-Host 'Enter para continuar...'
  $null = Read-Host
  & psql $dbUrl -f $sqlFile
  if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSchema v2 creado en Neon." -ForegroundColor Green
    Write-Host "`nPasos siguientes:"
    Write-Host "  1. Limpia IndexedDB: DevTools → Application → Storage → Clear site data"
    Write-Host "  2. Recarga la app — Dexie ejecutara populate() automaticamente"
    Write-Host "  3. Login online para registrar el usuario en Neon con cliente_id"
  } else {
    Write-Host "`nError psql (exit $LASTEXITCODE). Ejecuta '$sqlFile' en Neon SQL Editor." -ForegroundColor Red
  }
} else {
  Write-Host "`npsql no encontrado en PATH." -ForegroundColor Yellow
  Write-Host "Opciones:"
  Write-Host "  A) Neon Console → SQL Editor → pega '$sqlFile'"
  Write-Host "  B) winget install PostgreSQL.PostgreSQL  →  vuelve a ejecutar"
}
