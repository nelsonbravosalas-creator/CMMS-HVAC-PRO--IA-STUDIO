export default async function handler(req: any, res: any) {
  const resource = String(req.query?.handler || 'sync');
  try {
    if (resource === 'sync') {
      const { default: syncHandler } = await import('../server/vercel/handlers/sync.js');
      return await syncHandler(req, res);
    }
    if (resource === 'import-data') {
      const { default: importDataHandler } = await import('../server/vercel/handlers/import-data.js');
      return await importDataHandler(req, res);
    }
    return res.status(404).json({ success: false, error: 'Sync resource not found' });
  } catch (error: any) {
    console.error(`[api/sync] ${resource} initialization failed`, error);
    return res.status(500).json({
      success: false,
      error: 'No fue posible inicializar el servicio de sincronización.',
      code: 'SYNC_INITIALIZATION_FAILED'
    });
  }
}
