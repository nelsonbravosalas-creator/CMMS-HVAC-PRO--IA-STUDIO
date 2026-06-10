// CMMS HVAC PRO — migrate-defaults
// Inserts canonical default client/branch records and migrates legacy IDs.
// Safe to call multiple times (idempotent).

import { getDb } from './_db.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const sql = getDb();
    const now = Date.now();
    const report: string[] = [];

    // 1. Ensure canonical default client exists
    const clientResult = await sql`
      INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at)
      VALUES (
        'cliente-default-001',
        'cliente-default-001',
        '{"nombre": "EECOL Electric", "rut": "76.123.456-7", "email": "contacto@eecol.cl"}'::jsonb,
        ${now}, ${now}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    report.push(clientResult.length > 0
      ? 'Inserted cliente-default-001'
      : 'cliente-default-001 already exists');

    // 2. Ensure canonical default branch exists (references the canonical client)
    const branchResult = await sql`
      INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at)
      VALUES (
        'default-sucursal',
        'cliente-default-001',
        'default-sucursal',
        '{"nombre": "Bodega Central", "direccion": "Dirección por defecto", "codigo": "BOD-001"}'::jsonb,
        ${now}, ${now}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    report.push(branchResult.length > 0
      ? 'Inserted default-sucursal'
      : 'default-sucursal already exists');

    // 3. Migrate legacy cliente_id references across all tenant tables
    const tables = [
      'assets', 'users', 'work_orders', 'preventive_maintenance',
      'inventory', 'reports', 'events', 'calendar', 'ordenes_servicio'
    ];

    for (const table of tables) {
      try {
        const updated = await sql`
          UPDATE ${sql(table)}
          SET cliente_id = 'cliente-default-001'
          WHERE cliente_id = 'cliente-eecol-default-001'
          RETURNING uuid_sync
        `;
        if (updated.length > 0) {
          report.push(`Migrated ${updated.length} rows in ${table}: cliente-eecol-default-001 → cliente-default-001`);
        }
      } catch (e: any) {
        report.push(`Skipped ${table}: ${e.message}`);
      }
    }

    // Migrate sucursales.cliente_id as well
    try {
      const updatedSuc = await sql`
        UPDATE sucursales
        SET cliente_id = 'cliente-default-001'
        WHERE cliente_id = 'cliente-eecol-default-001'
        RETURNING id
      `;
      if (updatedSuc.length > 0) {
        report.push(`Migrated ${updatedSuc.length} rows in sucursales: cliente-eecol-default-001 → cliente-default-001`);
      }
    } catch (e: any) {
      report.push(`Skipped sucursales migration: ${e.message}`);
    }

    // 4. Summary counts
    const counts: any = {};
    for (const t of ['clientes', 'sucursales', 'assets', 'users', 'work_orders', 'preventive_maintenance', 'inventory']) {
      try {
        const r = await sql`SELECT COUNT(*)::int as n FROM ${sql(t)}`;
        counts[t] = r[0]?.n ?? 0;
      } catch (e: any) {
        counts[t] = `error: ${e.message}`;
      }
    }

    return res.json({ success: true, report, counts });
  } catch (error: any) {
    console.error('migrate-defaults error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
