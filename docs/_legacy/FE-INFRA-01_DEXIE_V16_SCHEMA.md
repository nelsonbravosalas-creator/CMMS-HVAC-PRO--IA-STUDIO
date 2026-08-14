> ⚠️ **OBSOLETO — Documento archivado (2026-07-21).**
> Fusionado en [`CMMS_HVAC_PRO_Especificacion_Tecnica.md`](../../CMMS_HVAC_PRO_Especificacion_Tecnica.md), el único documento normativo técnico. Ver [`DOCS_INDEX.md`](../../DOCS_INDEX.md). No usar para desarrollo ni para agentes de IA — se conserva solo por trazabilidad histórica.

# FE-INFRA-01 — EVOLUCIÓN DEL SCHEMA DEXIE + MIGRACIONES
## CMMS HVAC PRO — Specificación Detallada

**Versión:** 1.0  
**Fecha:** 2026-06-13

> **Alineación con el repositorio:** el número v16 del nombre del archivo es histórico. La implementación debe partir de `src/db/database.ts` y usar la siguiente versión incremental disponible. No se creará una base paralela. Se mantienen React 19, Wouter, Zustand y Dexie.

**Estimado:** 3 días  
**Criticidad:** 🔴 BLOQUEANTE (todo depende)  
**Propietario:** Full-stack

---

## OBJETIVO

Evolucionar las tablas requeridas en el schema Dexie actual con:
- ✅ Esquema completo (índices, relaciones, tipos)
- ✅ Migración desde la versión actual hacia la siguiente versión sin pérdida de datos
- ✅ Tipos TypeScript strict (sin `any`)
- ✅ Documentación y ejemplos

**Outcome:** Los desarrolladores del proyecto pueden `import { db } from '@/db'` y usar todas las tablas con autocompletar y type safety.

---

## ESTRUCTURA DE ARCHIVOS

```
src/
  db/
    database.ts            # Schema Dexie actual y migraciones
    migrations.ts          # Migraciones incrementales desde la versión actual
    types.ts               # Tipos TypeScript para cada tabla
    indices.ts             # Índices por tabla (documentación)
    seeders.ts             # Datos de ejemplo/test
    __tests__/
      schema.test.ts       # Unit tests
      migrations.test.ts
```

---

## 1. TIPOS TYPESCRIPT {#types}

**Archivo: `src/db/types.ts`**

