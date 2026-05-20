import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const ROLE_ALIASES: Record<string, string> = {
  administrador: 'administrador',
  admin: 'administrador',
  programador: 'programador',
  supervisor: 'supervisor',
  tecnico: 'tecnico',
  técnico: 'tecnico',
  tecnico_lider: 'supervisor',
  técnico_líder: 'supervisor',
  ingeniero_confiabilidad: 'supervisor',
  cliente: 'cliente',
  contratista: 'contratista',
  visita: 'visita'
};

function getSecretKey() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('JWT_SECRET debe estar configurado en producción');
  }
  return 'cmms_dev_secret_only_for_local';
}

export function normalizeRole(role?: string | null) {
  const normalized = String(role || '').trim().toLowerCase().replace(/\s+/g, '_');
  return ROLE_ALIASES[normalized] || normalized;
}

export function signToken(payload: any) {
  return jwt.sign({ ...payload, perfil: normalizeRole(payload?.perfil) }, getSecretKey(), { expiresIn: '7d' });
}

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(pin), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPin(pin: string, storedHash?: string | null) {
  if (!storedHash?.startsWith('scrypt:')) return false;
  const [, salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(String(pin), salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyToken(req: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    return jwt.verify(token, getSecretKey());
  } catch (e) {
    return null;
  }
}

export function requireRole(allowedRoles: string[]) {
  const allowed = allowedRoles.map(normalizeRole);
  return (req: any, res: any) => {
    const user: any = verifyToken(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'No autorizado - falta token' });
      return null;
    }
    if (!allowed.includes(normalizeRole(user.perfil))) {
      res.status(403).json({ success: false, error: 'No autorizado - rol insuficiente' });
      return null;
    }
    return { ...user, perfil: normalizeRole(user.perfil) };
  };
}
