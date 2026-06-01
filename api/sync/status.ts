import { getDb } from '../_db.js';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    
    // Quick query to verify database is alive
    const dbLive = await sql`SELECT NOW()`;
    
    return res.json({
      success: true,
      status: 'online',
      db: 'connected',
      serverTime: Date.now(),
      dbTime: dbLive[0]?.now
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'offline',
      error: error.message
    });
  }
}