```typescript
// Tipos integrados en src/db/database.ts o separados sin duplicar modelos.

export interface BaseEntity {
  uuid_sync: string;  // UUID técnico, inmutable y usado por sync
  id: string;         // Identificador funcional/humano
}

// Toda entidad persistida debe extender BaseEntity.

// ============================================
// MAESTROS (Configuración global)
// ============================================

export interface Cliente extends BaseEntity {
  cliente_id: string;  // UUID
  nombre: string;
  rut: string;         // XX.XXX.XXX-X (único)
  razon_social: string;
  direccion_sede: string;
  telefono: string;
  email: string;
  sitio_web?: string;
  moneda: 'CLP' | 'USD';
  logo_url?: string;   // PNG/SVG blob URL
  estado: 'activo' | 'suspendido' | 'cerrado';
  created_at: Date;
  updated_at: Date;
  updated_by_user_id?: string;
}

export interface Sucursal extends BaseEntity {
  sucursal_id: string;  // UUID
  cliente_id: string;   // FK
  nombre: string;
  codigo: string;       // Ej: "21-STK" (usado en TAG)
  direccion: string;
  ciudad: string;
  region: string;
  telefono?: string;
  email?: string;
  latitud?: number;
  longitud?: number;
  codigo_num: number;   // Correlativo (1, 2, 3...)
  estado: 'activo' | 'cerrado';
  created_at: Date;
  updated_at: Date;
}

export interface CatalogAssetType extends BaseEntity {
  tipo_de_equipo_id: string;  // UUID
  cliente_id: string;          // FK
  nombre: string;              // "Split", "Chiller", "VRF"
  descripcion?: string;
  codigo_num: number;          // Correlativo para TAG
  campos_dinamicos: Record<string, any>;  // JSON de campos por tipo
  categoria: string;           // "HVAC", "Eléctrico", etc.
  es_predefinido: boolean;
  estado: 'activo' | 'archivado';
  created_at: Date;
  updated_at: Date;
}

export interface RefrigeranteCatalogo extends BaseEntity {
  refrigerante_id: string;  // UUID
  nombre: string;           // "R-410A" (único)
  presion_sat_psi: number;
  temp_sat_celsius: number;
  peligro_nivel: 'bajo' | 'medio' | 'alto';
  disponible_chile: boolean;
  creado_en: Date;
}

export interface User extends BaseEntity {
  user_id: string;                    // UUID
  email: string;
  nombre: string;
  rol: 'administrador' | 'supervisor' | 'tecnico' | 'cliente' | 'proveedor';
  estado: 'activo' | 'inactivo' | 'bloqueado';
  jwt_token_hash?: string;            // Hash del JWT actual
  push_subscription?: Record<string, any>;  // Suscripción VAPID
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
}

export interface UserCliente extends BaseEntity {
  user_id: string;
  cliente_id: string;
}

// El administrador es global y puede operar sin cliente activo.
// El PIN y su hash nunca se persisten en Dexie.

// ============================================
// DATOS OPERACIONALES
// ============================================

export interface Equipo extends BaseEntity {
  tag: string;                  // {sucursal_codigo}.{tipo_codigo}.{seq}
  cliente_id: string;           // FK
  sucursal_id: string;          // FK
  tipo_de_equipo_id: string;    // FK
  
  // Identificación
  nombre: string;
  marca?: string;
  modelo?: string;
  serie?: string;               // Único por equipo
  
  // Especificaciones técnicas
  refrigerante_id?: string;     // FK
  capacidad_valor?: number;
  capacidad_unidad: 'BTU' | 'kW' | 'TR';
  voltaje?: string;             // "220V", "380/400V 3x"
  corriente_nominal?: number;   // Amperios
  potencia_kw?: number;
  
  // Campos dinámicos (según tipo_de_equipo_id)
  variables_dinamicas: Record<string, any>;  // JSON
  
  // Ciclo de vida
  fecha_instalacion?: Date;
  vida_util_anos?: number;
  frecuencia_mantenimiento: 'unico' | 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
  
  // Estado & Criticidad
  criticidad: 'redundante' | 'no_critico' | 'critico';
  estado: 'operativo' | 'en_observacion' | 'en_falla' | 'mantenimiento' | 'retirado';
  
  // Ubicación
  ubicacion?: string;
  area?: string;
  region?: string;
  responsable_interno?: string;
  
  // Personalizables por cliente
  costo_compra?: number;
  proveedor?: string;
  garantia_anos?: number;
  
  // Imagen placa
  imagen_placa_url?: string;
  tiene_placa: boolean;
  
  // Auditoría
  created_at: Date;
  updated_at: Date;
  created_by_user_id?: string;
}

export interface WorkOrder extends BaseEntity {
  work_order_id: string;    // UUID
  cliente_id: string;       // FK
  sucursal_id: string;      // FK
  
  // Identificación
  folio?: string;           // INF-{cod_sucursal}.{cod_tipo}-{tag_corr}-{seq}
  folio_temporal?: string;  // Offline: OT-{uuid-corto}
  
  // Tipo & Estado
  tipo: 'preventivo' | 'correctivo' | 'atencion_falla' | 'puesta_en_marcha' | 'inspeccion_tecnica' | 'instalacion_montaje' | 'predictivo';
  estado: 'abierto' | 'en_progreso' | 'completado' | 'firmado' | 'cerrado';
  
  // Contenido
  descripcion?: string;
  tecnico_asignado_user_id?: string;  // FK
  supervisor_user_id?: string;        // FK
  
  // Narrativos (se auto-pueblan vía binding)
  hallazgo?: string;
  diagnostico?: string;
  recomendaciones?: string;
  conclusiones?: string;
  
  // Consumo energético
  consumo_kwh?: number;
  consumo_editado_manually: boolean;
  horas_operacion?: number;
  
  // Control
  version: number;
  created_at: Date;
  updated_at: Date;
  created_by_user_id?: string;
  closed_at?: Date;
}

export interface WorkOrderAsset extends BaseEntity {
  work_order_asset_id: string;  // UUID
  work_order_id: string;         // FK
  cliente_id: string;            // FK
  tag: string;                   // FK (composite)
  
  // Estado por tag
  estado: 'pendiente' | 'en_progreso' | 'completado';
  
  // Referencia a form_instance
  form_instance_id?: string;  // FK (Fase 2)
  
  // Orden dentro de OT
  orden: number;
  
  created_at: Date;
  updated_at: Date;
}

export interface FormInstance extends BaseEntity {
  form_instance_id: string;     // UUID
  work_order_id: string;        // FK
  work_order_asset_id?: string; // FK
  cliente_id: string;           // FK
  tag?: string;                 // Referencia equipo
  
  // Template usado
  form_template_id?: string;
  
  // Datos del formulario
  datos: Record<string, any>;   // JSON con respuestas
  
  // Estado & Firma
  estado: 'borrador' | 'completado' | 'firmado';
  firma_digital?: string;       // PNG data URL (canvas)
  fecha_firma?: Date;
  usuario_firma_user_id?: string;  // Quién firmó
  
  // Auditoría
  created_at: Date;
  updated_at: Date;
}

export interface Ticket extends BaseEntity {
  ticket_id: string;            // UUID
  cliente_id: string;           // FK
  sucursal_id: string;          // FK
  
  // Identificación
  numero_correlativo: number;   // Secuencial por cliente
  titulo: string;
  descripcion: string;
  
  // Clasificación
  tipo: 'correctivo' | 'preventivo' | 'consulta';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  
  // Equipos asociados
  tag?: string;                 // FK equipos (opcional)
  
  // Asignación
  responsable_tecnico_user_id?: string;  // FK
  proveedor_asignado_user_id?: string;   // FK
  
  // Estado
  estado: 'abierto' | 'en_progreso' | 'observado' | 'resuelto' | 'cerrado';
  
  // Auditoría
  creador_user_id: string;      // FK
  created_at: Date;
  updated_at: Date;
  closed_at?: Date;
}

export interface TicketComment extends BaseEntity {
  ticket_comment_id: string;    // UUID
  ticket_id: string;            // FK
  
  // Cambio de estado
  estado_anterior?: 'abierto' | 'en_progreso' | 'observado' | 'resuelto' | 'cerrado';
  estado_nuevo?: 'abierto' | 'en_progreso' | 'observado' | 'resuelto' | 'cerrado';
  
  // Evidencia
  texto?: string;               // Mín 20 caracteres si presente
  foto_url?: string;            // Blob URL
  
  // Auditoría
  creador_user_id: string;      // FK
  created_at: Date;
}

// ============================================
// SINCRONIZACIÓN
// ============================================

export interface SyncQueueItem extends BaseEntity {
  sync_queue_id: string;                      // UUID
  tabla: string;                              // 'work_orders', 'form_instances', etc.
  record_id: string;
  data: Record<string, any>;                  // Copia de datos a subir
  
  status: 'pending' | 'syncing' | 'synced' | 'error' | 'conflicted';
  
  retry_count: number;
  next_retry?: Date;
  last_error?: string;
  
  created_at: Date;
}

export interface AttachmentMetadata extends BaseEntity {
  attachment_id: string;        // UUID
  tabla: string;                // 'work_orders', 'form_instances'
  record_id: string;
  tipo: 'foto' | 'firma';
  filename: string;
  blob?: Blob;                  // Almacenado en IndexedDB
  tamaño_bytes: number;
  created_at: Date;
  synced: boolean;
}

export interface SyncHistory extends BaseEntity {
  sync_history_id: string;      // UUID
  status: 'success' | 'error' | 'partial';
  items_uploaded: number;
  items_downloaded: number;
  timestamp: Date;
  last_error?: string;
}

// ============================================
// CACHÉ & PREFERENCIAS
// ============================================

export interface KPICache extends BaseEntity {
  kpi_cache_id: string;         // UUID
  cliente_id: string;           // FK
  periodo: string;              // "2026-06", "2026-Q2", etc.
  
  mtbf_horas?: number;
  mtbm_horas?: number;
  mtbr_horas?: number;
  disponibilidad_pct?: number;
  consumo_kwh_total?: number;
  
  cached_at: Date;
  expires_at: Date;
}

export interface UserPreferences extends BaseEntity {
  user_preferences_id: string;  // UUID
  user_id: string;              // FK
  
  // UI Preferences
  theme: 'light' | 'dark' | 'cyberpunk';
  language: 'es' | 'en';
  
  // Notifications
  push_enabled: boolean;
  email_alerts: boolean;
  
  // Menu
  menu_order: string[];         // Array de module IDs en orden
  menu_position: 'left' | 'right';
  
  // Otros
  datos: Record<string, any>;   // Extensible
  
  updated_at: Date;
}
```

