/**
 * Reglas de negocio CMMS HVAC PRO.
 *
 * Este archivo es la fuente de verdad funcional para escalar módulos, botones,
 * formularios y flujos offline-first. Todo módulo nuevo debe declarar su tabla,
 * permisos, campos obligatorios y comportamiento de sincronización tomando estas
 * reglas como contrato base antes de agregar UI o endpoints.
 */
export const BUSINESS_RULES_VERSION = '2026.05-offline-first-v1';

export const OFFLINE_FIRST_RULES = {
  sourceOfTruth: 'IndexedDB local primero; Neon actúa como réplica central de convergencia.',
  writePath: 'Toda creación, edición o baja se guarda localmente y se encola antes de llamar a la API.',
  readPath: 'La UI lee desde el store hidratado por IndexedDB; las respuestas remotas se aplican por sincronización.',
  conflictPolicy: 'Last-write-wins por updated_at, con serverTime para avanzar el checkpoint y evitar drift del reloj local.',
  deletePolicy: 'Toda baja funcional se propaga como tombstone con deleted_at; no se deben usar borrados físicos en módulos sincronizados.',
  retryPolicy: 'Las operaciones con error permanecen en sync_queue y aumentan retry_count; solo se remueven si el servidor confirma applied/noop.',
  auditPolicy: 'Las operaciones críticas deben registrar usuario, módulo, uuid_sync, acción, timestamp y resultado cuando exista auditoría disponible.'
} as const;

export const SYNC_RULES = {
  endpoint: '/api/sync',
  healthEndpoint: '/api/health/db',
  intervalMs: 15_000,
  batchLimit: 1_000,
  allowedStatusesToDequeue: ['applied', 'noop'] as const,
  retainedStatuses: ['error'] as const
} as const;

export const ROLE_RULES = {
  Administrador: {
    canConfigureSystem: true,
    canManageUsers: true,
    canDeleteSyncedRecords: true
  },
  Técnico_Líder: {
    canConfigureSystem: false,
    canManageUsers: false,
    canDeleteSyncedRecords: true
  },
  Ingeniero_Confiabilidad: {
    canConfigureSystem: false,
    canManageUsers: false,
    canDeleteSyncedRecords: false
  },
  Técnico: {
    canConfigureSystem: false,
    canManageUsers: false,
    canDeleteSyncedRecords: false
  }
} as const;

export const MODULE_RULES = {
  assets: {
    label: 'Activos HVAC',
    table: 'assets',
    primaryIdentifier: 'uuid_sync',
    businessIdentifier: 'tag',
    requiredFields: ['tag', 'nombre', 'estado'] as const,
    searchableFields: ['tag', 'nombre', 'marca', 'modelo', 'serie', 'ubicacion'] as const,
    allowedStates: ['operativo', 'falla', 'mantenimiento', 'baja'] as const,
    buttons: {
      create: 'Crear activo',
      edit: 'Editar activo',
      delete: 'Dar de baja',
      sync: 'Sincronizar activos'
    }
  },
  work_orders: {
    label: 'Órdenes de trabajo',
    table: 'work_orders',
    primaryIdentifier: 'uuid_sync',
    businessIdentifier: 'id',
    requiredFields: ['titulo', 'prioridad', 'estado', 'equipo_tag'] as const,
    allowedStates: ['abierta', 'asignada', 'en_progreso', 'cerrada', 'cancelada'] as const,
    buttons: {
      create: 'Crear OT',
      edit: 'Actualizar OT',
      delete: 'Anular OT',
      sync: 'Sincronizar OT'
    }
  },
  preventive_maintenance: {
    label: 'Mantenimiento preventivo',
    table: 'preventive_maintenance',
    primaryIdentifier: 'uuid_sync',
    businessIdentifier: 'id',
    requiredFields: ['equipo_tag', 'tecnico', 'tipo', 'fecha', 'estado'] as const,
    allowedStates: ['programado', 'en_progreso', 'ejecutado', 'vencido', 'cancelado'] as const,
    buttons: {
      create: 'Programar mantenimiento',
      edit: 'Actualizar mantenimiento',
      delete: 'Cancelar mantenimiento',
      sync: 'Sincronizar mantenimiento'
    }
  },
  clients: {
    label: 'Clientes',
    table: 'clients',
    primaryIdentifier: 'uuid_sync',
    businessIdentifier: 'id',
    requiredFields: ['nombre'] as const,
    buttons: {
      create: 'Crear cliente',
      edit: 'Editar cliente',
      delete: 'Desactivar cliente',
      sync: 'Sincronizar clientes'
    }
  },
  branches: {
    label: 'Sucursales',
    table: 'branches',
    primaryIdentifier: 'uuid_sync',
    businessIdentifier: 'id',
    requiredFields: ['nombre', 'cliente_id'] as const,
    buttons: {
      create: 'Crear sucursal',
      edit: 'Editar sucursal',
      delete: 'Desactivar sucursal',
      sync: 'Sincronizar sucursales'
    }
  },
  users: {
    label: 'Usuarios',
    table: 'users',
    primaryIdentifier: 'uuid_sync',
    businessIdentifier: 'id',
    requiredFields: ['nombre', 'perfil', 'pin', 'activo'] as const,
    buttons: {
      create: 'Crear usuario',
      edit: 'Editar usuario',
      delete: 'Desactivar usuario',
      sync: 'Sincronizar usuarios'
    }
  },
  reports: {
    label: 'Informes',
    table: 'reports',
    primaryIdentifier: 'uuid_sync',
    businessIdentifier: 'id',
    requiredFields: ['id', 'data'] as const,
    buttons: {
      create: 'Crear informe',
      edit: 'Editar informe',
      delete: 'Anular informe',
      sync: 'Sincronizar informes'
    }
  },
  events: {
    label: 'Eventos',
    table: 'events',
    primaryIdentifier: 'uuid_sync',
    businessIdentifier: 'id',
    requiredFields: ['id', 'data'] as const,
    buttons: {
      create: 'Crear evento',
      edit: 'Editar evento',
      delete: 'Anular evento',
      sync: 'Sincronizar eventos'
    }
  }
} as const;

export const FORM_RULES = {
  requiredMarker: '*',
  disabledWhenSyncing: 'Los botones destructivos o de cierre deben deshabilitarse durante una sincronización activa.',
  pendingVisualState: 'Toda fila con sync_status distinto de synced debe mostrar estado pendiente o fallido.',
  offlineCreateMessage: 'Guardado localmente. Se sincronizará automáticamente al recuperar conexión.',
  destructiveConfirmation: 'Las bajas deben confirmar impacto operacional antes de encolar deleted_at.'
} as const;

export type BusinessModule = keyof typeof MODULE_RULES;
