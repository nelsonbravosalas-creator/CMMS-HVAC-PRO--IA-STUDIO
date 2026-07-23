// URLS CANÓNICAS — estas son las únicas correctas
export const API_ENDPOINTS = {
  // Activos / Equipos HVAC
  assets:           '/api/assets',
  assetById:        (id: string) => `/api/assets/${id}`,

  // Órdenes de trabajo — usar kebab-case, NO camelCase
  workOrders:       '/api/work-orders',           // ← CORRECTO (no /api/workOrders)
  workOrderById:    (id: string) => `/api/work-orders/${id}`,
  workOrderComplete:(id: string) => `/api/work-orders/${id}/complete`,

  // Mantenimiento preventivo
  maintenance:      '/api/maintenance',
  maintenanceById:  (id: string) => `/api/maintenance/${id}`,
  maintenanceExec:  (id: string) => `/api/maintenance/${id}/execute`,

  // Repuestos — usar /api/parts, NO /api/inventory
  parts:            '/api/parts',                 // ← CORRECTO (no /api/inventory)
  partById:         (id: string) => `/api/parts/${id}`,
  partAdjust:       (id: string) => `/api/parts/${id}/adjust`,

  // Técnicos
  technicians:      '/api/technicians',
  technicianById:   (id: string) => `/api/technicians/${id}`,

  // Dashboard
  dashboardKpis:    '/api/dashboard/kpis',
  dashboardUpcoming:'/api/dashboard/upcoming',
  dashboardAlerts:  '/api/dashboard/alerts',

  // Sync
  syncPush:         '/api/sync/push',
  syncPull:         '/api/sync/pull',
  syncStatus:       '/api/sync/status',
} as const;