---

## 2. SCHEMA DEXIE INCREMENTAL {#schema}

**Archivo: `src/db/database.ts`**

```typescript
// src/db/database.ts
import Dexie, { Table } from 'dexie';
import * as T from './types';

export class CMSSHVACDatabase extends Dexie {
  // ============================================
  // MAESTROS
  // ============================================
  
  clientes!: Table<T.Cliente>;
  sucursales!: Table<T.Sucursal>;
  catalog_asset_types!: Table<T.CatalogAssetType>;
  refrigerantes_catalogo!: Table<T.RefrigeranteCatalogo>;
  users!: Table<T.User>;
  
  // ============================================
  // DATOS OPERACIONALES
  // ============================================
  
  equipos!: Table<T.Equipo>;
  work_orders!: Table<T.WorkOrder>;
  work_order_assets!: Table<T.WorkOrderAsset>;
  form_instances!: Table<T.FormInstance>;
  tickets!: Table<T.Ticket>;
  ticket_comments!: Table<T.TicketComment>;
  
  // ============================================
  // SINCRONIZACIÓN
  // ============================================
  
  sync_queue!: Table<T.SyncQueueItem>;
  attachment_metadata!: Table<T.AttachmentMetadata>;
  sync_history!: Table<T.SyncHistory>;
  
  // ============================================
  // CACHÉ & PREFERENCIAS
  // ============================================
  
  kpi_cache!: Table<T.KPICache>;
  user_preferences!: Table<T.UserPreferences>;
  
  constructor() {
    super('cmmsHVACPRO');
    
    this.version(NEXT_SCHEMA_VERSION).stores({
      // ============================================
      // MAESTROS
      // ============================================
      
      // Clientes: buscar por cliente_id, estado
      clientes: 'uuid_sync, id, cliente_id, estado, updated_at',
      
      // Sucursales: buscar por cliente_id, código, estado
      sucursales: 'uuid_sync, id, sucursal_id, [cliente_id+nombre], [cliente_id+codigo], cliente_id, estado',
      
      // Tipos de equipo: buscar por cliente_id, nombre
      catalog_asset_types: 'tipo_de_equipo_id, [cliente_id+nombre], cliente_id, estado',
      
      // Refrigerantes: búsqueda por nombre
      refrigerantes_catalogo: 'refrigerante_id, nombre, disponible_chile',
      
      // Usuarios: búsqueda por email, cliente_id, rol
      users: 'uuid_sync, id, user_id, email, rol, estado',
      user_clientes: 'uuid_sync, id, [user_id+cliente_id], user_id, cliente_id',
      
      // ============================================
      // DATOS OPERACIONALES
      // ============================================
      
      // Equipos: búsqueda por tag (PK), cliente, sucursal, estado, criticidad
      equipos: 'tag, [cliente_id+sucursal_id], [cliente_id+estado], criticidad, updated_at',
      
      // OT: búsqueda por ID, cliente, sucursal, estado, folio, técnico
      work_orders: 'work_order_id, [cliente_id+sucursal_id], [cliente_id+estado], folio, tecnico_asignado_user_id, updated_at',
      
      // Work Order Assets: búsqueda por [OT+TAG] (composite PK), estado
      work_order_assets: '[work_order_id+tag], estado, work_order_id, tag',
      
      // Form Instances: búsqueda por ID, OT, estado
      form_instances: 'form_instance_id, work_order_id, [work_order_id+trabajo_order_asset_id], estado, updated_at',
      
      // Tickets: búsqueda por ID, cliente, sucursal, estado, número_correlativo
      tickets: 'ticket_id, [cliente_id+numero_correlativo], [cliente_id+estado], estado, responsable_tecnico_user_id, updated_at',
      
      // Ticket Comments: búsqueda por ID, ticket, fecha
      ticket_comments: 'ticket_comment_id, ticket_id, created_at',
      
      // ============================================
      // SINCRONIZACIÓN
      // ============================================
      
      // Sync Queue: búsqueda por [tabla+record_id] (composite PK), status, next_retry
      sync_queue: '[tabla+record_id], status, next_retry, created_at',
      
      // Attachment Metadata: búsqueda por ID, record_id, synced
      attachment_metadata: 'attachment_id, record_id, synced, created_at',
      
      // Sync History: búsqueda por fecha
      sync_history: 'sync_history_id, timestamp',
      
      // ============================================
      // CACHÉ & PREFERENCIAS
      // ============================================
      
      // KPI Cache: búsqueda por [cliente_id+periodo], expires_at
      kpi_cache: '[cliente_id+periodo], expires_at',
      
      // User Preferences: búsqueda por user_id
      user_preferences: 'user_preferences_id, user_id'
    });
    
    // Hooks (Fase 2+)
    this.equipos.hook('updating', (changes, key) => {
      // Validar que ciertos campos no se editen
      if (changes.tag !== undefined && changes.tag !== key) {
        throw new Error('Campo tag es inmutable');
      }
    });
    
    this.work_orders.hook('updating', (changes, key) => {
      if (changes.created_at !== undefined) {
        throw new Error('Campo created_at es inmutable');
      }
    });
  }
}

export const db = new CMSSHVACDatabase();
```

