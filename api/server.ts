import express from 'express';
import { neon } from '@neondatabase/serverless';
import { applySyncOperations } from './_sync';
import { ensureDatabaseSchema, getDatabaseHealth } from './_schema';

const app = express();
app.use(express.json());

const getSql = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no definida');
  return neon(process.env.DATABASE_URL);
};

app.get('/api/health/db', async (_req, res) => {
  try {
    const sql = getSql();
    const health = await getDatabaseHealth(sql);
    res.json({ success: true, ...health });
  } catch (error: any) {
    res.status(503).json({ success: false, configured: Boolean(process.env.DATABASE_URL), connected: false, error: error.message });
  }
});

app.post('/api/health/db', async (_req, res) => {
  try {
    const sql = getSql();
    await ensureDatabaseSchema(sql);
    const health = await getDatabaseHealth(sql);
    res.json({ success: true, migrated: true, ...health });
  } catch (error: any) {
    res.status(503).json({ success: false, configured: Boolean(process.env.DATABASE_URL), connected: false, error: error.message });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    const sql = getSql();
    await ensureDatabaseSchema(sql);
    const payload = await applySyncOperations(sql, req.body);
    const status = payload.success ? 200 : 207;
    res.status(status).json(payload);
  } catch (error: any) {
    console.error('[SYNC ERROR]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fallback for Vercel
export default app;
