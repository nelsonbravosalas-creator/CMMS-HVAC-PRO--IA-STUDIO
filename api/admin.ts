import initDbHandler from '../server/vercel/handlers/init-db.js';

export default function handler(req: any, res: any) {
  const resource = String(req.query?.handler || '');
  if (resource === 'init-db') return initDbHandler(req, res);
  return res.status(404).json({ success: false, error: 'Admin resource not found' });
}
