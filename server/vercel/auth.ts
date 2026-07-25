import jwt from 'jsonwebtoken';

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return secret || 'dev_only_jwt_secret_change_me';
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
  return jwt.sign(payload, getSecretKey(), { expiresIn: '12h' });
}

export function setAuthCookie(res: any, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `cmms_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
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

export function requireAuth(req: any, res: any) {
  const user: any = verifyToken(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'No autorizado - token inválido o ausente' });
    return null;
  }
  return user;
}

export function requireRole(allowedRoles: string[]) {
  return (req: any, res: any) => {
    const user: any = requireAuth(req, res);
    if (!user) {
      return null;
    }
    const allowed = allowedRoles.map(canonicalRole);
    if (!allowed.includes(canonicalRole(user.perfil))) {
      res.status(403).json({ success: false, error: 'No autorizado - rol insuficiente' });
      return null;
    }
    return user;
  };
}
