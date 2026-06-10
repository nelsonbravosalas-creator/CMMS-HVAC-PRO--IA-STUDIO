import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) throw new Error('JWT_SECRET no configurado en variables de entorno');

export function signToken(payload: any) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn: '7d' });
}

export function verifyToken(req: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    return jwt.verify(token, SECRET_KEY);
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
