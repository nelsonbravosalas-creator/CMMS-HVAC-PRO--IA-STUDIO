/**
 * Reglas de negocio CMMS HVAC PRO.
 *
 * Este archivo es la fuente de verdad funcional para escalar módulos, botones,
 * formularios y flujos offline-first. Todo módulo nuevo debe declarar su tabla,
 * permisos, campos obligatorios y comportamiento de sincronización tomando estas
 * reglas como contrato base antes de agregar UI o endpoints.
 */
export const BUSINESS_RULES_VERSION = '2026.05-offline-first-v2';

export const STANDARD_METHOD = {
  id: 'LOCAL_FIRST_SYNC_VERIFICATION',
  name: 'Método estándar offline-first CMMS HVAC PRO',
  objective: 'Toda interacción funcional debe operar primero contra IndexedDB, encolar el cambio y converger hacia Neon mediante Vercel sin bloquear el trabajo del usuario.',
  sequence: [
    'capture_intent',
    'validate_business_rules',
    'persist_local_first',
    'enqueue_sync_operation',
    'push_to_vercel_api',
    'apply_to_neon',
    'pull_server_changes',
    'reconcile_local_state',
    'audit_and_notify'
  ] as const,
  invariant: 'Ningún botón o formulario sincronizable escribe directo a Neon desde el cliente; todo cambio pasa por repositorio local, sync_queue y /api/sync.',
  evidenceRequired: ['uuid_sync', 'operation', 'table', 'updated_at', 'sync_status'] as const
} as const;

export const OFFLINE_FIRST_RULES = {
  sourceOfTruth: 'IndexedDB local primero; Neon actúa como réplica central de convergencia.',
  writePath: 'Toda creación, edición o baja se guarda localmente y se encola antes de llamar a la API.',
  readPath: 'La UI lee desde el store hidratado por IndexedDB; las respuestas remotas se aplican por sincronización.',
  conflictPolicy: 'Last-write-wins por updated_at, con serverTime para avanzar el checkpoint y evitar drift del reloj local.',
  deletePolicy: 'Toda baja funcional se propaga como tombstone con deleted_at; no se deben usar borrados físicos en módulos sincronizados.',
  retryPolicy: 'Las operaciones con error permanecen en sync_queue y aumentan retry_count; solo se remueven si el servidor confirma applied/noop.',
  auditPolicy: 'Las operaciones críticas deben registrar usuario, módulo, uuid_sync, acción, timestamp y resultado cuando exista auditoría disponible.',
  desktopPolicy: 'En escritorio se mantiene el mismo contrato: UI local, cola local, API Vercel y convergencia Neon; no existen atajos directos a la base de datos.'
} as const;

export const INFRASTRUCTURE_RULES = {
  client: {
    storage: 'IndexedDB/Dexie',
    state: 'Zustand hidratado desde repositorios locales',
    networkDetection: 'networkMonitor + evento network-reconnected',
    responsibility: 'Permitir operación offline, persistir intención y mostrar estado pendiente/fallido/sincronizado.'
  },
  vercel: {
    runtime: 'Vercel Serverless Functions',
    syncEndpoint: '/api/sync',
    healthEndpoint: '/api/health/db',
    migrationEndpoint: 'POST /api/health/db o POST /api/health-db',
    responsibility: 'Validar entorno, asegurar schema, aplicar operaciones idempotentes y devolver serverChanges/serverTime.'
  },
  neon: {
    database: 'PostgreSQL Neon',
    requiredEnv: ['DATABASE_URL', 'JWT_SECRET'] as const,
    canonicalTables: ['assets', 'users', 'preventive_maintenance', 'work_orders', 'reports', 'events', 'clients', 'branches'] as const,
    responsibility: 'Persistencia central, trazabilidad con uuid_sync/updated_at/deleted_at y consulta incremental.'
  }
} as const;

export const SYNC_RULES = {
  endpoint: '/api/sync',
  healthEndpoint: '/api/health/db',
  intervalMs: 15_000,
  batchLimit: 1_000,
  allowedStatusesToDequeue: ['applied', 'noop'] as const,
  retainedStatuses: ['error'] as const,
  payloadContract: {
    inserts: 'Operaciones nuevas con table, data, uuid_sync y updated_at.',
    updates: 'Cambios idempotentes con table, data, uuid_sync y updated_at.',
    deletes: 'Bajas lógicas con table, uuid_sync y deleted_at/updated_at.',
    lastSync: 'Checkpoint local recibido desde serverTime anterior.'
  },
  responseContract: {
    results: 'Resultado por operación; solo applied/noop permite retirar de cola.',
    serverChanges: 'Cambios remotos posteriores a lastSync por tabla.',
    serverTime: 'Checkpoint oficial para la siguiente sincronización.'
  }
} as const;

