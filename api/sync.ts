import { getDb } from './_db';
import { applySyncOperations } from './_sync';
import { ensureDatabaseSchema } from './_schema';
import { requireRole } from './_auth';

function payloadTouchesUsers(body: any) {
  const buckets = [body?.inserts, body?.updates, body?.deletes];
  return buckets.some((bucket) => Array.isArray(bucket) && bucket.some((item: any) => item?.table === 'users'));
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  try {
    const user = requireRole(payloadTouchesUsers(req.body)
      ? ['administrador', 'programador']
      : ['administrador', 'programador', 'supervisor', 'tecnico', 'contratista'])(req, res);
    if (!user) return;
    const sql = getDb();
    await ensureDatabaseSchema(sql);
    const payload = await applySyncOperations(sql, req.body);
    const status = payload.success ? 200 : 207;
    return res.status(status).json(payload);
  } catch (error: any) {
    console.error('[SYNC ERROR]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
