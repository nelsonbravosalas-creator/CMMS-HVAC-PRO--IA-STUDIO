# FASE 2 — PLAN DE IMPLEMENTACIÓN FRONTEND
## CMMS HVAC PRO — Sistema de Gestión de Mantenimiento

> **Plan vivo, no normativo.** El contenido técnico normativo (arquitectura, sync engine, modelo de datos, contratos) fue extraído y consolidado en [`CMMS_HVAC_PRO_Especificacion_Tecnica.md`](CMMS_HVAC_PRO_Especificacion_Tecnica.md) — ante cualquier conflicto, ese documento prevalece. Este plan conserva el seguimiento de sprints, estimaciones y checklist de desarrollo. Ver [`DOCS_INDEX.md`](DOCS_INDEX.md).

**Versión:** 1.1  
**Fecha:** 2026-06-14  
**Duración Estimada:** 39 días  
**Paralela con:** Fase 3 Backend  
**Estado:** 🟡 EN CONSOLIDACIÓN — adaptación al repositorio actual

> **Línea tecnológica obligatoria:** este plan se adapta al repositorio actual y no autoriza una segunda arquitectura. Se mantienen React 19, Wouter, Zustand, Dexie, Express y PostgreSQL/Neon. Las rutas o archivos de otro repositorio son referencias históricas y no se consideran entregables completados aquí.

---

## RESUMEN EJECUTIVO

Fase 2 implementa la capa frontend del CMMS HVAC PRO con enfoque **offline-first PWA**, sincronización en tiempo real y UX optimizada para técnicos en terreno.

**Artifacts principales:**
- 🔄 Evolución incremental del schema Dexie existente
- ⬜ Binding engine (auto-cálculos narrativos OT)
- ⬜ Form renderer dinámico (checklist por tipo equipo)
- ⬜ OT multi-tag workflow
- ⬜ Dashboards (OT Progress, Indicadores, Equipo)
- ⬜ Web Push notifications
- ⬜ Sync engine (pull/merge/conflict-resolution)
- ✅ Componentes UI base mobile-first en el Layout actual

---

## PROGRESO ACTUAL — 2026-06-14

### 🔄 SPRINT 1 — BASE EXISTENTE EN CONSOLIDACIÓN

| Base | Archivo actual | Estado |
|------|----------------|--------|
| Schema Dexie | `src/db/database.ts` | 🔄 Requiere migraciones incrementales |
| Tipos TypeScript | `src/db/database.ts`, `src/types.ts` | 🔄 En consolidación |
| Autenticación | `src/context/AuthContext.tsx`, `api/auth.ts`, `server.ts` | 🔄 Migrar PIN a Argon2id server-only |
| Router | Wouter en `src/App.tsx` | ✅ Línea tecnológica confirmada |
| Estado global | Zustand en `src/store/useAppStore.ts` | ✅ |
| Layout | `src/components/Layout.tsx` | ✅ |
| Login | `src/pages/Login.tsx` | 🔄 Debe ser exclusivamente online |
| Build | Vite + Express | ✅ |

**Pendiente Sprint 1:**
- [ ] `VITE_API_URL` configurar en Vercel → Settings → Env Vars (necesita URL backend real)

---

### 🔵 SPRINT 2 — PRÓXIMO (OT + Checklist)

**Objetivo:** Técnico puede ver OTs reales, abrir un checklist, llenarlo y auto-guardarlo.

| Item | Descripción | Prioridad |
|------|-------------|-----------|
| `useOTs` hook | TanStack Query → Dexie → OTs reales | 🔴 |
| OTDetailPage | Detalle OT con lista de tags/activos | 🔴 |
| FieldRenderer | text, number, select, boolean, medicion | 🔴 |
| FormInstancePage | Llenar checklist por tag | 🔴 |
| Auto-save checklist | Guardar cada cambio en Dexie | 🔴 |
| SyncStatusBadge | Indicador online/offline | 🟡 |

---

### 🔵 SPRINT 3 — FIRMA + ADMIN (después de Sprint 2)

| Item | Descripción | Prioridad |
|------|-------------|-----------|
| SignaturePad | Canvas → PNG, touch + mouse | 🔴 |
| PhotoCapture | Cámara trasera mobile | 🔴 |
| Validación cierre OT | Todos los tags completado/omitido | 🔴 |
| CRUD Sucursales | Admin panel | 🟡 |
| CRUD Tipos de Equipo | Con campos dinámicos JSON | 🟡 |
| CRUD Equipos | Con auto-TAG generation | 🔴 |
| CRUD Usuarios | Con roles y cliente_id | 🟡 |

---

### 🔵 SPRINT 4-6 — PENDIENTES

| Sprint | Enfoque |
|--------|---------|
| Sprint 4 | Sync engine offline (queue + pull/push + LWW) |
| Sprint 5 | Dashboards reales (KPIs, MTBF, calendario) |
| Sprint 6 | PWA (Service Worker, manifest, push notifications) |

---

## TABLA DE CONTENIDOS

