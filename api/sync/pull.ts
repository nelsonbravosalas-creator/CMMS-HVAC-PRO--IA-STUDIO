import { getDb } from '../_db.js';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;
    const serverChanges: any = {};

    // Pull changes from each table
    const assets = await sql`SELECT * FROM assets WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
    if (assets.length > 0) serverChanges.assets = assets;

    const work_orders = await sql`SELECT * FROM work_orders WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
    if (work_orders.length > 0) serverChanges.work_orders = work_orders;

    const preventive_maintenance = await sql`SELECT * FROM preventive_maintenance WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
    if (preventive_maintenance.length > 0) serverChanges.preventive_maintenance = preventive_maintenance;

    const inventory = await sql`SELECT * FROM inventory WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
    if (inventory.length > 0) serverChanges.inventory = inventory;

    const users = await sql`SELECT * FROM users WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
    if (users.length > 0) serverChanges.users = users;

    const branches = await sql`SELECT * FROM branches WHERE updated_at > ${since} OR updated_at IS NULL ORDER BY updated_at ASC LIMIT 1000`;
    if (branches.length > 0) serverChanges.branches = branches;

    return res.json({
      success: true,
      serverChanges,
      serverTime: Date.now()
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
