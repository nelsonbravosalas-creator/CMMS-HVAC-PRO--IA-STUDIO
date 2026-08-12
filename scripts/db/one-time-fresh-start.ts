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

/**
 * Reinicio administrativo solicitado para campañas QA.
 * Conserva únicamente administradores operativos no locales y revoca todas
 * las sesiones. La tabla de respaldo deliberadamente no tiene FK, de modo que
 * una interrupción no deje al sistema sin una vía de recuperación.
 */
export async function resetApplicationDataPreservingAdmins(sql: SqlClient) {
  await sql`CREATE TABLE IF NOT EXISTS cmms_preserved_admins_reset_v2 AS
    SELECT uuid_sync, id, nombre, correo, perfil, pin, pin_hash, activo, data,
           updated_at, created_at, deleted_at, cliente_id
    FROM users
    WHERE false
  `;
  await sql`TRUNCATE TABLE cmms_preserved_admins_reset_v2`;
  await sql`INSERT INTO cmms_preserved_admins_reset_v2 (
      uuid_sync, id, nombre, correo, perfil, pin, pin_hash, activo, data,
      updated_at, created_at, deleted_at, cliente_id
    )
    SELECT uuid_sync, id, nombre, correo, perfil, NULL, pin_hash, true,
           jsonb_set(
             jsonb_set(COALESCE(data, '{}'::jsonb), '{cliente_id}', 'null'::jsonb, true),
             '{cliente_ids}', '[]'::jsonb, true
           ),
           updated_at, created_at, NULL, NULL
    FROM users
    WHERE activo = true
      AND deleted_at IS NULL
      AND LOWER(perfil) = 'administrador'
      AND LOWER(correo) NOT LIKE '%@cmms.local'
      AND pin_hash IS NOT NULL
  `;

  const preserved = await sql`SELECT COUNT(*)::int AS count FROM cmms_preserved_admins_reset_v2`;
  if (Number(preserved[0]?.count || 0) === 0) {
    throw new Error('Fresh-start reset blocked: no operational administrator can be preserved');
  }

  await sql`TRUNCATE TABLE
    cmms_sessions,
    cmms_rate_limits,
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

  await sql`INSERT INTO users (
      uuid_sync, id, nombre, correo, perfil, pin, pin_hash, activo, data,
      updated_at, created_at, deleted_at, cliente_id
    )
    SELECT uuid_sync, id, nombre, correo, perfil, NULL, pin_hash, true, data,
           updated_at, created_at, NULL, NULL
    FROM cmms_preserved_admins_reset_v2
    ON CONFLICT (uuid_sync) DO NOTHING
  `;
  await sql`DROP TABLE cmms_preserved_admins_reset_v2`;

  return Number(preserved[0]?.count || 0);
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
