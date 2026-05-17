export const ALLOWED_TABLES = [
  'assets',
  'users',
  'preventive_maintenance',
  'work_orders',
  'reports',
  'events',
  'clients',
  'branches',
  'ordenes_servicio'
] as const;

export type SyncTable = typeof ALLOWED_TABLES[number];

export const GENERIC_SYNC_TABLES = ALLOWED_TABLES.filter((table) => table !== 'assets') as Exclude<SyncTable, 'assets'>[];

export function normalizeSyncTable(table: string): SyncTable | null {
  if (table === 'equipos') return 'assets';
  if (table === 'informes') return 'reports';
  return (ALLOWED_TABLES as readonly string[]).includes(table) ? table as SyncTable : null;
}

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url || (!url.startsWith('postgres://') && !url.startsWith('postgresql://'))) {
    throw new Error('DATABASE_URL o POSTGRES_URL no configurada o inválida');
  }
  return url;
}

export async function ensureDatabaseSchema(sql: any) {
  await renameLegacyTables(sql);

  await sql`CREATE TABLE IF NOT EXISTS assets (
    uuid_sync TEXT PRIMARY KEY,
    tag TEXT UNIQUE,
    nombre TEXT NOT NULL DEFAULT '',
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
    cliente_id TEXT,
    sucursal_id TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
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

  for (const table of GENERIC_SYNC_TABLES.filter((table) => table !== 'users')) {
    await sql(`CREATE TABLE IF NOT EXISTS ${table} (
      uuid_sync TEXT PRIMARY KEY,
      id TEXT,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at BIGINT,
      created_at BIGINT,
      deleted_at BIGINT
    )`);
  }

  await addCommonColumns(sql);
  await addIndexes(sql);
}

async function renameLegacyTables(sql: any) {
  const legacyPairs: [string, SyncTable][] = [
    ['activos', 'assets'],
    ['usuarios', 'users'],
    ['mantenimientos', 'preventive_maintenance'],
    ['tickets', 'work_orders'],
    ['informes', 'reports'],
    ['eventos', 'events'],
    ['clientes', 'clients'],
    ['sucursales', 'branches']
  ];

  for (const [legacy, current] of legacyPairs) {
    try {
      await sql(`ALTER TABLE IF EXISTS ${legacy} RENAME TO ${current}`);
    } catch (error: any) {
      // If the target table already exists, keep the current canonical table.
      if (!String(error?.message || '').includes('already exists')) throw error;
    }
  }
}

async function addCommonColumns(sql: any) {
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS tag TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS nombre TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS tipo TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS marca TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS modelo TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS serie TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS ubicacion TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS area TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS capacidad TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS voltaje TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS corriente TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS refrigerante TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS fecha_instalacion TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS vida_util INTEGER DEFAULT 10`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'operativo'`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS ultimo_mantenimiento TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS proximo_mantenimiento TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS horas_operacion INTEGER DEFAULT 0`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS tecnicos JSONB`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS notas TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS cliente_id TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS sucursal_id TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_at BIGINT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS uuid_sync TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS id TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nombre TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS correo TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS perfil TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS data JSONB`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at BIGINT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at BIGINT`;

  for (const table of GENERIC_SYNC_TABLES.filter((table) => table !== 'users')) {
    await sql(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS uuid_sync TEXT`);
    await sql(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS id TEXT`);
    await sql(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb`);
    await sql(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at BIGINT`);
    await sql(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_at BIGINT`);
    await sql(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS deleted_at BIGINT`);
  }
}

async function addIndexes(sql: any) {
  for (const table of ALLOWED_TABLES) {
    await sql(`CREATE INDEX IF NOT EXISTS idx_${table}_updated_at ON ${table} (updated_at)`);
    await sql(`CREATE INDEX IF NOT EXISTS idx_${table}_deleted_at ON ${table} (deleted_at)`);
  }
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_uuid_sync ON assets (uuid_sync)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_tag ON assets (tag)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uuid_sync ON users (uuid_sync)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_id ON users (id)`;
}

export async function getDatabaseHealth(sql: any) {
  const schemaRows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  const columnRows = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY(${ALLOWED_TABLES})
    ORDER BY table_name, ordinal_position
  `;

  const counts: Record<string, number | string> = {};
  for (const table of ALLOWED_TABLES) {
    try {
      const countRows = await sql(`SELECT count(*)::int AS count FROM ${table}`);
      counts[table] = countRows[0]?.count ?? 0;
    } catch (error: any) {
      counts[table] = `ERROR: ${error.message}`;
    }
  }

  const existingTables = schemaRows.map((row: any) => row.table_name);
  return {
    configured: true,
    connected: true,
    expectedTables: ALLOWED_TABLES,
    missingTables: ALLOWED_TABLES.filter((table) => !existingTables.includes(table)),
    existingTables,
    counts,
    columns: columnRows
  };
}
