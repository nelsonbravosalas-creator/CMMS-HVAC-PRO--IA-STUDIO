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

export function isAdminUser(user: any) {
  const role = normalizeRole(user?.perfil);
  return role.includes('admin');
}

export function getScopedTenantId(user: any, requestedTenantId?: any) {
  if (isAdminUser(user)) {
    return requestedTenantId || user?.cliente_id || null;
  }
  const allowedTenants = Array.isArray(user?.cliente_ids) ? user.cliente_ids : [];
  const requested = requestedTenantId || user?.cliente_id;
  return requested && (requested === user?.cliente_id || allowedTenants.includes(requested))
    ? requested
    : null;
}

export function signToken(payload: any) {
  return jwt.sign(payload, getSecretKey(), { expiresIn: '12h' });
}

export function verifyToken(req: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice('Bearer '.length).trim();
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
    const allowed = allowedRoles.map(normalizeRole);
    if (!allowed.includes(normalizeRole(user.perfil))) {
      res.status(403).json({ success: false, error: 'No autorizado - rol insuficiente' });
      return null;
    }
    return user;
  };
}
