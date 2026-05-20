import express from 'express';
import { applySyncOperations } from './_sync';
import { ensureDatabaseSchema, getDatabaseHealth } from './_schema';
import { getDb } from './_db';
import { requireRole } from './_auth';

const app = express();
app.use(express.json());

const getSql = () => {
  return getDb();
};

app.get('/api/health/db', async (_req, res) => {
  try {
    const user = requireRole(['administrador', 'programador'])(_req, res);
    if (!user) return;
    const sql = getSql();
    const health = await getDatabaseHealth(sql);
    res.json({ success: true, ...health });
  } catch (error: any) {
    res.status(503).json({ success: false, configured: Boolean(process.env.DATABASE_URL), connected: false, error: error.message });
  }
});

app.post('/api/health/db', async (_req, res) => {
  try {
    const user = requireRole(['administrador', 'programador'])(_req, res);
    if (!user) return;
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
    const buckets = [req.body?.inserts, req.body?.updates, req.body?.deletes];
    const touchesUsers = buckets.some((bucket) => Array.isArray(bucket) && bucket.some((item: any) => item?.table === 'users'));
    const user = requireRole(touchesUsers
      ? ['administrador', 'programador']
      : ['administrador', 'programador', 'supervisor', 'tecnico', 'contratista'])(req, res);
    if (!user) return;
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
