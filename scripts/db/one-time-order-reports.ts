type SqlClient = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export const ORDER_REPORTS_MIGRATION_ID = '2026-08-05-order-reports-v1';

export async function migrateOrderReports(sql: SqlClient) {
  const applied = await sql`
    SELECT id
    FROM cmms_one_shot_migrations
    WHERE id = ${ORDER_REPORTS_MIGRATION_ID}
    LIMIT 1
  `;

  if (applied.length > 0) return false;

  // Los informes históricos no poseen una relación verificable con una OS.
  // Se eliminan una única vez según la decisión funcional; no se toca ninguna
  // otra tabla operacional.
  await sql`DELETE FROM reports`;
  await sql`
    INSERT INTO cmms_one_shot_migrations (id, description)
    VALUES (
      ${ORDER_REPORTS_MIGRATION_ID},
      'Limpieza única de informes huérfanos y activación de relación OS 1:N'
    )
    ON CONFLICT (id) DO NOTHING
  `;
  return true;
}

