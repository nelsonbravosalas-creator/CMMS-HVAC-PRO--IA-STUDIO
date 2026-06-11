# =============================================================================
# CMMS HVAC PRO — Reset y recreación de schema multi-tenant en Neon
# Jerarquía: clientes → sucursales → catalog_asset_types → assets (tags)
# ADVERTENCIA: Borra TODOS los datos existentes. Irreversible.
# =============================================================================
# Uso:
#   cd "CMMS-HVAC-PRO--IA-STUDIO"
#   .\reset_schema.ps1
#   .\reset_schema.ps1 -SoloGuardarSQL    # solo genera el .sql, no conecta
# =============================================================================

param(
  [switch]$SoloGuardarSQL
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# 1. Leer DATABASE_URL desde .env
# ---------------------------------------------------------------------------
$envFiles = @('.env', '.env.local', '.env.production')
$dbUrl = $null

foreach ($f in $envFiles) {
  if (Test-Path $f) {
    $line = Get-Content $f | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($line) {
      $dbUrl = ($line -replace '^\s*DATABASE_URL\s*=\s*', '') -replace '^["'']|["'']$', ''
      break
    }
  }
}

if (-not $dbUrl -and -not $SoloGuardarSQL) {
  Write-Host ''
  Write-Host 'DATABASE_URL no encontrado en .env' -ForegroundColor Red
  Write-Host 'Opciones:'
  Write-Host '  1) Crea .env con:  DATABASE_URL="postgres://user:pass@host/db"'
  Write-Host '  2) Ejecuta con -SoloGuardarSQL para solo generar el archivo .sql'
  exit 1
}

# ---------------------------------------------------------------------------
# 2. SQL DDL
# ---------------------------------------------------------------------------
$sql = @'
-- =============================================================================
-- CMMS HVAC PRO — Reset multi-tenant
-- updated_at / created_at / deleted_at: BIGINT (ms epoch)
-- uuid_sync: clave de sincronización offline-first
-- Jerarquía FK: clientes → sucursales → catalog_asset_types → assets
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- DROP en orden inverso de dependencias
-- -----------------------------------------------------------------------
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

-- =============================================================================
-- NIVEL 1: clientes  (raíz de tenant)
-- PK: id (TEXT legible, ej: 'cliente-acme-001')
-- ON CONFLICT (id) en sync → id es PK
-- =============================================================================
CREATE TABLE clientes (
  id                TEXT        PRIMARY KEY,
  uuid_sync         TEXT        UNIQUE NOT NULL,
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
  data              JSONB,
  updated_at        BIGINT,
  created_at        BIGINT,
  deleted_at        BIGINT
);

-- =============================================================================
-- NIVEL 2: sucursales
-- PK: id (TEXT)  |  FK: cliente_id → clientes
-- ON CONFLICT (id) en sync
-- =============================================================================
CREATE TABLE sucursales (
  id                TEXT        PRIMARY KEY,
  uuid_sync         TEXT        UNIQUE NOT NULL,
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
  data              JSONB,
  updated_at        BIGINT,
  created_at        BIGINT,
  deleted_at        BIGINT
);

-- =============================================================================
-- NIVEL 3: catalog_asset_types  (tipo de equipo)
-- cliente_id NULL = catálogo global compartido entre todos los tenants
-- ON CONFLICT (uuid_sync) en sync
-- =============================================================================
CREATE TABLE catalog_asset_types (
  uuid_sync         TEXT        PRIMARY KEY,
  id                TEXT,
  cliente_id        TEXT        REFERENCES clientes(id) ON DELETE CASCADE,
  codigo            TEXT        NOT NULL DEFAULT '',
  descripcion       TEXT        NOT NULL DEFAULT '',
  activo            BOOLEAN     DEFAULT TRUE,
  data              JSONB,
  updated_at        BIGINT,
  created_at        BIGINT,
  deleted_at        BIGINT
);

-- =============================================================================
-- NIVEL 4: assets  (tags de equipo)
-- FK doble: cliente_id → clientes, sucursal_id → sucursales
-- ON CONFLICT (uuid_sync) en sync
-- =============================================================================
CREATE TABLE assets (
  uuid_sync                TEXT        PRIMARY KEY,
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
  cliente_id               TEXT        NOT NULL REFERENCES clientes(id)   ON DELETE CASCADE,
  sucursal_id              TEXT        NOT NULL REFERENCES sucursales(id),
  latitud                  NUMERIC,
  longitud                 NUMERIC,
  updated_at               BIGINT,
  created_at               BIGINT,
  deleted_at               BIGINT
);

-- =============================================================================
-- users
-- ON CONFLICT (uuid_sync)
-- =============================================================================
CREATE TABLE users (
  uuid_sync         TEXT        PRIMARY KEY,
  id                TEXT,
  nombre            TEXT        NOT NULL DEFAULT '',
  correo            TEXT        DEFAULT '',
  perfil            TEXT        DEFAULT 'tecnico',
  pin               TEXT        DEFAULT '',
  activo            BOOLEAN     DEFAULT TRUE,
  cliente_id        TEXT        REFERENCES clientes(id) ON DELETE CASCADE,
  data              JSONB,
  updated_at        BIGINT,
  created_at        BIGINT,
  deleted_at        BIGINT
);

-- =============================================================================
-- work_orders
-- ON CONFLICT (uuid_sync)
-- =============================================================================
CREATE TABLE work_orders (
  uuid_sync         TEXT        PRIMARY KEY,
  id                TEXT,
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

-- =============================================================================
-- preventive_maintenance
-- ON CONFLICT (uuid_sync)
-- =============================================================================
CREATE TABLE preventive_maintenance (
  uuid_sync         TEXT        PRIMARY KEY,
  id                TEXT,
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

-- =============================================================================
-- reports  |  events  |  calendar  |  ordenes_servicio  |  settings
-- ON CONFLICT (uuid_sync)
-- =============================================================================
CREATE TABLE reports (
  uuid_sync   TEXT    PRIMARY KEY,
  id          TEXT,
  data        JSONB,
  cliente_id  TEXT    REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at  BIGINT,
  created_at  BIGINT,
  deleted_at  BIGINT
);

CREATE TABLE events (
  uuid_sync   TEXT    PRIMARY KEY,
  id          TEXT,
  data        JSONB,
  cliente_id  TEXT    REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at  BIGINT,
  created_at  BIGINT,
  deleted_at  BIGINT
);

CREATE TABLE calendar (
  uuid_sync   TEXT    PRIMARY KEY,
  id          TEXT,
  data        JSONB,
  cliente_id  TEXT    REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at  BIGINT,
  created_at  BIGINT,
  deleted_at  BIGINT
);

CREATE TABLE inventory (
  uuid_sync       TEXT        PRIMARY KEY,
  id              TEXT,
  categoria       TEXT        DEFAULT '',
  codigo          TEXT        DEFAULT '',
  nombre          TEXT        NOT NULL DEFAULT '',
  cantidad        NUMERIC     DEFAULT 0,
  unidad_medida   TEXT        DEFAULT '',
  marca           TEXT        DEFAULT '',
  modelo          TEXT        DEFAULT '',
  estado          TEXT        DEFAULT 'disponible',
  cliente_id      TEXT        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  data            JSONB,
  updated_at      BIGINT,
  created_at      BIGINT,
  deleted_at      BIGINT
);

CREATE TABLE ordenes_servicio (
  uuid_sync   TEXT    PRIMARY KEY,
  id          TEXT,
  estado      TEXT    DEFAULT 'borrador',
  draft_key   TEXT,
  data        JSONB,
  cliente_id  TEXT    REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at  BIGINT,
  created_at  BIGINT,
  deleted_at  BIGINT
);

CREATE TABLE settings (
  uuid_sync   TEXT    PRIMARY KEY,
  id          TEXT,
  data        JSONB,
  cliente_id  TEXT    REFERENCES clientes(id) ON DELETE CASCADE,
  updated_at  BIGINT,
  created_at  BIGINT,
  deleted_at  BIGINT
);

-- =============================================================================
-- audit_logs
-- ON CONFLICT (id)
-- =============================================================================
CREATE TABLE audit_logs (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  action        TEXT        NOT NULL DEFAULT '',
  entity_type   TEXT        DEFAULT '',
  entity_id     TEXT        DEFAULT '',
  user_id       TEXT        DEFAULT '',
  payload       JSONB,
  timestamp     BIGINT,
  cliente_id    TEXT        REFERENCES clientes(id) ON DELETE CASCADE
);

-- =============================================================================
-- cmms_auth_failures  (sin FK — tabla de seguridad standalone)
-- =============================================================================
CREATE TABLE cmms_auth_failures (
  id            SERIAL      PRIMARY KEY,
  email         TEXT        NOT NULL DEFAULT '',
  ip            TEXT        NOT NULL DEFAULT '',
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ÍNDICES
-- =============================================================================
-- clientes
CREATE INDEX idx_clientes_uuid       ON clientes(uuid_sync);
CREATE INDEX idx_clientes_updated    ON clientes(updated_at);

-- sucursales
CREATE INDEX idx_suc_cliente         ON sucursales(cliente_id);
CREATE INDEX idx_suc_updated         ON sucursales(updated_at);

-- catalog_asset_types
CREATE INDEX idx_cat_cliente         ON catalog_asset_types(cliente_id);
CREATE INDEX idx_cat_codigo          ON catalog_asset_types(codigo);
CREATE INDEX idx_cat_updated         ON catalog_asset_types(updated_at);

-- assets
CREATE INDEX idx_assets_cliente      ON assets(cliente_id);
CREATE INDEX idx_assets_sucursal     ON assets(sucursal_id);
CREATE INDEX idx_assets_updated      ON assets(updated_at);
CREATE INDEX idx_assets_estado       ON assets(estado);
CREATE INDEX idx_assets_tag          ON assets(tag);

-- users
CREATE INDEX idx_users_cliente       ON users(cliente_id);
CREATE INDEX idx_users_correo        ON users(correo);
CREATE INDEX idx_users_updated       ON users(updated_at);

-- work_orders
CREATE INDEX idx_wo_cliente          ON work_orders(cliente_id);
CREATE INDEX idx_wo_updated          ON work_orders(updated_at);
CREATE INDEX idx_wo_estado           ON work_orders(estado);

-- preventive_maintenance
CREATE INDEX idx_pm_cliente          ON preventive_maintenance(cliente_id);
CREATE INDEX idx_pm_updated          ON preventive_maintenance(updated_at);
CREATE INDEX idx_pm_equipo           ON preventive_maintenance(equipo_tag);

-- inventory
CREATE INDEX idx_inv_cliente         ON inventory(cliente_id);
CREATE INDEX idx_inv_updated         ON inventory(updated_at);

-- audit_logs
CREATE INDEX idx_audit_cliente       ON audit_logs(cliente_id);
CREATE INDEX idx_audit_user          ON audit_logs(user_id);
CREATE INDEX idx_audit_ts            ON audit_logs(timestamp);

-- cmms_auth_failures
CREATE INDEX idx_authfail_email      ON cmms_auth_failures(email);
CREATE INDEX idx_authfail_ip_email   ON cmms_auth_failures(ip, email, attempted_at);

-- =============================================================================
-- SEED DATA — tenant y sucursal por defecto
-- Los mismos IDs que usa Dexie en el populate() inicial
-- =============================================================================
INSERT INTO clientes (id, uuid_sync, nombre, empresa, email, activo, updated_at, created_at)
VALUES (
  'cliente-default-001',
  'cliente-default-001',
  'Cliente EECOL S.A.',
  'EECOL Industrial',
  'contacto@eecol.cl',
  TRUE,
  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

INSERT INTO sucursales (id, uuid_sync, cliente_id, nombre, codigo, ciudad, region, activo, updated_at, created_at)
VALUES (
  'default-sucursal',
  'default-sucursal',
  'cliente-default-001',
  'Bodega Central',
  '21-STK',
  'Santiago',
  'RM',
  TRUE,
  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

INSERT INTO catalog_asset_types (uuid_sync, cliente_id, codigo, descripcion, activo, updated_at, created_at) VALUES
  (gen_random_uuid()::TEXT, NULL, 'AC', 'Aire acondicionado',  TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  (gen_random_uuid()::TEXT, NULL, 'VH', 'Vehículo',            TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  (gen_random_uuid()::TEXT, NULL, 'GE', 'Grupo electrógeno',   TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  (gen_random_uuid()::TEXT, NULL, 'EB', 'Equipo de Bodega',    TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  (gen_random_uuid()::TEXT, NULL, 'GO', 'Grúa horquilla',      TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  (gen_random_uuid()::TEXT, NULL, 'XX', 'Otros Activos',       TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000);

COMMIT;
'@

# ---------------------------------------------------------------------------
# 3. Guardar SQL en archivo con timestamp
# ---------------------------------------------------------------------------
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$sqlFile   = "reset_schema_$timestamp.sql"

$sql | Out-File -FilePath $sqlFile -Encoding utf8NoBOM
Write-Host ''
Write-Host "SQL generado: $sqlFile" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 4. Ejecutar via psql (si está disponible) o mostrar instrucciones
# ---------------------------------------------------------------------------
if ($SoloGuardarSQL) {
  Write-Host ''
  Write-Host 'Modo -SoloGuardarSQL: no se conecta a Neon.' -ForegroundColor Yellow
  Write-Host "Pega el contenido de '$sqlFile' en:"
  Write-Host '  Neon Console → Tu proyecto → SQL Editor'
  exit 0
}

$psqlCmd = $null
try { $psqlCmd = (Get-Command psql -ErrorAction Stop).Source } catch {}

if ($psqlCmd) {
  Write-Host ''
  Write-Host "psql encontrado: $psqlCmd" -ForegroundColor Green
  Write-Host 'ADVERTENCIA: Se borrarán TODOS los datos. Ctrl+C para cancelar.' -ForegroundColor Red
  Write-Host 'Presiona Enter para continuar...'
  $null = Read-Host

  & psql $dbUrl -f $sqlFile
  if ($LASTEXITCODE -eq 0) {
    Write-Host ''
    Write-Host 'Schema recreado exitosamente en Neon.' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Proximos pasos:'
    Write-Host '  1. Limpia IndexedDB del browser (DevTools → Application → Storage → Clear)'
    Write-Host '  2. Recarga la app — Dexie volvera a ejecutar populate() con los defaults'
    Write-Host '  3. Haz login online para que el usuario quede registrado en Neon'
  } else {
    Write-Host ''
    Write-Host "psql retorno error (exit $LASTEXITCODE)." -ForegroundColor Red
    Write-Host "Revisa '$sqlFile' y ejecutalo manualmente en Neon SQL Editor."
  }
} else {
  Write-Host ''
  Write-Host 'psql no encontrado en PATH.' -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'Opciones para ejecutar el SQL:'
  Write-Host ''
  Write-Host '  OPCION A — Neon Console (recomendado):'
  Write-Host "    1. Abre: https://console.neon.tech"
  Write-Host '    2. Tu proyecto → pestaña "SQL Editor"'
  Write-Host "    3. Pega el contenido de '$sqlFile'"
  Write-Host '    4. Run'
  Write-Host ''
  Write-Host '  OPCION B — Instalar psql y volver a ejecutar:'
  Write-Host '    winget install PostgreSQL.PostgreSQL'
  Write-Host "    .\reset_schema.ps1"
  Write-Host ''
  Write-Host "  OPCION C — Leer el SQL aqui mismo:"
  Write-Host "    Get-Content '$sqlFile'"
}