---

## 3. ÍNDICES & DOCUMENTACIÓN {#indices}

**Archivo: `src/db/indices.ts`**

```typescript
// src/db/indices.ts
/**
 * Documentación de índices del schema Dexie objetivo
 * 
 * REGLAS:
 * - Índice primario (PK): siempre presente
 * - Índice compuesto [A+B]: búsquedas por ambos campos
 * - Índice simple A: búsquedas por este campo
 * 
 * PERFORMANCE:
 * - < 100k registros: índices mínimos suficientes
 * - > 100k registros: aumentar índices específicos por query
 */

export const INDICES = {
  clientes: {
    pk: 'cliente_id',
    indices: [
      'estado',           // Filter: WHERE estado = 'activo'
      'updated_at'        // Sort: ORDER BY updated_at DESC
    ]
  },
  
  sucursales: {
    pk: 'sucursal_id',
    indices: [
      '[cliente_id+nombre]',  // Uniqueness: sucursal por cliente
      '[cliente_id+codigo]',  // Búsqueda por código
      'cliente_id',           // Filter por cliente
      'estado'
    ]
  },
  
  equipos: {
    pk: 'tag',  // Compuesto: {sucursal_codigo}.{tipo_codigo}.{seq}
    indices: [
      '[cliente_id+sucursal_id]',  // Listar equipos por sucursal
      '[cliente_id+estado]',        // Filtrar activos, con falla
      'criticidad',                 // Equipos críticos
      'updated_at'                  // Sincronización
    ],
    performance_notes: `
      - Query común: db.equipos.where('cliente_id').equals(cid).where('estado').equals('operativo')
      - Dexie optimiza con índice [cliente_id+estado]
      - Sin índice: scan full table (lento > 1k registros)
    `
  },
  
  work_orders: {
    pk: 'work_order_id',
    indices: [
      '[cliente_id+sucursal_id]',      // Listar OT por sucursal
      '[cliente_id+estado]',            // Filtrar por estado
      'folio',                          // Buscar por folio
      'tecnico_asignado_user_id',       // OT asignadas a técnico
      'updated_at'                      // Sincronización
    ],
    performance_notes: `
      - Query: db.work_orders.where('tecnico_asignado_user_id').equals(uid)
      - Índice necesario si > 100 OT por técnico
    `
  },
  
  work_order_assets: {
    pk: '[work_order_id+tag]',  // Composite PK
    indices: [
      'estado',       // Filter: WHERE estado = 'completado'
      'work_order_id', // Buscar assets de una OT
      'tag'           // Equipos en múltiples OT
    ]
  },
  
  form_instances: {
    pk: 'form_instance_id',
    indices: [
      'work_order_id',                    // Obtener formularios de OT
      '[work_order_id+work_order_asset_id]', // Por OT y asset
      'estado',                           // Filtrar completados
      'updated_at'
    ]
  },
  
  tickets: {
    pk: 'ticket_id',
    indices: [
      '[cliente_id+numero_correlativo]',  // Uniqueness
      '[cliente_id+estado]',              // Listar por estado
      'estado',                           // Filtro rápido
      'responsable_tecnico_user_id',      // Asignados a técnico
      'updated_at'
    ]
  },
  
  sync_queue: {
    pk: '[tabla+record_id]',  // Composite PK
    indices: [
      'status',       // Obtener pending items
      'next_retry',   // Reintento exponencial
      'created_at'
    ],
    performance_notes: `
      - Query: db.sync_queue.where('status').equals('pending').and(item => !item.next_retry || item.next_retry <= NOW())
      - Sin índice: scan completo en cada sync (malo si > 1000 items)
    `
  },
  
  kpi_cache: {
    pk: '[cliente_id+periodo]',
    indices: [
      'expires_at'    // Cleanup automático (expirados)
    ]
  }
};
```

