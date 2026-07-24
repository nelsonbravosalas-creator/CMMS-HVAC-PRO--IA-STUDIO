import assetsHandler from '../server/vercel/handlers/assets.js';
import clientsHandler from '../server/vercel/handlers/clients.js';
import usersHandler from '../server/vercel/handlers/users.js';

const handlers: Record<string, (req: any, res: any) => unknown> = {
  assets: assetsHandler,
  clients: clientsHandler,
  users: usersHandler,
};

export default function handler(req: any, res: any) {
  const resource = String(req.query?.handler || '');
  const selectedHandler = handlers[resource];
  if (!selectedHandler) {
    return res.status(404).json({ success: false, error: 'Core resource not found' });
  }
  return selectedHandler(req, res);
}
