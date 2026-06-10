// URLS CANÓNICAS — alineadas con server.ts
export const API_ENDPOINTS = {
  // Activos / Equipos HVAC
  assets:            '/api/assets',
  assetById:         (id: string) => `/api/assets/${id}`,

  // Órdenes de trabajo — vía v1 multi-tenant
  workOrders:        (clienteId: string) => `/api/v1/${clienteId}/work-orders`,
  workOrderById:     (clienteId: string, id: string) => `/api/v1/${clienteId}/work-orders/${id}`,

  // Mantenimiento preventivo — vía v1 multi-tenant
  planning:          (clienteId: string) => `/api/v1/${clienteId}/planning`,
  planningById:      (clienteId: string, id: string) => `/api/v1/${clienteId}/planning/${id}`,

  // Inventario / Repuestos — vía v1 multi-tenant
  inventory:         (clienteId: string) => `/api/v1/${clienteId}/inventory`,
  inventoryById:     (clienteId: string, id: string) => `/api/v1/${clienteId}/inventory/${id}`,

  // Activos por sucursal — vía v1 multi-tenant
  branchAssets:      (clienteId: string, branchId: string) => `/api/v1/${clienteId}/branches/${branchId}/assets`,
  branchAssetById:   (clienteId: string, branchId: string, id: string) => `/api/v1/${clienteId}/branches/${branchId}/assets/${id}`,

  // Sucursales
  branches:          (clienteId: string) => `/api/v1/${clienteId}/branches`,
  branchById:        (clienteId: string, id: string) => `/api/v1/${clienteId}/branches/${id}`,

  // Clientes
  clients:           '/api/v1/clients',
  clientById:        (id: string) => `/api/v1/clients/${id}`,

  // Usuarios — vía generic table GET
  users:             '/api/users',
  technicians:       '/api/users?perfil=tecnico',

  // Audit logs
  auditLogs:         (clienteId: string) => `/api/v1/${clienteId}/audit-logs`,

  // Sincronización bidireccional (push + pull en un solo ciclo)
  sync:              '/api/sync',

  // Lectura directa por tabla (GET only, requiere token)
  tableGet:          (table: string) => `/api/${table}`,
  tableGetSince:     (table: string, since: number) => `/api/${table}?since=${since}`,

  // Exportar documentos
  export:            '/api/export',

  // OCR placa de equipo
  ocr:               '/api/ocr',

  // Health
  health:            '/api/health',
  healthDb:          '/api/health/db',
} as const;
