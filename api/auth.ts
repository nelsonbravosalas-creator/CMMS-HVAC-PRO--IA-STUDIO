import { getDb } from './_db';
import { hashPin, normalizeRole, signToken, verifyPin } from './_auth';

const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(req: any) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const key = forwarded || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = attempts.get(key);
  if (!bucket || bucket.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (bucket.count >= 10) return true;
  bucket.count += 1;
  return false;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (isRateLimited(req)) return res.status(429).json({ success: false, error: 'Demasiados intentos. Intenta nuevamente más tarde.' });

  try {
    const sql = getDb();
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ success: false, error: 'PIN requerido' });

    const rows = await sql`
      SELECT id, nombre, correo, perfil, activo, pin, pin_hash
      FROM users
      WHERE activo = true AND (pin_hash IS NOT NULL OR pin = ${pin})
    `;
    
    const user = rows.find((row: any) => verifyPin(pin, row.pin_hash) || row.pin === pin);
    if (!user) {
      return res.status(401).json({ success: false, error: 'PIN inválido' });
    }

    if (!user.pin_hash && user.pin === pin) {
      await sql`UPDATE users SET pin_hash = ${hashPin(pin)}, pin = NULL WHERE id = ${user.id}`;
    }

    const { pin: _, pin_hash: __, ...safeUser } = user;
    safeUser.perfil = normalizeRole(safeUser.perfil);
    
    const token = signToken({ id: safeUser.id, perfil: safeUser.perfil });

    return res.json({ success: true, user: safeUser, token });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: 'Servicio no disponible', offline: true });
  }
}