export const BUTTON_WORKFLOW_RULES = {
  create: {
    intent: 'Crear registro operativo.',
    workflow: ['validar formulario', 'crear uuid_sync', 'guardar local pending_insert', 'encolar insert', 'disparar sync'] as const,
    uiState: 'El botón puede operar offline y debe informar guardado local.'
  },
  edit: {
    intent: 'Modificar registro existente.',
    workflow: ['validar cambios', 'actualizar updated_at', 'guardar local pending_update', 'encolar update', 'disparar sync'] as const,
    uiState: 'El botón puede operar offline; si existe conflicto, gana el mayor updated_at.'
  },
  delete: {
    intent: 'Dar de baja/anular/desactivar sin pérdida física inmediata.',
    workflow: ['confirmar impacto', 'set deleted_at', 'guardar local pending_delete', 'encolar delete', 'disparar sync'] as const,
    uiState: 'El botón debe pedir confirmación y mostrar estado pendiente hasta confirmación server.'
  },
  sync: {
    intent: 'Forzar convergencia local ⇄ Neon.',
    workflow: ['leer sync_queue', 'POST /api/sync', 'procesar results', 'aplicar serverChanges', 'actualizar last_sync_timestamp'] as const,
    uiState: 'El botón debe deshabilitarse mientras syncing=true y mostrar conteo pendiente.'
  },
  view: {
    intent: 'Consultar información operativa.',
    workflow: ['leer store local', 'hidratar desde IndexedDB', 'mostrar badge de sync_status cuando aplique'] as const,
    uiState: 'La lectura nunca debe depender de disponibilidad inmediata de Neon.'
  }
} as const;

export const ROLE_RULES = {
  Administrador: {
    canConfigureSystem: true,
    canManageUsers: true,
    canDeleteSyncedRecords: true,
    canRunDbHealth: true,
    canForceImport: true
  },
  Técnico_Líder: {
    canConfigureSystem: false,
    canManageUsers: false,
    canDeleteSyncedRecords: true,
    canRunDbHealth: false,
    canForceImport: false
  },
  Ingeniero_Confiabilidad: {
    canConfigureSystem: false,
    canManageUsers: false,
    canDeleteSyncedRecords: false,
    canRunDbHealth: false,
    canForceImport: false
  },
  Técnico: {
    canConfigureSystem: false,
    canManageUsers: false,
    canDeleteSyncedRecords: false,
    canRunDbHealth: false,
    canForceImport: false
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
      sync: 'Sincronizar activos',
      view: 'Ver activo'
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
      sync: 'Sincronizar OT',
      view: 'Ver OT'
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
      sync: 'Sincronizar mantenimiento',
      view: 'Ver mantenimiento'
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
      sync: 'Sincronizar clientes',
      view: 'Ver cliente'
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
      sync: 'Sincronizar sucursales',
      view: 'Ver sucursal'
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
      sync: 'Sincronizar usuarios',
      view: 'Ver usuario'
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
      sync: 'Sincronizar informes',
      view: 'Ver informe'
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
      sync: 'Sincronizar eventos',
      view: 'Ver evento'
    }
  }
} as const;

export const FORM_RULES = {
  requiredMarker: '*',
  disabledWhenSyncing: 'Los botones destructivos o de cierre deben deshabilitarse durante una sincronización activa.',
  pendingVisualState: 'Toda fila con sync_status distinto de synced debe mostrar estado pendiente o fallido.',
  offlineCreateMessage: 'Guardado localmente. Se sincronizará automáticamente al recuperar conexión.',
  destructiveConfirmation: 'Las bajas deben confirmar impacto operacional antes de encolar deleted_at.',
  validationTiming: 'Validar antes de persistir localmente; nunca encolar datos sin campos requeridos del módulo.',
  accessibility: 'Todo botón debe tener label visible o aria-label equivalente basado en MODULE_RULES.'
} as const;

export const WORKFLOW_CHECKLIST = [
  'Declarar módulo en MODULE_RULES.',
  'Declarar botones usando BUTTON_WORKFLOW_RULES.',
  'Guardar cambios mediante repositorio local.',
  'Encolar operación con syncQueue.',
  'Consumir /api/sync para convergencia.',
  'Verificar /api/health/db después de deploy.',
  'Documentar campos requeridos y permisos antes de publicar UI.'
] as const;

export type BusinessModule = keyof typeof MODULE_RULES;
export type ButtonWorkflow = keyof typeof BUTTON_WORKFLOW_RULES;