---

## 4. MIGRACIONES V15 → V16 {#migrations}

**Archivo: `src/db/migrations.ts`**

```typescript
// src/db/migrations.ts
import { db } from './database';

/**
 * Migración v15 → v16
 * 
 * Cambios:
 * - Tabla work_orders: eliminar asset_id, agregar campos narrativos
 * - Nueva tabla: work_order_assets (relación N-N OT ↔ Equipos)
 * - Nueva tabla: form_instances
 * - Nuevos campos: consumo_kwh, criticidad en equipos
 * 
 * Ejecución automática en primer acceso a db v16
 */

export async function runMigrations() {
  // Obtener versión anterior almacenada
  const currentVersion = localStorage.getItem('db_schema_version') || '15';
  
  if (currentVersion === '15') {
    console.log('Migrando de v15 → v16...');
    
    try {
      // Paso 1: Obtener datos v15
      const workOrdersV15 = await db.work_orders.toArray();
      const equiposV15 = await db.equipos.toArray();
      
      // Paso 2: Transformar datos
      const workOrdersV16 = workOrdersV15.map(wo => ({
        ...wo,
        // Nuevos campos narrativos (vacíos inicialmente)
        hallazgo: null,
        diagnostico: null,
        recomendaciones: null,
        conclusiones: null,
        // Nuevos campos de consumo
        consumo_kwh: null,
        consumo_editado_manually: false,
        horas_operacion: null,
        // Eliminar asset_id (ahora en work_order_assets)
        asset_id: undefined
      }));
      
      const equiposV16 = equiposV15.map(eq => ({
        ...eq,
        // Nuevo campo criticidad
        criticidad: 'no_critico',  // Default
        // Nuevos campos
        consumo_kwh: null,
        variables_dinamicas: eq.variables_dinamicas || {}
      }));
      
      // Paso 3: Crear work_order_assets desde asset_id antiguo
      const workOrderAssets = workOrdersV15
        .filter(wo => wo.asset_id)  // Solo OT con asset_id
        .map((wo, idx) => ({
          work_order_asset_id: generateUUID(),
          work_order_id: wo.work_order_id,
          cliente_id: wo.cliente_id,
          tag: wo.asset_id,  // Asumir que asset_id = tag
          estado: wo.estado === 'cerrado' ? 'completado' : 'pendiente',
          orden: idx + 1,
          created_at: wo.created_at,
          updated_at: wo.updated_at
        }));
      
      // Paso 4: Guardar datos migrados
      await db.work_orders.bulkPut(workOrdersV16);
      await db.equipos.bulkPut(equiposV16);
      await db.work_order_assets.bulkAdd(workOrderAssets);
      
      // Paso 5: Marcar como completada
      localStorage.setItem('db_schema_version', '16');
      console.log('✓ Migración completada');
      
    } catch (error) {
      console.error('✗ Error en migración:', error);
      throw error;
    }
  }
}

// Ejecutar en app startup
export async function initDatabase() {
  await runMigrations();
  console.log('Database v16 ready');
}

function generateUUID(): string {
  return crypto.randomUUID();
}
```