1. [Mapa de Módulos](#módulos)
2. [Itemizado por Tema](#itemizado)
3. [Flujos de Datos](#flujos)
4. [Dependencias entre Módulos](#dependencias)
5. [Timeline & Milestones](#timeline)
6. [Estimados de Esfuerzo](#estimados)
7. [Checklist DoD (Definition of Done)](#dod)

---

## 1. MAPA DE MÓDULOS {#módulos}

```
FRONTEND PHASE 2
│
├── 📦 INFRAESTRUCTURA
│   ├── Schema Dexie incremental
│   ├── IndexedDB Migrations
│   ├── Storage Blobs (Fotos, Firmas)
│   └── Caché Layer (KPI, Usuarios)
│
├── 🔄 SINCRONIZACIÓN
│   ├── Service Worker (offline-first)
│   ├── Sync Queue Manager
│   ├── LWW Conflict Resolution
│   ├── Push Notifications Handler
│   └── Retry Logic (exponencial)
│
├── 📋 FORMULARIOS DINÁMICOS
│   ├── form_templates Viewer
│   ├── FieldRenderer (texto, número, select, firma, foto)
│   ├── form_instances Creator
│   ├── Validación client-side
│   └── Binding engine (auto-narrativos OT)
│
├── 📝 ÓRDENES DE TRABAJO
│   ├── OTForm (crear, editar)
│   ├── TagAssignment (multi-tag workflow)
│   ├── OTProgressDashboard (estado por tag)
│   ├── Informe HVAC Viewer
│   └── Firma Digital & Foto
│
├── 🎨 DASHBOARDS & REPORTES
│   ├── Dashboard Principal (KPI cards)
│   ├── OT Progress Dashboard (gráfico estado)
│   ├── Equipos Ficha Técnica
│   ├── Calendario Planificación
│   ├── Mapa de Sucursales/Equipos
│   └── Indicadores (MTBF, MTBM, Consumo)
│
├── 🔐 CONTROL DE ACCESO
│   ├── AuthContext (sesión online; PIN server-only)
│   ├── Permiso Middleware
│   ├── Role-based UI rendering
│   └── Tenant Isolation
│
├── 🎨 COMPONENTES UI
│   ├── Theme System (light, dark, cyberpunk)
│   ├── Form Controls (input, select, datepicker)
│   ├── Cards & Modals
│   ├── Toast Notifications
│   ├── Mobile Layout Responsive
│   └── Menú Customizable (drag-to-reorder)
│
└── 📱 PWA & OFFLINE
    ├── Service Worker (fetch interception)
    ├── Manifest.json (PWA config)
    ├── Install Prompt
    ├── Offline Badge
    └── Sync Status Indicator
```

---

## 2. ITEMIZADO POR TEMA {#itemizado}

### 2.1 INFRAESTRUCTURA (8 items)

#### **FE-INFRA-01: Evolución del Schema Dexie + Migraciones**

**Descripción:** evolucionar el schema Dexie existente mediante la siguiente versión disponible, sin crear una base paralela ni asumir numeraciones heredadas de otro repositorio.

**Entregables:**
```
src/
  db/
database.ts            # Schema Dexie existente y migraciones
    migrations.ts          # v15→v16 migration logic
    types.ts               # Tipos TS para cada tabla
    indices.ts             # Índices para performance
```

**Detalles:**
```typescript
// src/db/database.ts
export const db = new Dexie('cmmsHVACPRO');

db.version(16).stores({
  // Maestros
  clientes: '++id, cliente_id',
  sucursales: '++id, cliente_id, sucursal_id',
  catalog_asset_types: '++id, tipo_de_equipo_id',
  refrigerantes_catalogo: '++id, nombre',
  users: 'user_id, cliente_id, email',
  
  // Datos
  equipos: 'tag, cliente_id, sucursal_id, estado, criticidad',
  work_orders: 'work_order_id, cliente_id, sucursal_id, estado, folio',
  work_order_assets: '[work_order_id+tag], estado',
  form_instances: 'form_instance_id, work_order_id, estado',
  tickets: 'ticket_id, cliente_id, estado, numero_correlativo',
  ticket_comments: 'ticket_comment_id, ticket_id',
  
  // Sync
  sync_queue: '[tabla+record_id], status, created_at',
  attachment_metadata: 'attachment_id, record_id',
  sync_history: '++id, timestamp, status',
  
  // Caché
  kpi_cache: 'cliente_id, periodo',
  user_preferences: 'user_id'
});
```

**Criterio de Aceptación:**
- ✅ Todas 18 tablas definidas con tipos TS
- ✅ Índices optimizados (no scan full-table)
- ✅ Migration v15→v16 sin data loss
- ✅ Tests: crear/leer/actualizar cada tabla
- ✅ TypeScript strict mode sin errores

**Estimado:** 3 días  
**Criticidad:** 🔴 BLOQUEANTE (todo depende)  
**Propietario:** Full-stack  

---

#### **FE-INFRA-02: IndexedDB Blob Storage (Fotos & Firmas)**

**Descripción:** Almacenamiento de archivos locales (fotos de equipos, firmas digitales canvas)

**Entregables:**
```
src/
  lib/
    storage/
      blobStore.ts        # Upload/download blobs
      imageOptimizer.ts   # Comprimir fotos
      signatureToBlob.ts  # Canvas → PNG
```

**Detalles:**

```typescript
// src/lib/storage/blobStore.ts
export async function guardarBlob(
  tabla: string,
  record_id: string,
  tipo: 'foto' | 'firma',
  blob: Blob
): Promise<string> {
  // Generar filename
  const filename = `${tabla}_${record_id}_${tipo}_${Date.now()}.${tipo === 'firma' ? 'png' : 'jpg'}`;
  
  // Almacenar en IndexedDB + blob store
  const attachment = {
    attachment_id: generateUUID(),
    tabla,
    record_id,
    tipo,
    filename,
    blob,
    tamaño_bytes: blob.size,
    created_at: new Date(),
    synced: false
  };
  
  await db.attachment_metadata.put(attachment);
  
  // Generar URL local blob:// para preview
  const localUrl = URL.createObjectURL(blob);
  return localUrl;
}

export async function obtenerBlob(attachment_id: string): Promise<Blob> {
  const attachment = await db.attachment_metadata.get(attachment_id);
  return attachment?.blob;
}
```

**Criterio de Aceptación:**
- ✅ Fotos se comprimen a máx 2 MB (sin degradación visible)
- ✅ Firma canvas → PNG funciona en todos navegadores
- ✅ URLs blob:// válidas para preview
- ✅ Sincronización sube blobs a Object Storage backend
- ✅ Storage local no excede límite IndexedDB (50 MB)

**Estimado:** 2 días  
**Criticidad:** 🟡 IMPORTANTE (fotos en OT)  
**Propietario:** Frontend  

---

#### **FE-INFRA-03: Caché Layer (KPI, Usuarios, Equipos)**

**Descripción:** Capa de caché en memoria + localStorage para datos que no cambian frecuentemente

**Entregables:**
```
src/
  lib/
    cache/
      cacheManager.ts     # TTL, invalidación, hit rate
      kpiCache.ts         # MTBF, MTBM, etc. (refresh diario)
      userCache.ts        # Usuarios + permisos
```

**Detalles:**

```typescript
// src/lib/cache/cacheManager.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl_seconds: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  
  get<T>(key: string, fetcher: () => Promise<T>, ttl = 3600): Promise<T> {
    const entry = this.cache.get(key);
    
    if (entry && !this.isExpired(entry)) {
      console.log(`✓ Cache hit: ${key}`);
      return Promise.resolve(entry.data);
    }
    
    console.log(`Cache miss: ${key}. Fetching...`);
    return fetcher().then(data => {
      this.cache.set(key, { data, timestamp: Date.now(), ttl_seconds: ttl });
      return data;
    });
  }
  
  invalidate(pattern: string) {
    // Invalidar todas las claves matching pattern
    // Ej: invalidate('kpi:*') → limpia todos los KPI
    for (const [key] of this.cache) {
      if (key.match(new RegExp(pattern))) {
        this.cache.delete(key);
      }
    }
  }
  
  private isExpired(entry: CacheEntry<any>): boolean {
    return (Date.now() - entry.timestamp) > (entry.ttl_seconds * 1000);
  }
}

export const cacheManager = new CacheManager();
```

**Criterio de Aceptación:**
- ✅ Cache hit rate > 80% para equipos/usuarios
- ✅ TTL configurable por tipo de dato
- ✅ Invalidación automática en eventos (crear equipo, etc.)
- ✅ localStorage para persistencia entre sesiones (opcional)
- ✅ DevTools muestra stats (hit/miss ratio)

**Estimado:** 2 días  
**Criticidad:** 🟢 OPTIMIZACIÓN  
**Propietario:** Frontend  

---

#### **FE-INFRA-04: TypeScript Types & Interfaces**

**Descripción:** Tipos completos para todas las entidades (no usar `any`)

**Entregables:**
```
src/
  types/
    entities.ts        # Cliente, Sucursal, Equipo, OT, Ticket, etc.
    api.ts             # Requests/Responses
    sync.ts            # Sync queue, conflictos
    ui.ts              # Props, estado local
```

**Estimado:** 2 días  
**Criticidad:** 🟢 CALIDAD  
**Propietario:** Frontend  

---

#### **FE-INFRA-05: AuthContext + Sesión Online + PIN Server-only**

**Descripción:** Context global para autenticación online y manejo de sesión. El PIN se valida exclusivamente en el servidor con Argon2id.

**Entregables:**
```
src/
  context/
    AuthContext.tsx     # useAuth hook
    authUtils.ts        # Token decode y validación de sesión
```

**Criterio de Aceptación:**
- JWT válido con expiración y renovación controlada
- PIN y hash nunca se almacenan en IndexedDB ni localStorage
- Inicio de sesión exclusivamente online
- Logout limpia contexto y tokens
- ✅ Protección contra XSS (no guardar JWT en localStorage, usar httpOnly cookie)

**Estimado:** 2 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Full-stack (coordinar con backend)  

---

#### **FE-INFRA-06: Service Worker Setup**

**Descripción:** Configuración inicial Service Worker para offline + push

**Entregables:**
```
public/
  service-worker.js     # Fetch interception, cache-first
src/
  lib/
    serviceWorker/
      register.ts       # SW registration
      handlers.ts       # Fetch, push, sync events
```

**Estimado:** 2 días  
**Criticidad:** 🔴 BLOQUEANTE (offline)  
**Propietario:** Frontend  

---

#### **FE-INFRA-07: Error Boundary & Logging**

**Descripción:** Global error handler, logging remoto para debugging

**Entregables:**
```
src/
  components/
    ErrorBoundary.tsx   # Catch React errors
  lib/
    logging/
      logger.ts         # Log remote + local
      errorReporter.ts  # Enviar errores a backend
```

**Estimado:** 1 día  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-INFRA-08: Environment Config & Build Optimization**

**Descripción:** Vite config, lazy loading, code splitting

**Entregables:**
```
vite.config.ts          # Optimizaciones bundle
.env.example            # Variables de entorno
webpack/config.prod.ts  # Production build settings
```

**Estimado:** 1 día  
**Criticidad:** 🟢 OPTIMIZACIÓN  
**Propietario:** DevOps  

---

### 2.2 SINCRONIZACIÓN (8 items)

#### **FE-SYNC-01: Sync Queue Manager**

**Descripción:** Cola automática de pendientes (crear, actualizar, sincronizar)

**Entregables:**
```
src/
  lib/
    sync/
      queueManager.ts    # Add, remove, get status
      queueUi.tsx        # Componente para ver estado
```

**Detalles:**

```typescript
// src/lib/sync/queueManager.ts
export class SyncQueueManager {
  async addToQueue(tabla: string, record_id: string, data: any) {
    const item = {
      sync_queue_id: generateUUID(),
      tabla,
      record_id,
      data,
      status: 'pending',
      retry_count: 0,
      created_at: new Date()
    };
    
    await db.sync_queue.put(item);
    await this.scheduleSyncIfOnline();
  }
  
  async processQueue() {
    const pending = await db.sync_queue
      .where('status').equals('pending')
      .toArray();
    
    for (const item of pending) {
      await this.uploadItem(item);
    }
  }
  
  private async uploadItem(item: any) {
    // Implementado en FE-SYNC-02 (Sync Engine)
  }
}
```

**Criterio de Aceptación:**
- ✅ Items se agregan a queue offline
- ✅ Status visible en UI (badge, ícono)
- ✅ Retry automático cuando conexión vuelve
- ✅ Max 1000 items en queue (warning si excede)

**Estimado:** 3 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Full-stack  

---

#### **FE-SYNC-02: Sync Engine (Pull/Push/Merge)**

**Descripción:** Motor de sincronización: upload local → servidor, download cambios, merge

**Entregables:**
```
src/
  lib/
    sync/
      syncEngine.ts      # Main pull/push/merge logic
      conflictResolver.ts # LWW resolution
```

**Pseudocódigo:**

```typescript
// src/lib/sync/syncEngine.ts
export async function runFullSync(user_id: string) {
  console.log('📡 Iniciando sincronización...');
  
  try {
    // PASO 1: UPLOAD (local → servidor)
    console.log('↑ Subiendo datos locales...');
    await uploadPendingChanges();
    
    // PASO 2: DOWNLOAD (servidor → local)
    console.log('↓ Descargando cambios del servidor...');
    const updates = await downloadRemoteChanges();
    
    // PASO 3: MERGE (resolver conflictos)
    console.log('⚙️ Mergeando cambios...');
    await mergeChanges(updates);
    
    console.log('✓ Sincronización completada');
    showNotification('✓ Sincronización exitosa', 'success');
    
  } catch (error) {
    console.error('Sync failed:', error);
    // Reintento exponencial (visto en FE-SYNC-04)
  }
}

async function uploadPendingChanges() {
  const items = await db.sync_queue
    .where('status').equals('pending')
    .toArray();
  
  for (const item of items) {
    try {
      const response = await fetch(
        `/api/sync/upload/${item.tabla}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(item.data)
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        // Actualizar record con datos del servidor (folio, id oficial, etc.)
        await db[item.tabla].update(item.record_id, {
          server_id: result.id,
          folio: result.folio,
          synced: true
        });
        
        // Marcar como synced
        await db.sync_queue.update(item.sync_queue_id, {
          status: 'synced'
        });
      } else if (response.status === 409) {
        // Conflicto → LWW resolver (FE-SYNC-03)
        const conflict = await response.json();
        await resolveConflict(item, conflict);
      }
    } catch (err) {
      // Reintento exponencial (FE-SYNC-04)
      item.retry_count++;
      item.next_retry = scheduleNextRetry(item.retry_count);
      await db.sync_queue.update(item.sync_queue_id, item);
    }
  }
}

async function downloadRemoteChanges() {
  const since = localStorage.getItem('last_sync_timestamp') || '2000-01-01';
  
  const response = await fetch(
    `/api/sync/download?since=${since}&cliente_id=${currentClientId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  if (response.ok) {
    const updates = await response.json();
    return updates;  // { work_orders: [...], equipos: [...], ... }
  }
  
  throw new Error('Download failed');
}

async function mergeChanges(updates: any) {
  for (const table in updates) {
    const records = updates[table];
    
    for (const record of records) {
      const existing = await db[table].get(record.id);
      
      if (!existing) {
        // Nuevo record
        await db[table].add(record);
      } else if (record.updated_at > existing.updated_at) {
        // Server es más nuevo → overwrite
        await db[table].update(record.id, record);
      }
      // Si local es más nuevo, mantener local (ya en queue)
    }
  }
  
  // Actualizar timestamp
  localStorage.setItem('last_sync_timestamp', new Date().toISOString());
}
```

**Criterio de Aceptación:**
- ✅ Upload completo sin errores
- ✅ Download desd último sync
- ✅ Merge LWW sin pérdida de datos
- ✅ Folio offline → oficial después sync
- ✅ Conflictos resueltos (no duplicados)

**Estimado:** 4 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Full-stack  

---

#### **FE-SYNC-03: Conflict Resolution (LWW)**

**Descripción:** Resolver conflictos con Last-Write-Wins

**Entregables:**
```
src/
  lib/
    sync/
      conflictResolver.ts
      conflictUI.tsx      # Modal para manual resolution si needed
```

**Estimado:** 2 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Frontend  

---

#### **FE-SYNC-04: Retry Logic (Exponencial)**

**Descripción:** Reintento exponencial de uploads fallidos

**Entregables:**
```
src/
  lib/
    sync/
      retryStrategy.ts
```

**Detalles:**

```typescript
function scheduleNextRetry(retryCount: number): Date {
  // Exponencial: 1s, 2s, 4s, 8s, 16s, 32s, max 5 min
  const delay = Math.min(Math.pow(2, retryCount) * 1000, 300000);
  return new Date(Date.now() + delay);
}

// Job cada 30 segundos
cron('*/30 * * * * *', async () => {
  const toRetry = await db.sync_queue
    .where('status').anyOf(['pending', 'error'])
    .and(item => !item.next_retry || item.next_retry <= new Date())
    .toArray();
  
  for (const item of toRetry) {
    await uploadItem(item);
  }
});
```

**Estimado:** 1 día  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-SYNC-05: Push Notifications Handler**

**Descripción:** Listener en Service Worker para notificaciones VAPID

**Entregables:**
```
src/
  lib/
    notifications/
      pushHandler.ts      # Listener push event
      notificationUi.tsx  # Toast/banner cuando notif recibida
```

**Estimado:** 2 días  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-SYNC-06: Suscripción Push (UI)**

**Descripción:** Permitir usuario activar/desactivar push notifications

**Entregables:**
```
src/
  components/
    settings/
      PushSubscriptionToggle.tsx
```

**Detalles:**

```typescript
// src/components/settings/PushSubscriptionToggle.tsx
export function PushSubscriptionToggle() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { user } = useAuth();
  
  const handleToggle = async () => {
    if (isSubscribed) {
      // Unsubscribe
      await unsubscribePush();
      setIsSubscribed(false);
    } else {
      // Subscribe
      const subscription = await Notification.requestPermission();
      if (subscription === 'granted') {
        const pushSubscription = await navigator.serviceWorker.ready
          .then(registration => registration.pushManager.getSubscription());
        
        if (!pushSubscription) {
          const newSub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_PUBLIC_KEY
          });
          
          // Enviar al servidor
          await fetch(`/api/users/${user.user_id}/push-subscription`, {
            method: 'POST',
            body: JSON.stringify(newSub)
          });
          
          setIsSubscribed(true);
        }
      }
    }
  };
  
  return (
    <button onClick={handleToggle}>
      {isSubscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'}
    </button>
  );
}
```

**Estimado:** 1 día  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-SYNC-07: Sync Status Indicator**

**Descripción:** Componente global que muestra estado sync (offline/online/syncing)

**Entregables:**
```
src/
  components/
    shared/
      SyncStatusBadge.tsx # Badge global
```

**Estimado:** 1 día  
**Criticidad:** 🟢 UX  
**Propietario:** Frontend  

---

#### **FE-SYNC-08: Network Change Detection**

**Descripción:** Detectar cambios online/offline, trigger sync automático

**Entregables:**
```
src/
  hooks/
    useNetworkStatus.ts
```

**Estimado:** 1 día  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

### 2.3 FORMULARIOS DINÁMICOS (7 items)

#### **FE-FORM-01: Form Templates Viewer**

**Descripción:** Cargar y renderizar form_templates dinámicos

**Entregables:**
```
src/
  lib/
    forms/
      formTemplateLoader.ts  # Cargar template por tipo_equipo_id
  components/
    forms/
      FormTemplateViewer.tsx # Mostrar template
```

**Estimado:** 2 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Frontend  

---

#### **FE-FORM-02: Field Renderer (Componente Dinámico)**

**Descripción:** Renderizar cada tipo de campo (texto, número, select, checkbox, firma, foto)

**Entregables:**
```
src/
  components/
    forms/
      FieldRenderer.tsx    # Dispatcher por tipo campo
      fields/
        TextField.tsx
        NumberField.tsx
        SelectField.tsx
        CheckboxField.tsx
        SignaturePad.tsx   # Canvas firma
        PhotoUpload.tsx    # Cámara/Blob
        DateField.tsx
```

**Detalles:**

```typescript
// src/components/forms/FieldRenderer.tsx
export function FieldRenderer({ field, value, onChange }) {
  const { type } = field;
  
  switch (type) {
    case 'text':
      return <TextField field={field} value={value} onChange={onChange} />;
    case 'number':
      return <NumberField field={field} value={value} onChange={onChange} />;
    case 'select':
      return <SelectField field={field} value={value} onChange={onChange} />;
    case 'checkbox':
      return <CheckboxField field={field} value={value} onChange={onChange} />;
    case 'firma':
      return <SignaturePad field={field} value={value} onChange={onChange} />;
    case 'foto':
      return <PhotoUpload field={field} value={value} onChange={onChange} />;
    case 'date':
      return <DateField field={field} value={value} onChange={onChange} />;
    default:
      return <div>Campo no soportado: {type}</div>;
  }
}

// src/components/forms/fields/NumberField.tsx
export function NumberField({ field, value, onChange }) {
  return (
    <input
      type="number"
      inputMode="numeric"  // Mostrar teclado numérico mobile
      min={field.min}
      max={field.max}
      step={field.step || 1}
      value={value || ''}
      onChange={e => onChange(parseFloat(e.target.value))}
      placeholder={field.placeholder}
    />
  );
}

// src/components/forms/fields/SignaturePad.tsx
export function SignaturePad({ field, value, onChange }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const handleMouseDown = () => setIsDrawing(true);
  const handleMouseUp = () => setIsDrawing(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.fillRect(x, y, 2, 2);
  };
  
  const handleClear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    onChange(null);
  };
  
  const handleSave = () => {
    const png = canvasRef.current?.toDataURL('image/png');
    onChange(png);
  };
  
  return (
    <div>
      <canvas
        ref={canvasRef}
        width={300}
        height={150}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        style={{ border: '1px solid #ccc', cursor: 'crosshair' }}
      />
      <button onClick={handleClear}>Limpiar</button>
      <button onClick={handleSave}>Guardar firma</button>
    </div>
  );
}

// src/components/forms/fields/PhotoUpload.tsx
export function PhotoUpload({ field, value, onChange }) {
  const [preview, setPreview] = useState<string>(value);
  
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Optimizar imagen
    const optimized = await compressImage(file);
    
    // Convertir a blob URL
    const blobUrl = URL.createObjectURL(optimized);
    setPreview(blobUrl);
    onChange(optimized);
  };
  
  return (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="environment"  // Cámara trasera mobile
        onChange={handleCapture}
      />
      {preview && <img src={preview} alt="preview" style={{ maxWidth: '100%' }} />}
    </div>
  );
}
```

**Criterio de Aceptación:**
- ✅ Todos los tipos de campo renderizados correctamente
- ✅ Validación en tiempo real (min, max, required, etc.)
- ✅ Teclado numérico en fields de número (mobile)
- ✅ Firma canvas funciona en mouse y touch
- ✅ Fotos se comprimen automáticamente
- ✅ Preview antes de guardar

**Estimado:** 4 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Frontend  

---

#### **FE-FORM-03: Form Instance Creator**

**Descripción:** Crear form_instance a partir de template

**Entregables:**
```
src/
  components/
    forms/
      FormInstanceCreator.tsx
```

**Estimado:** 2 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Frontend  

---

#### **FE-FORM-04: Validación Client-side**

**Descripción:** Validar campos antes de guardar (required, min/max, regex, etc.)

**Entregables:**
```
src/
  lib/
    forms/
      validator.ts
```

**Estimado:** 2 días  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-FORM-05: Binding Engine (Auto-poblamiento)**

**Descripción:** Auto-poblar narrativos OT conforme se completan form_instances

**Entregables:**
```
src/
  lib/
    binding/
      bindingEngine.ts    # Motor auto-cálculos
```

**Detalles:**

```typescript
// src/lib/binding/bindingEngine.ts
export class BindingEngine {
  // Cuando se completa form_instance, auto-poblar narrativos OT
  async updateOTNarratives(work_order_id: string) {
    // Obtener todas las form_instances de esta OT
    const forms = await db.form_instances
      .where('work_order_id').equals(work_order_id)
      .toArray();
    
    // Extraer info de cada form para alimentar narrativos
    const hallazgos = forms
      .flatMap(f => f.hallazgos || [])
      .filter(h => h.trim())
      .join('\n- ');
    
    const recomendaciones = forms
      .flatMap(f => f.recomendaciones || [])
      .filter(r => r.trim())
      .join('\n- ');
    
    // Auto-actualizar OT narrativos
    await db.work_orders.update(work_order_id, {
      hallazgo: hallazgos ? `- ${hallazgos}` : '',
      recomendaciones: recomendaciones ? `- ${recomendaciones}` : '',
      updated_at: new Date()
    });
  }
}

// Hook
export function useBindingEngine() {
  return {
    triggerBinding: (work_order_id: string) => {
      return bindingEngine.updateOTNarratives(work_order_id);
    }
  };
}
```

**Estimado:** 2 días  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-FORM-06: Form Persistence (Auto-save)**

**Descripción:** Auto-guardar form_instance cada cambio (sin perder datos en crash)

**Entregables:**
```
src/
  hooks/
    useFormAutoSave.ts
```

**Estimado:** 1 día  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-FORM-07: Form Template Admin UI (CRUD)**

**Descripción:** UI para admin crear/editar/publicar form_templates

**Entregables:**
```
src/
  components/
    admin/
      FormTemplateBuilder.tsx  # Drag-drop fields builder
      FieldConfigurator.tsx     # Props por campo
```

**Estimado:** 3 días  
**Criticidad:** 🟢 ADMIN FEATURE  
**Propietario:** Frontend  

---

### 2.4 ÓRDENES DE TRABAJO (7 items)

#### **FE-OT-01: OTForm (Crear/Editar)**

**Descripción:** Formulario multi-paso para crear OT

**Entregables:**
```
src/
  components/
    orders/
      OTForm.tsx           # Multi-step form
      OTStep1_Info.tsx     # Descripción, tipo, etc.
      OTStep2_Equipment.tsx # Seleccionar equipos
      OTStep3_Review.tsx   # Revisar antes guardar
```

**Pseudocódigo:**

```typescript
// src/components/orders/OTForm.tsx
export function OTForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<WorkOrder>>({
    tipo: 'preventivo',
    estado: 'abierto',
    equipos: []
  });
  
  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);
  
  const handleSubmit = async () => {
    try {
      // Validar datos
      if (!formData.descripcion) throw new Error('Descripción requerida');
      if (formData.equipos?.length === 0) throw new Error('Mínimo 1 equipo');
      
      // Crear OT + work_order_assets
      const ot_id = generateUUID();
      
      await db.work_orders.add({
        work_order_id: ot_id,
        cliente_id: user.cliente_id,
        sucursal_id: formData.sucursal_id,
        ...formData,
        folio: `OT-${ot_id.substring(0, 8)}`,  // Temporal
        estado: 'abierto',
        created_at: new Date()
      });
      
      // Crear work_order_assets para cada equipo
      for (const tag of formData.equipos!) {
        await db.work_order_assets.add({
          work_order_asset_id: generateUUID(),
          work_order_id: ot_id,
          tag,
          estado: 'pendiente'
        });
      }
      
      // Agregar a sync queue
      await syncQueueManager.addToQueue('work_orders', ot_id, formData);
      
      showNotification('✓ OT creada', 'success');
      navigate(`/work-orders/${ot_id}`);
      
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
    }
  };
  
  return (
    <div>
      {step === 1 && <OTStep1_Info data={formData} onChange={setFormData} />}
      {step === 2 && <OTStep2_Equipment data={formData} onChange={setFormData} />}
      {step === 3 && <OTStep3_Review data={formData} onSubmit={handleSubmit} />}
      
      <button onClick={handleBack} disabled={step === 1}>Atrás</button>
      <button onClick={handleNext} disabled={step === 3}>Siguiente</button>
    </div>
  );
}
```

**Criterio de Aceptación:**
- ✅ Multi-step form completo
- ✅ Validaciones en cada paso
- ✅ Folio temporal generado offline
- ✅ work_order_assets creados para cada equipo
- ✅ Guardado en Dexie + sync queue

**Estimado:** 3 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Frontend  

---

#### **FE-OT-02: TagAssignment (Multi-tag Workflow)**

**Descripción:** Seleccionar múltiples equipos (tags) para una OT

**Entregables:**
```
src/
  components/
    orders/
      TagAssignment.tsx    # Selector multi-equipo
      TagSelector.tsx      # Dropdown + QR scanner
```

**Estimado:** 2 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Frontend  

---

#### **FE-OT-03: OTProgressDashboard**

**Descripción:** Dashboard mostrando progreso de OT (% completado, estado por tag, timeline)

**Entregables:**
```
src/
  components/
    dashboards/
      OTProgressDashboard.tsx  # Componente principal
      ProgressBar.tsx           # Barra de progreso
      TagStatusCard.tsx         # Card por tag
      TimelineView.tsx          # Timeline de eventos
```

**Detalles:**

```typescript
// src/components/dashboards/OTProgressDashboard.tsx
export function OTProgressDashboard({ work_order_id }) {
  const [ot, setOt] = useState<WorkOrder | null>(null);
  const [assets, setAssets] = useState<WorkOrderAsset[]>([]);
  
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);  // Refresh cada 5s
    return () => clearInterval(interval);
  }, [work_order_id]);
  
  const loadData = async () => {
    const wo = await db.work_orders.get(work_order_id);
    const woa = await db.work_order_assets
      .where('work_order_id').equals(work_order_id)
      .toArray();
    
    setOt(wo);
    setAssets(woa);
  };
  
  if (!ot) return <div>Cargando...</div>;
  
  const totalAssets = assets.length;
  const completedAssets = assets.filter(a => a.estado === 'completado').length;
  const progressPercent = Math.round((completedAssets / totalAssets) * 100);
  
  return (
    <div className="ot-progress-dashboard">
      <h2>Progreso OT: {ot.folio}</h2>
      
      {/* Barra de progreso */}
      <div className="progress-container">
        <ProgressBar
          current={completedAssets}
          total={totalAssets}
          percent={progressPercent}
        />
        <div className="progress-text">{completedAssets}/{totalAssets} equipos completados</div>
      </div>
      
      {/* Status por tag */}
      <div className="tags-grid">
        {assets.map(asset => (
          <TagStatusCard key={asset.tag} asset={asset} />
        ))}
      </div>
      
      {/* Timeline */}
      <TimelineView work_order_id={work_order_id} />
      
      {/* Narrativos OT (binding) */}
      <div className="narrativos">
        <h3>Hallazgos</h3>
        <p>{ot.hallazgo || '(vacío, se completará conforme cierren informes)'}</p>
      </div>
    </div>
  );
}

// src/components/dashboards/TagStatusCard.tsx
export function TagStatusCard({ asset }: { asset: WorkOrderAsset }) {
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [form, setForm] = useState<FormInstance | null>(null);
  
  useEffect(() => {
    loadEquipoAndForm();
  }, [asset.tag]);
  
  const loadEquipoAndForm = async () => {
    const eq = await db.equipos.get(asset.tag);
    const fi = await db.form_instances
      .where('work_order_asset_id').equals(asset.work_order_asset_id)
      .first();
    
    setEquipo(eq);
    setForm(fi);
  };
  
  const statusIcon = {
    'pendiente': '⏳',
    'en_progreso': '⚙️',
    'completado': '✅'
  }[asset.estado];
  
  return (
    <div className="tag-status-card">
      <div className="tag-header">
        <span className="icon">{statusIcon}</span>
        <span className="tag">{asset.tag}</span>
      </div>
      
      <div className="tag-info">
        <p><strong>{equipo?.nombre}</strong></p>
        <p className="estado">{asset.estado}</p>
      </div>
      
      {form && (
        <div className="form-preview">
          <small>Informe: {form.estado}</small>
          {form.firma_digital && <small>✍️ Firmado</small>}
        </div>
      )}
      
      <button onClick={() => navigateToFormInstance(form?.form_instance_id)}>
        Ver informe
      </button>
    </div>
  );
}
```

**Criterio de Aceptación:**
- ✅ Barra de progreso actualiza en tiempo real
- ✅ Card por tag mostrando estado
- ✅ Timeline de eventos (OT abierta, form completada, etc.)
- ✅ Narrativos se actualizan automáticamente (binding)
- ✅ Responsive mobile

**Estimado:** 3 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Frontend  

---

#### **FE-OT-04: Informe HVAC Viewer**

**Descripción:** Ver/descargar informe HVAC completado (con datos equipo, mediciones, firma)

**Entregables:**
```
src/
  components/
    reports/
      InformeHVACViewer.tsx   # Componente viewer
      InformeHVACDownload.tsx # Generar PDF
```

**Estimado:** 3 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Frontend  

---

#### **FE-OT-05: Firma Digital & Foto en Form Instance**

**Descripción:** Capturar firma y foto durante form_instance

**Entregables:**
```
src/
  components/
    forms/
      fields/
        SignaturePad.tsx    # (ya en FE-FORM-02)
        PhotoCapture.tsx    # (ya en FE-FORM-02)
```

**Estimado:** 1 día (incluido en FE-FORM-02)  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Frontend  

---

#### **FE-OT-06: QR Scanner Integration**

**Descripción:** Escanear QR del equipo para cargar ficha rápidamente

**Entregables:**
```
src/
  components/
    shared/
      QRScanner.tsx        # Modal scanner
      QRParser.ts          # Extraer tag del QR
```

**Estimado:** 2 días  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-OT-07: OT State Manager & Persistence**

**Descripción:** Gestionar estado de OT en progreso (no perder si crash)

**Entregables:**
```
src/
  hooks/
    useOTForm.ts           # State manager
```

**Estimado:** 1 día  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

### 2.5 DASHBOARDS & REPORTES (6 items)

#### **FE-DASH-01: Dashboard Principal (Home)**

**Descripción:** Landing page con KPI cards, notificaciones recientes

**Entregables:**
```
src/
  components/
    dashboards/
      DashboardHome.tsx      # Layout principal
      KPICard.tsx            # Cards MTBF, MTBM, etc.
      RecentActivity.tsx     # Últimas OT, tickets
      NotificationCenter.tsx # Campana de notificaciones
```

**Estimado:** 3 días  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-DASH-02: Indicadores (MTBF, MTBM, Consumo, etc.)**

**Descripción:** Dashboard detallado de KPI con gráficos

**Entregables:**
```
src/
  components/
    dashboards/
      KPIDetailsDashboard.tsx
      KPIChart.tsx           # Chart.js / Recharts
```

**Estimado:** 3 días  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-DASH-03: Equipos Ficha Técnica**

**Descripción:** Ver ficha técnica completa del equipo (specs, ciclo vida, historial)

**Entregables:**
```
src/
  components/
    equipos/
      EquipoFichaTecnica.tsx  # Vista completa
      EquipoEditForm.tsx      # Editar datos
      EquipoHistorial.tsx     # Historial OT
```

**Estimado:** 3 días  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-DASH-04: Calendario Planificación**

**Descripción:** Calendario visual de OT y MP programadas

**Entregables:**
```
src/
  components/
    calendar/
      CalendarPlanificacion.tsx
      EventDetails.tsx        # Popup evento
```

**Estimado:** 3 días  
**Criticidad:** 🟢 FEATURE  
**Propietario:** Frontend  

---

#### **FE-DASH-05: Mapa de Sucursales/Equipos**

**Descripción:** Mapa geográfico con ubicación de sucursales y equipos

**Entregables:**
```
src/
  components/
    map/
      MapView.tsx            # Leaflet map
      MapMarkers.tsx         # Marcadores
      MapPopup.tsx           # Info popup
```

**Estimado:** 3 días  
**Criticidad:** 🟢 FEATURE  
**Propietario:** Frontend  

---

#### **FE-DASH-06: Reportes Exportables**

**Descripción:** Generar reportes PDF, Excel, JSON

**Entregables:**
```
src/
  lib/
    reports/
      pdfGenerator.ts        # jsPDF
      excelGenerator.ts      # SheetJS
      jsonExporter.ts        # JSON dump
  components/
    reports/
      ReportExporter.tsx     # UI selector formato
```

**Estimado:** 3 días  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

### 2.6 COMPONENTES UI (5 items)

#### **FE-UI-01: Theme System (Light, Dark, Cyberpunk)**

**Descripción:** Sistema de temas global con CSS variables

**Entregables:**
```
src/
  styles/
    themes/
      light.css    # Colores tema claro
      dark.css     # Colores tema oscuro
      cyberpunk.css # Tema con neón
  lib/
    theme/
      themeProvider.tsx  # Context proveedor
      useTheme.ts        # Hook
```

**Criterio de Aceptación:**
- ✅ 3 temas implementados
- ✅ Persistencia en localStorage
- ✅ Transiciones suave entre temas
- ✅ Accesibilidad (WCAG AA contrast)

**Estimado:** 2 días  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

#### **FE-UI-02: Form Controls (Input, Select, Datepicker)**

**Descripción:** Suite de componentes reutilizables

**Entregables:**
```
src/
  components/
    ui/
      Input.tsx
      Select.tsx
      Datepicker.tsx
      Checkbox.tsx
      Radio.tsx
      Textarea.tsx
```

**Estimado:** 2 días  
**Criticidad:** 🟢 CALIDAD  
**Propietario:** Frontend  

---

#### **FE-UI-03: Cards, Modals, Drawer**

**Descripción:** Componentes layout

**Entregables:**
```
src/
  components/
    ui/
      Card.tsx
      Modal.tsx
      Drawer.tsx
      Tabs.tsx
      Accordion.tsx
```

**Estimado:** 2 días  
**Criticidad:** 🟢 CALIDAD  
**Propietario:** Frontend  

---

#### **FE-UI-04: Toast & Notification System**

**Descripción:** Sistema de notificaciones (toast, snackbar)

**Entregables:**
```
src/
  components/
    notifications/
      Toast.tsx
      ToastContainer.tsx
  hooks/
    useToast.ts
```

**Estimado:** 1 día  
**Criticidad:** 🟢 UX  
**Propietario:** Frontend  

---

#### **FE-UI-05: Menu Customizable (Drag-to-reorder, Left/Right)**

**Descripción:** Menú lateral personalizable

**Entregables:**
```
src/
  components/
    navigation/
      Sidebar.tsx          # Menu principal
      MenuCustomizer.tsx   # Drag-drop reorder
      MenuSettings.tsx     # Left/right toggle
```

**Estimado:** 2 días  
**Criticidad:** 🟡 IMPORTANTE  
**Propietario:** Frontend  

---

### 2.7 CONTROL DE ACCESO (3 items)

#### **FE-AUTH-01: AuthContext & useAuth Hook**

**Descripción:** Context global para autenticación

**Entregables:**
```
src/
  context/
    AuthContext.tsx
  hooks/
    useAuth.ts
```

**Estimado:** 2 días (ya en FE-INFRA-05)  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Full-stack  

---

#### **FE-AUTH-02: Permiso Middleware & Role-based Rendering**

**Descripción:** Middleware para validar permisos, hide/disable UI según rol

**Entregables:**
```
src/
  lib/
    permissions/
      permissionMatrix.ts    # Matriz 6 roles × 50+ acciones
      checkPermiso.ts        # Función de validación
  components/
    shared/
      ProtectedComponent.tsx # Wrapper para componentes
```

**Estimado:** 2 días  
**Criticidad:** 🔴 BLOQUEANTE  
**Propietario:** Frontend  

---

#### **FE-AUTH-03: Tenant Isolation**

**Descripción:** Validar que usuario solo acceda su cliente

**Entregables:**
```
src/
  hooks/
    useTenantContext.ts
```

**Estimado:** 1 día  
**Criticidad:** 🔴 BLOQUEANTE (seguridad)  
**Propietario:** Frontend  

---

---

## 3. FLUJOS DE DATOS {#flujos}

### Flujo: Técnico crea OT offline, sincroniza después

```
┌─ Frontend Local (Dexie) ──────────┐
│                                    │
│  1. Técnico abre PWA (offline)    │
│     ↓                              │
│  2. Click "Nueva OT"              │
│     ↓                              │
│  3. Completa formulario           │
│     - Tipo: Preventivo            │
│     - Equipos: [21-STK.AC.001]   │
│     ↓                              │
│  4. Sistema genera folio TEMP:    │
│     OT-a1b2c3d4                   │
│     ↓                              │
│  5. INSERT work_orders + assets   │
│     en Dexie                       │
│     ↓                              │
│  6. Agregar a sync_queue:         │
│     status='pending'               │
│     ↓                              │
│  7. Mostrar badge "⏳ Pendiente"  │
│                                    │
└─────────────────────────────────┬─┘
                                   │
                    ┌──────────────┤
                    │ Conexión     │
                    │ restaurada   │
                    ↓              │
     ┌──────────────────────────┐  │
     │  Service Worker detects  │◄─┘
     │  online event            │
     └──────────┬───────────────┘
                │
                ↓
     ┌──────────────────────────┐
     │  1. UPLOAD local changes │
     │     POST /api/sync/upload│
     │     work_orders          │
     │     + work_order_assets  │
     │     ↓                     │
     │  2. Backend valida       │
     │     ↓                     │
     │  3. Genera folio oficial │
     │     INF-21-STK.AC-001-0  │
     │     ↓                     │
     │  4. Response:            │
     │     {                     │
     │      folio_oficial,      │
     │      server_id,          │
     │      status: 'synced'    │
     │     }                     │
     │     ↓                     │
     │  5. Client actualiza     │
     │     Dexie record         │
     │     folio: oficial       │
     │     ↓                     │
     │  6. Mark sync_queue item │
     │     status='synced'      │
     │     ↓                     │
     │  7. UI actualiza:        │
     │     "✓ Sincronizado"     │
     │     Folio oficial visible│
     └──────────────────────────┘
```

---

## 4. DEPENDENCIAS ENTRE MÓDULOS {#dependencias}

```
FE-INFRA-01 (schema Dexie incremental)
├── bloqueante para: FE-INFRA-02, FE-SYNC-01, FE-FORM-01, FE-OT-01, FE-AUTH-01
│
FE-INFRA-05 (AuthContext)
├── bloqueante para: FE-AUTH-02, FE-OT-01, FE-FORM-01
│
FE-SYNC-01 (Queue Manager)
├── bloqueante para: FE-SYNC-02, FE-OT-01
│
FE-SYNC-02 (Sync Engine)
├── bloqueante para: FE-SYNC-03, FE-SYNC-04
├── requiere: FE-INFRA-06 (Service Worker)
│
FE-FORM-02 (FieldRenderer)
├── bloqueante para: FE-FORM-03, FE-OT-01
│
FE-OT-01 (OTForm)
├── bloqueante para: FE-OT-03 (OTProgressDashboard)
├── requiere: FE-AUTH-01, FE-FORM-02, FE-SYNC-01
│
FE-OT-03 (OTProgressDashboard)
├── bloqueante para: FE-DASH-01
│
FE-UI-01 (Theme System)
├── puede iniciar en paralelo
│
FE-DASH-01 (Dashboard Home)
├── requiere: FE-OT-03, FE-AUTH-01
```

---

## 5. TIMELINE & MILESTONES {#timeline}

### **Semana 1-2: Infraestructura & Auth**

| Día | FE-INFRA | FE-AUTH | FE-UI | Status |
|-----|----------|---------|-------|--------|
| 1-2 | Migración Dexie incremental | AuthContext | - | 🔴 BLOQUEANTE |
| 3-4 | Blob Storage | Sesión online | Theme System | 🟡 PARALELO |
| 5-6 | Caché, Service Worker | Permisos, Tenant | Forms | 🟡 PARALELO |
| 7-8 | Types, Error Boundary | Login UI | - | 🟢 SOPORTE |

**Entregable Hito 1:** Técnico puede logearse, PWA offline funciona, Dexie sincronizado

---

### **Semana 2-3: Sincronización**

| Día | FE-SYNC | FE-FORM | FE-OT | Status |
|-----|---------|---------|-------|--------|
| 1-2 | Queue Manager | - | - | 🔴 BLOQUEANTE |
| 3-5 | Sync Engine | Form Templates | - | 🔴 BLOQUEANTE |
| 6-7 | Conflict Res. | FieldRenderer | OTForm | 🔴 BLOQUEANTE |
| 8 | Push Handler | - | TagAssignment | 🟡 IMPORTANTE |

**Entregable Hito 2:** Técnico puede crear OT offline, sincroniza al conectar, folio oficial asignado

---

### **Semana 3-4: Formularios Dinámicos**

| Día | FE-FORM | FE-OT | FE-DASH | Status |
|-----|---------|-------|----------|--------|
| 1-2 | Form Instance | - | - | 🔴 BLOQUEANTE |
| 3-4 | Validación | Firma/Foto | - | 🔴 BLOQUEANTE |
| 5-6 | Binding Engine | Progress Dashboard | KPI Cards | 🟡 IMPORTANTE |
| 7-8 | Auto-save | Informe Viewer | - | 🟡 IMPORTANTE |

**Entregable Hito 3:** Técnico puede llenar checklist por equipo, firma digital funciona, OT progresa

---

### **Semana 4-5: Dashboards & Reportes**

| Día | FE-DASH | FE-SYNC | FE-UI | Status |
|-----|---------|---------|-------|--------|
| 1-2 | Home Dashboard | Retry Logic | Mobile Layout | 🟡 IMPORTANTE |
| 3-4 | KPI Details | Sync Status | Menu Customizer | 🟡 IMPORTANTE |
| 5-6 | Calendario | - | Toast System | 🟢 UX |
| 7-8 | Mapa, Reportes | - | - | 🟢 FEATURE |

**Entregable Hito 4:** Admin ve dashboards, puede exportar reportes, usuario ve sync status

---

### **Semana 5-6: Testing & Polish**

| Día | Actividad | Status |
|-----|-----------|--------|
| 1-3 | E2E testing (Cypress/Playwright) | 🟡 QA |
| 4-5 | Performance optimization | 🟢 TUNING |
| 6-7 | Accessibility review (WCAG AA) | 🟢 A11Y |
| 8 | Bug fixes, documentation | 🟢 SOPORTE |

**Entregable Final:** Fase 2 completada, ready para Fase 3 (Backend), UAT list pronta

---

## 6. ESTIMADOS DE ESFUERZO {#estimados}

### Por Módulo

| Módulo | Items | Días | Dev | Crítico |
|--------|-------|------|-----|---------|
| Infraestructura | 8 | 14 | 1 (Full-stack) | 🔴 |
| Sincronización | 8 | 12 | 1-2 | 🔴 |
| Formularios | 7 | 12 | 1 | 🔴 |
| OT | 7 | 14 | 1 | 🔴 |
| Dashboards | 6 | 15 | 1-2 | 🟡 |
| UI | 5 | 9 | 1 | 🟢 |
| Auth | 3 | 5 | 1 | 🔴 |
| **TOTAL** | **47** | **81** | **1-2 devs** | - |

**Paralela con Fase 3 (Backend): 39 días**  
**Ajustado a 39 días (6 semanas) → Ejecutar en paralelo**

### Por Día (Promedio)

- **Lunes-Jueves:** Coding (4 días)
- **Viernes:** Code review, tests, integraciones (1 día)
- **Sábado-Domingo:** Off

**Ramp-up:** Primer 3 días solo Dexie schema (bloqueante)

---

## 7. CHECKLIST DoD (Definition of Done) {#dod}

### Para cada item completado:

- [ ] Código escrito + comentarios (no `any`, TypeScript strict)
- [ ] Unit tests (Jest, mínimo 80% coverage)
- [ ] Code review aprobado (otro dev)
- [ ] Git commit con mensaje descriptivo
- [ ] Integración local funciona sin errores
- [ ] E2E test pasa (Cypress)
- [ ] Accesibilidad checklist (tab order, labels, alt text)
- [ ] Performance check (DevTools, < 3s load)
- [ ] Documentación actualizada (README, JSDoc)

### Para Hitos:

- [ ] Todos los items del hito completados
- [ ] Demo funcional sin errores
- [ ] Integración con Fase 3 (si aplica)
- [ ] Documentación técnica sellada
- [ ] User acceptance test list creada

---

## PRÓXIMOS PASOS

### Inmediato (Sprint 2 — comenzar ahora)

1. **Confirmar URL del backend** → configurar `VITE_API_URL` en Vercel y `.env.local`
2. **Implementar `useOTs` hook** → TanStack Query + Dexie, reemplazar mock en OTListPage
3. **OTDetailPage** → vista de detalle con lista de tags/activos asignados
4. **FieldRenderer** → dispatcher por tipo de campo (text, number, select, boolean, medicion)
5. **FormInstancePage** → llenar checklist por tag con auto-save en Dexie

### Después (Sprint 3)

6. **SignaturePad** → canvas touch + mouse → PNG
7. **PhotoCapture** → cámara trasera mobile
8. **Admin CRUD** → Clientes, Sucursales, Equipos, Tipos y Usuarios

### Backend pendiente (Nelson debe hacer o coordinar)

- Aplicar 3 migraciones SQL en Neon (`db/migrations/`)
- Confirmar endpoints activos: `POST /api/auth/login`, `GET /api/work-orders`, `GET /api/sync/pull`

---

**Plan Fase 2 Frontend — En progreso**  
**Sprint 1:** ✅ Completado (2026-06-14)  
**Sprint 2:** 🔵 Por comenzar  
**Duración restante estimada:** ~28 días (5 sprints)  
**Deploy:** https://claude-cmms-hvac-pro-bivg-34v88wumn-d-los-cabros-s-projects.vercel.app/

