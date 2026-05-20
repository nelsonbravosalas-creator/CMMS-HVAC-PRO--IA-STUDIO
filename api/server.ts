import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { applySyncOperations } from './_sync';
import { ensureDatabaseSchema, getDatabaseHealth } from './_schema';
import { getDb } from './_db';
import { requireRole } from './_auth';

const app = express();
app.use(express.json({ limit: '50mb' }));

const allRoles = ['administrador', 'programador', 'supervisor', 'tecnico', 'contratista'];

function getSql() {
  return getDb();
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const user = requireRole(['administrador', 'programador'])(req, res);
    if (!user) return;
    const sql = getSql();
    await ensureDatabaseSchema(sql);
    const health = await getDatabaseHealth(sql);
    res.json({ success: true, ...health });
  } catch (error: any) {
    res.status(503).json({ success: false, configured: Boolean(process.env.DATABASE_URL), connected: false, error: error.message });
  }
});

app.post('/api/health/db', async (req, res) => {
  try {
    const user = requireRole(['administrador', 'programador'])(req, res);
    if (!user) return;
    const sql = getSql();
    await ensureDatabaseSchema(sql);
    const health = await getDatabaseHealth(sql);
    res.json({ success: true, migrated: true, ...health });
  } catch (error: any) {
    res.status(503).json({ success: false, configured: Boolean(process.env.DATABASE_URL), connected: false, error: error.message });
  }
});

app.post('/api/ocr', async (req, res) => {
  try {
    const user = requireRole(allRoles)(req, res);
    if (!user) return;

    const imageBase64 = req.body.imageBase64 || req.body.image;
    const mimeType = req.body.mimeType || 'image/jpeg';
    if (!imageBase64) return res.status(400).json({ success: false, error: 'imageBase64 requerido' });

    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = ai.getGenerativeModel({ model: 'gemini-3.1-flash' });
    const prompt = "Extrae de esta placa HVAC o similares: Marca, Modelo, N Serie, Refrigerante, Voltaje, Amperaje Nominal y Capacidad. Devuelve SOLO un objeto JSON con estas keys: {'marca':'','modelo':'','n_serie':'','refrigerante':'','capacidad_btu':'','voltaje':'','amperaje':''}";
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { data: imageBase64, mimeType } }
        ]
      }]
    });

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    res.json({ success: Boolean(jsonMatch), data: jsonMatch ? JSON.parse(jsonMatch[0]) : {} });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    const buckets = [req.body?.inserts, req.body?.updates, req.body?.deletes];
    const touchesUsers = buckets.some((bucket) => Array.isArray(bucket) && bucket.some((item: any) => item?.table === 'users'));
    const user = requireRole(touchesUsers ? ['administrador', 'programador'] : allRoles)(req, res);
    if (!user) return;

    const sql = getSql();
    await ensureDatabaseSchema(sql);
    const payload = await applySyncOperations(sql, req.body);
    res.status(payload.success ? 200 : 207).json(payload);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default app;