---

## 5. OPERACIONES COMUNES {#operations}

```typescript
// src/db/operations.ts
import { db } from './database';

/**
 * Operaciones CRUD más comunes
 * para referencia durante desarrollo
 */

// ============================================
// CREAR
// ============================================

export async function crearEquipo(data: Omit<Equipo, 'created_at' | 'updated_at' | 'tag'>) {
  const tag = generarTAG(data.sucursal_id, data.tipo_de_equipo_id);
  
  const equipo: Equipo = {
    ...data,
    tag,
    created_at: new Date(),
    updated_at: new Date(),
    criticidad: 'no_critico',
    estado: 'operativo',
    frecuencia_mantenimiento: 'mensual',
    tiene_placa: true
  };
  
  await db.equipos.add(equipo);
  return equipo;
}

export async function crearWorkOrder(data: Omit<WorkOrder, 'created_at' | 'updated_at' | 'folio_temporal' | 'version'>) {
  const folio_temporal = `OT-${generateUUID().substring(0, 8)}`;
  
  const ot: WorkOrder = {
    ...data,
    folio_temporal,
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
    consumo_editado_manually: false
  };
  
  await db.work_orders.add(ot);
  return ot;
}

export async function agregarAssetAWorkOrder(
  work_order_id: string,
  tag: string,
  orden: number
) {
  const asset = {
    work_order_asset_id: generateUUID(),
    work_order_id,
    cliente_id: '',  // Obtener del WO
    tag,
    estado: 'pendiente' as const,
    orden,
    created_at: new Date(),
    updated_at: new Date()
  };
  
  await db.work_order_assets.add(asset);
  return asset;
}

// ============================================
// LEER
// ============================================

export async function obtenerEquipo(tag: string) {
  return db.equipos.get(tag);
}

export async function listarEquiposPorSucursal(cliente_id: string, sucursal_id: string) {
  return db.equipos
    .where('[cliente_id+sucursal_id]')
    .equals([cliente_id, sucursal_id])
    .toArray();
}

export async function listarEquiposOperativos(cliente_id: string) {
  return db.equipos
    .where('[cliente_id+estado]')
    .equals([cliente_id, 'operativo'])
    .toArray();
}

export async function obtenerWorkOrder(work_order_id: string) {
  return db.work_orders.get(work_order_id);
}

export async function listarAssetsDeWorkOrder(work_order_id: string) {
  return db.work_order_assets
    .where('work_order_id')
    .equals(work_order_id)
    .toArray();
}

// ============================================
// ACTUALIZAR
// ============================================

export async function actualizarEquipoEstado(
  tag: string,
  nuevoEstado: 'operativo' | 'en_observacion' | 'en_falla' | 'mantenimiento' | 'retirado'
) {
  await db.equipos.update(tag, {
    estado: nuevoEstado,
    updated_at: new Date()
  });
}

export async function marcarWorkOrderAssetCompletado(
  work_order_id: string,
  tag: string
) {
  await db.work_order_assets.update(
    [work_order_id, tag],
    {
      estado: 'completado',
      updated_at: new Date()
    }
  );
}

// ============================================
// SINCRONIZACIÓN
// ============================================

export async function agregarAQueueSync(
  tabla: string,
  record_id: string,
  data: Record<string, any>
) {
  const item = {
    sync_queue_id: generateUUID(),
    tabla,
    record_id,
    data,
    status: 'pending' as const,
    retry_count: 0,
    created_at: new Date()
  };
  
  await db.sync_queue.add(item);
  return item;
}

export async function obtenerItemsParaSincronizar() {
  return db.sync_queue
    .where('status')
    .equals('pending')
    .toArray();
}

function generateUUID(): string {
  return crypto.randomUUID();
}

function generarTAG(sucursal_id: string, tipo_id: string): string {
  // Implementar lógica de TAG
  return `TAG-${sucursal_id}-${tipo_id}`;
}
```

