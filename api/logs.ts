import { getDb } from './_db';
import { requireRole } from './_auth';

const LEVELS = new Set(['info', 'warn', 'error', 'debug']);
const writeBuckets = new Map<string, { count: number; resetAt: number }>();

function normalizeLimit(value: unknown) {
  const parsed = Number(value || 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(Math.max(Math.trunc(parsed), 1), 500);
}

function safeJson(value: unknown) {
  if (value === undefined) return null;
  try {
    JSON.stringify(value);
    return value;
  } catch {
    return { unserializable: true };
  }
}

function isWriteRateLimited(req: any) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const key = forwarded || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = writeBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    writeBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (bucket.count >= 60) return true;
  bucket.count += 1;
  return false;
}

export default async function handler(req: any, res: any) {
  const readUser = req.method === 'GET'
    ? requireRole(['administrador', 'programador', 'supervisor'])(req, res)
    : requireRole(['administrador', 'programador', 'supervisor', 'tecnico', 'contratista', 'cliente', 'visita'])(req, res);
  const user = readUser;
  if (!user) return;
  const sql = getDb();

  if (req.method === 'GET') {
    const limit = normalizeLimit(req.query?.limit);
    const level = typeof req.query?.level === 'string' ? req.query.level : '';
    const rows = level && LEVELS.has(level)
      ? await sql`SELECT * FROM system_logs WHERE level = ${level} ORDER BY timestamp DESC LIMIT ${limit}`
      : await sql`SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT ${limit}`;
    return res.json({ success: true, data: rows });
  }

  if (req.method === 'POST') {
    if (isWriteRateLimited(req)) {
      return res.status(429).json({ success: false, error: 'Demasiados logs en poco tiempo.' });
    }
    const body = req.body || {};
    const level = LEVELS.has(body.level) ? body.level : 'info';
    const id = body.id || crypto.randomUUID();
    const timestamp = Number(body.timestamp || Date.now());
    const context = String(body.context || 'General').slice(0, 120);
    const message = String(body.message || '').slice(0, 2000);
    const source = String(body.source || 'frontend').slice(0, 80);

    if (!message) {
      return res.status(400).json({ success: false, error: 'message requerido' });
    }

    await sql`
      INSERT INTO system_logs (id, timestamp, level, source, context, message, data, user_id, path, user_agent)
      VALUES (
        ${id},
        ${timestamp},
        ${level},
        ${source},
        ${context},
        ${message},
        ${JSON.stringify(safeJson(body.data))},
        ${body.user_id || null},
        ${body.path || req.headers.referer || null},
        ${body.user_agent || req.headers['user-agent'] || null}
      )
      ON CONFLICT (id) DO NOTHING
    `;

    return res.status(201).json({ success: true, id });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
