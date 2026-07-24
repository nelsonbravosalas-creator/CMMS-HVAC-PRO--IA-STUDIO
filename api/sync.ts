import importDataHandler from '../server/vercel/handlers/import-data.js';
import syncHandler from '../server/vercel/handlers/sync.js';

export default function handler(req: any, res: any) {
  const resource = String(req.query?.handler || 'sync');
  if (resource === 'sync') return syncHandler(req, res);
  if (resource === 'import-data') return importDataHandler(req, res);
  return res.status(404).json({ success: false, error: 'Sync resource not found' });
}