---

## 6. TESTS UNITARIOS {#tests}

**Archivo: `src/db/__tests__/schema.test.ts`**

```typescript
// src/db/__tests__/schema.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database';

describe('Schema Dexie incremental', () => {
  
  beforeEach(async () => {
    // Limpiar DB antes de cada test
    await db.delete();
    await db.open();
  });
  
  afterEach(async () => {
    await db.close();
  });
  
  // ============================================
  // TESTS EQUIPOS
  // ============================================
  
  it('debe crear un equipo con TAG único', async () => {
    const equipo = {
      tag: '21-STK.AC.001',
      cliente_id: 'cli-001',
      sucursal_id: 'suc-001',
      tipo_de_equipo_id: 'split',
      nombre: 'Aire Split 12000 BTU',
      marca: 'ANWO',
      modelo: 'GES12E',
      capacidad_valor: 12000,
      capacidad_unidad: 'BTU' as const,
      variables_dinamicas: {},
      criticidad: 'no_critico' as const,
      estado: 'operativo' as const,
      frecuencia_mantenimiento: 'mensual' as const,
      tiene_placa: true,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await db.equipos.add(equipo);
    const stored = await db.equipos.get('21-STK.AC.001');
    
    expect(stored).toBeDefined();
    expect(stored?.nombre).toBe('Aire Split 12000 BTU');
  });
  
  it('debe impedir duplicar TAG', async () => {
    const equipo = {
      tag: '21-STK.AC.001',
      cliente_id: 'cli-001',
      sucursal_id: 'suc-001',
      tipo_de_equipo_id: 'split',
      nombre: 'Equipo 1',
      variables_dinamicas: {},
      criticidad: 'no_critico' as const,
      estado: 'operativo' as const,
      frecuencia_mantenimiento: 'mensual' as const,
      tiene_placa: true,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await db.equipos.add(equipo);
    
    // Intentar duplicado
    await expect(db.equipos.add(equipo))
      .rejects
      .toThrow();  // Dexie lanza error
  });
  
  it('debe listar equipos por sucursal eficientemente', async () => {
    // Agregar 100 equipos
    const equipos = Array.from({ length: 100 }, (_, i) => ({
      tag: `21-STK.AC.${String(i + 1).padStart(3, '0')}`,
      cliente_id: 'cli-001',
      sucursal_id: 'suc-001',
      tipo_de_equipo_id: 'split',
      nombre: `Equipo ${i + 1}`,
      variables_dinamicas: {},
      criticidad: 'no_critico' as const,
      estado: 'operativo' as const,
      frecuencia_mantenimiento: 'mensual' as const,
      tiene_placa: true,
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    await db.equipos.bulkAdd(equipos);
    
    // Búsqueda por índice (rápida)
    const resultado = await db.equipos
      .where('[cliente_id+sucursal_id]')
      .equals(['cli-001', 'suc-001'])
      .toArray();
    
    expect(resultado).toHaveLength(100);
  });
  
  // ============================================
  // TESTS WORK ORDERS
  // ============================================
  
  it('debe crear WorkOrder con assets', async () => {
    const ot = {
      work_order_id: 'ot-001',
      cliente_id: 'cli-001',
      sucursal_id: 'suc-001',
      folio_temporal: 'OT-abc123',
      tipo: 'preventivo' as const,
      estado: 'abierto' as const,
      descripcion: 'Mantenimiento mensual',
      version: 1,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await db.work_orders.add(ot);
    
    // Agregar asset
    const asset = {
      work_order_asset_id: 'woa-001',
      work_order_id: 'ot-001',
      cliente_id: 'cli-001',
      tag: '21-STK.AC.001',
      estado: 'pendiente' as const,
      orden: 1,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await db.work_order_assets.add(asset);
    
    // Verificar
    const stored = await db.work_order_assets
      .where('work_order_id')
      .equals('ot-001')
      .toArray();
    
    expect(stored).toHaveLength(1);
    expect(stored[0].tag).toBe('21-STK.AC.001');
  });
  
  // ============================================
  // TESTS SYNC QUEUE
  // ============================================
  
  it('debe agregar item a queue y marcar como pendiente', async () => {
    const item = {
      sync_queue_id: 'sq-001',
      tabla: 'work_orders',
      record_id: 'ot-001',
      data: { tipo: 'preventivo' },
      status: 'pending' as const,
      retry_count: 0,
      created_at: new Date()
    };
    
    await db.sync_queue.add(item);
    
    const pending = await db.sync_queue
      .where('status')
      .equals('pending')
      .toArray();
    
    expect(pending).toHaveLength(1);
  });
});
```

