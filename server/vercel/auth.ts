import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'node:crypto';
import { privacyHash, rejectUntrustedOrigin, requestIp, writeSecurityAudit } from './security.js';

const ephemeralDevJwtSecret = randomBytes(32).toString('hex');

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return secret || ephemeralDevJwtSecret;
}

function normalizeRole(role: string | undefined | null) {
  return String(role || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function canonicalRole(role: string | undefined | null) {
  const normalized = normalizeRole(role);
  if (normalized.includes('admin')) return 'administrador';
  if (normalized.includes('superv')) return 'supervisor';
  if (normalized.includes('tecn') || normalized.includes('ingeniero')) return 'tecnico';
  if (normalized.includes('client')) return 'cliente';
  if (normalized.includes('contrat')) return 'contratista';
  return 'visita';
}

export function isAdminUser(user: any) {
  return canonicalRole(user?.perfil) === 'administrador';
}

export function canWrite(user: any) {
  return ['administrador', 'supervisor', 'tecnico', 'contratista', 'cliente']
    .includes(canonicalRole(user?.perfil));
}

const OPERATIONAL_WRITE_TABLES = new Set([
  'preventive_maintenance',
  'work_orders',
  'reports',
  'events',
  'ordenes_servicio',
  'inventory',
  'calendar'
]);

export function canWriteResource(
  user: any,
  resource: string,
  operation: 'insert' | 'update' | 'delete' = 'update'
) {
  const role = canonicalRole(user?.perfil);
  if (role === 'administrador') return true;
  if (role === 'supervisor') {
    return resource === 'assets' || OPERATIONAL_WRITE_TABLES.has(resource);
  }
  if (role === 'tecnico' || role === 'contratista') {
    if (!OPERATIONAL_WRITE_TABLES.has(resource)) return false;
    return !(resource === 'work_orders' && operation === 'delete');
  }
  if (role === 'cliente') {
    return resource === 'work_orders' && operation === 'insert';
  }
  return false;
}

export function getScopedTenantId(user: any, requestedTenantId?: any) {
  if (isAdminUser(user)) {
    return requestedTenantId || user?.cliente_id || null;
  }
  const allowedTenants = Array.isArray(user?.cliente_ids) ? user.cliente_ids : [];
  const requested = requestedTenantId || user?.cliente_id || allowedTenants[0];
  return requested && (requested === user?.cliente_id || allowedTenants.includes(requested))
    ? requested
    : null;
}

export function signToken(payload: any) {
  return jwt.sign(payload, getSecretKey(), { expiresIn: '8h' });
}

export async function createSession(sql: any, req: any, payload: any) {
  const jti = randomUUID();
  const now = Date.now();
  const expiresAt = now + 8 * 60 * 60 * 1000;
  await sql`
    INSERT INTO cmms_sessions (jti, user_id, created_at, expires_at, revoked_at, last_seen_at, ip_hash)
    VALUES (${jti}, ${payload.uuid_sync || payload.id}, ${now}, ${expiresAt}, NULL, ${now}, ${privacyHash(requestIp(req))})
  `;
  return signToken({ ...payload, jti });
}

export function setAuthCookie(res: any, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `cmms_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
}

function getCookie(req: any, name: string) {
  for (const cookie of String(req.headers?.cookie || '').split(';')) {
    const [key, ...value] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export function verifyToken(req: any) {
  try {
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;
    const token = bearer && bearer !== 'cookie-session'
      ? bearer
      : getCookie(req, 'cmms_session');
    if (!token) return null;
    return jwt.verify(token, getSecretKey());
  } catch (e) {
    return null;
  }
}

export async function requireAuth(req: any, res: any, sql: any) {
  if (rejectUntrustedOrigin(req, res)) return null;
  const tokenUser: any = verifyToken(req);
  if (!tokenUser?.jti || !sql) {
    res.status(401).json({ success: false, error: 'No autorizado - sesión inválida o ausente' });
    return null;
  }
  const now = Date.now();
  const rows = await sql`
    SELECT s.jti, u.uuid_sync, u.id, u.perfil, u.cliente_id, u.activo,
      COALESCE(array_agg(uc.cliente_id) FILTER (WHERE uc.cliente_id IS NOT NULL), ARRAY[]::text[]) AS cliente_ids
    FROM cmms_sessions s
    JOIN users u ON u.uuid_sync = s.user_id
    LEFT JOIN user_clientes uc ON uc.user_id = u.uuid_sync
    WHERE s.jti = ${tokenUser.jti}
      AND s.user_id = ${tokenUser.uuid_sync || tokenUser.id}
      AND s.revoked_at IS NULL
      AND s.expires_at > ${now}
      AND u.activo = true
      AND u.deleted_at IS NULL
    GROUP BY s.jti, u.uuid_sync, u.id, u.perfil, u.cliente_id, u.activo
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) {
    await writeSecurityAudit(sql, {
      action: 'auth.session_rejected',
      entityType: 'session',
      entityId: String(tokenUser.jti),
      userId: tokenUser.uuid_sync || tokenUser.id,
      tenantId: tokenUser.cliente_id,
      outcome: 'denied'
    });
    res.status(401).json({ success: false, error: 'No autorizado - sesión inválida o revocada' });
    return null;
  }
  const requestPath = String(req.url || req.headers?.['x-vercel-forwarded-for'] || '');
  if (tokenUser.must_change_pin && !requestPath.includes('change-pin') && !requestPath.includes('logout')) {
    await writeSecurityAudit(sql, {
      action: 'auth.pin_change_required', entityType: 'user', entityId: user.uuid_sync,
      userId: user.uuid_sync, tenantId: user.cliente_id, outcome: 'denied'
    });
    res.status(403).json({
      success: false,
      error: 'Debe cambiar el PIN inicial antes de continuar',
      code: 'PIN_CHANGE_REQUIRED'
    });
    return null;
  }
  return { ...tokenUser, ...user, cliente_ids: user.cliente_ids || [] };
}

export function requireRole(allowedRoles: string[]) {
  return async (req: any, res: any, sql: any) => {
    const user: any = await requireAuth(req, res, sql);
    if (!user) {
      return null;
    }
    const allowed = allowedRoles.map(canonicalRole);
    if (!allowed.includes(canonicalRole(user.perfil))) {
      await writeSecurityAudit(sql, {
        action: 'authorization.denied', entityType: 'route', entityId: String(req.url || 'unknown'),
        userId: user.uuid_sync || user.id, tenantId: user.cliente_id, outcome: 'denied',
        details: { role: canonicalRole(user.perfil) }
      });
      res.status(403).json({ success: false, error: 'No autorizado - rol insuficiente' });
      return null;
    }
    return user;
  };
}
