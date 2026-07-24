type SqlClient = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export const FRESH_START_MIGRATION_ID = "2026-07-24-fresh-start-v1";

export async function ensureOneShotMigrationTable(sql: SqlClient) {
  await sql`CREATE TABLE IF NOT EXISTS cmms_one_shot_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT NOT NULL
  )`;
}

export async function needsFreshStartReset(sql: SqlClient) {
  await ensureOneShotMigrationTable(sql);
  const rows = await sql`
    SELECT id
    FROM cmms_one_shot_migrations
    WHERE id = ${FRESH_START_MIGRATION_ID}
    LIMIT 1
  `;
  return rows.length === 0;
}

export async function resetApplicationData(sql: SqlClient) {
  await sql`TRUNCATE TABLE
    cmms_auth_failures,
    cmms_idempotency_keys,
    user_clientes,
    audit_logs,
    preventive_maintenance,
    work_orders,
    reports,
    events,
    ordenes_servicio,
    inventory,
    calendar,
    assets,
    catalog_asset_types,
    settings,
    users,
    sucursales,
    clientes
    RESTART IDENTITY CASCADE
  `;
}

export async function markFreshStartComplete(sql: SqlClient) {
  await sql`
    INSERT INTO cmms_one_shot_migrations (id, description)
    VALUES (
      ${FRESH_START_MIGRATION_ID},
      'Borrón y cuenta nueva solicitado: limpieza total y carga paramétrica inicial'
    )
    ON CONFLICT (id) DO NOTHING
  `;
}