---

## 7. CHECKLIST DE IMPLEMENTACIÓN {#checklist}

- [ ] **Paso 1:** Crear archivo `src/db/types.ts` con todas las interfaces
- [ ] **Paso 2:** Extender `src/db/database.ts` con la siguiente migración incremental
- [ ] **Paso 3:** Crear archivo `src/db/indices.ts` documentación de índices
- [ ] **Paso 4:** Crear archivo `src/db/migrations.ts` con lógica v15→v16
- [ ] **Paso 5:** Crear archivo `src/db/operations.ts` con CRUD comunes
- [ ] **Paso 6:** Crear tests en `src/db/__tests__/schema.test.ts`
- [ ] **Paso 7:** Exportar DB desde `src/db/index.ts`
- [ ] **Paso 8:** Validar tipos TypeScript (no `any`)
- [ ] **Paso 9:** Correr tests (npm run test:db)
- [ ] **Paso 10:** Documentar en README

---

## 8. PRÓXIMO PASO

Una vez completado FE-INFRA-01, el proyecto puede:

✅ Importar `import { db } from '@/db'` en cualquier componente  
✅ Usar DB con type safety completo (autocompletar, type checking)  
✅ Proceder con FE-SYNC-01 (Queue Manager) en paralelo a FE-INFRA-02

---

**¿Comenzamos con Paso 1 (types.ts)?**

