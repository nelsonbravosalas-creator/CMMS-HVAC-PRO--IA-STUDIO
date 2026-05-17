import jwt from 'jsonwebtoken';

function getSecretKey() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('JWT_SECRET debe estar configurado en producción');
  }
  return 'cmms_dev_secret_only_for_local';
}

export function signToken(payload: any) {
  return jwt.sign(payload, getSecretKey(), { expiresIn: '7d' });
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
  return (req: any, res: any) => {
    const user: any = verifyToken(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'No autorizado - falta token' });
      return null;
    }
    if (!allowedRoles.includes(user.perfil)) {
      res.status(403).json({ success: false, error: 'No autorizado - rol insuficiente' });
      return null;
    }
    return user;
  };
}
