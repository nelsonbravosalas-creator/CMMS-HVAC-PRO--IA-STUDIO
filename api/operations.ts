import inventoryHandler from '../server/vercel/handlers/inventory.js';
import maintenanceHandler from '../server/vercel/handlers/maintenance.js';
import workOrdersHandler from '../server/vercel/handlers/work-orders.js';

const handlers: Record<string, (req: any, res: any) => unknown> = {
  inventory: inventoryHandler,
  maintenance: maintenanceHandler,
  'work-orders': workOrdersHandler,
};

export default function handler(req: any, res: any) {
  const resource = String(req.query?.handler || '');
  const selectedHandler = handlers[resource];
  if (!selectedHandler) {
    return res.status(404).json({ success: false, error: 'Operations resource not found' });
  }
  return selectedHandler(req, res);
}
