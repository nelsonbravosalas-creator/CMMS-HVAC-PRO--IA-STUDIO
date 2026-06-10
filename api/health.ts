import { getDb } from './_db.js';

export default async function handler(req: any, res: any) {
  try {
    const db = getDb();
    const result = await db`SELECT NOW()`;
    return res.status(200).json({
      status: 'ok',
      timestamp: Date.now(),
      database: 'connected',
      dbTime: result[0]?.now
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
}
