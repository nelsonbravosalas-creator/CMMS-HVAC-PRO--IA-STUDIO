# CMMS HVAC PRO — Reglas de negocio offline-first (v2026-05-24, edición extendida)

> **Versión:** 2026-05-24 (rev. 2 — extendida)
> **Reemplaza:** `CMMS_HVAC_PRO_BUSINESS_RULES_OFFLINE_FIRST` (2026-05-22) y la primera revisión 2026-05-24.
> **Aplicación:** CMMS HVAC PRO (EECOL Chile, español-CL, mobile-first, multi-tenant).
> **Stack real implementado:** React 18 + TypeScript 5.9 + Vite 7 + Express 5 + PostgreSQL 16 + Drizzle ORM + IndexedDB (`cmms_sync_v2`) + Workbox/PWA + Web Push VAPID.
> **Stack objetivo / portable:** backend Express portable a Vercel (Serverless Node 20+), Replit Autoscale, Fly.io o Railway. Base de datos Postgres ≥ 14 (Neon, Replit Postgres, Supabase, RDS).
> **Destino:** Fuente única de verdad para producto, equipo de desarrollo y agentes IA que generen, corrijan o validen código. Cualquier divergencia con el código debe ser tratada como bug o brecha conocida documentada en §17.

---

## 0. Tabla de contenidos

1. Resumen ejecutivo y errata respecto a versiones anteriores
2. Arquitectura real y portable (capas, equivalencias, despliegue)
3. Modelo de datos completo (tablas reales, columnas, índices, FK, triggers)
4. Multi-tenancy obligatorio
5. Roles, perfiles y permisos
6. Workflows reales (estados, transiciones, side-effects)
7. **Sincronización offline-first** (cola local, optimistic concurrency, idempotencia, conflict resolution, background sync, blobs)
8. TAG y QR
9. Reglas operativas por pantalla (22 pantallas)
10. Botones críticos
11. Tablas de verdad (decisiones determinísticas)
12. **Flujo móvil offline-first (paso a paso)**
13. **Flujo desktop online (paso a paso)**
14. KPIs corregidos
15. Auditoría y trazabilidad
16. Contrato API REST granular
17. Aspecto / Prompt UI-UX
18. Plan de cierre de brechas
19. Matriz móvil↔desktop
20. Criterios de aceptación funcional
21. Pruebas mínimas obligatorias
22. Convenciones finales y guardrails para IA Studio

---

## 1. Resumen ejecutivo y errata

Esta edición extendida corrige y profundiza las reglas previas. El cambio principal es la **especificación quirúrgica del subsistema offline-first**: cola, idempotencia, versionado optimista, gestión de blobs, política de conflicto, background sync, particionamiento por cliente activo y reconciliación de estado entre múltiples tabs.

### 1.1 Errata consolidada (vs documento original 2026-05-22)

| # | Error v2026-05-22 | Corrección |
|---|---|---|
| E1 | Tablas sin prefijo (`clients`, `assets`, `work_orders`). | Prefijo real `cmms_*` (`cmms_clientes`, `cmms_equipos`, `cmms_tickets`). |
| E2 | Tabla `branches` (sucursal) como entidad. | Brecha conocida; hoy sucursal vive embebida en `cmms_equipos.almacen/area/sucursal`. Plan §18 promueve a `cmms_sucursales`. |
| E3 | Tabla `catalog_asset_types` separada. | Brecha; `tipo` es string controlado por whitelist hasta migración a `cmms_tipos_equipo`. |
| E4 | Entidad `ordenes_servicio` separada. | Unificada en `cmms_tickets` con código `OT-YYYY-NNNN`. Legacy `/tickets` alias de `/ordenes-trabajo`. |
| E5 | Estados ticket `abierto/asignado/en_proceso/...` (underscores). | Estados reales con guion: `borrador / abierta / asignada / en-progreso / en-pausa / resuelta / cerrada / cancelada / rechazada`. |
| E6 | Estados mantenimiento `programado/vencido/observado`. | Reales: `pendiente / en-proceso / completado / cancelado`. "Vencido" es derivada. |
| E7 | Endpoint único `POST /api/sync`. | Anti-patrón en offline-first granular. Se usan endpoints REST por recurso con `If-Match` + `Idempotency-Key`, más un `GET /api/sync/snapshot?since=…` para pull incremental. |
| E8 | `uuid_sync` separado del `id`. | Un solo `id` (cuid o folio funcional). |
| E9 | `sync_queue` como tabla del servidor. | La cola vive solo en el cliente (IndexedDB store `pending_ops`). |
| E10 | Sin multi-tenancy. | Toda tabla operativa tiene `clienteId NOT NULL` y JWT carga `clienteActivo`. |
| E11 | Conflictos resueltos sin política. | Política: optimistic locking por `version`; 409 con `serverEntity`; UI ofrece keep-mine / keep-theirs / merge. |
| E12 | Doble-click bloqueado por convención. | `Idempotency-Key` UUID v4 + mutex local + cache servidor 24 h. |
| E13 | Disponibilidad usa `horas_fuera_servicio`. | Disponibilidad = `equipos_operativos / total_no_baja`; MTBF/MTTR computados sobre `cmms_mantenimientos` correctivos + transiciones OT. |
| E14 | `status` dentro de JSON en `reports/ordenes_servicio`. | Columna nativa indexable. |
| E15 | Documentos firmados "no editan" sin detalle. | Hash SHA-256 del payload canónico + `firmadoPorUserId + firmadoIp + claveFirmaHash`; reapertura crea evento crítico. |
| E16 | Login solo "rol válido". | Real: `rol + perfil + cmms_usuarios_clientes` + selección de `clienteActivo`. |
| E17 | Vercel+Neon como única opción. | Portable a cualquier Node 20+ y Postgres ≥ 14. |
| E18 | Dexie como ORM cliente. | IndexedDB nativo tipado (sin dep extra). |

### 1.2 Cambios de esta edición extendida (rev. 2)

- §7 completamente reescrita: contrato exacto del op-log, semáforo de estados de cada op, política de retry con backoff y jitter, contrato de blobs (datos binarios offline), `idempotencyKey` en cabecera o body, BroadcastChannel entre tabs, reset selectivo por cliente.
- §12 y §13 separadas en flujos paso a paso (cada pantalla, cada botón, cada error posible).
- §17 expandida con prompt de aspecto listo para sub-agente DESIGN.
- §22 nuevas guardrails para IA Studio (anti-patrones que deben rechazarse automáticamente).

---

## 2. Arquitectura real y portable

### 2.1 Diagrama de capas (cliente → servidor → base)

```
┌──────────────────────────────────────────────────────────────────────┐
│  UI React 18 + Vite 7 (mobile-first, responsive auto)                │
│  Pages (22) → Components → Hooks (useData, useAuth, useSync, …)      │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────────┐
│  Capa de dominio cliente (TypeScript)                                │
│  • Validación zod (lib/api-zod, generado desde OpenAPI)              │
│  • Op-encoder (lib/sync/ops.ts) → enqueue + materializar blobs       │
│  • SyncProcessor (lib/sync/processor.ts) → drena cola con backoff    │
│  • Versionado optimista + Idempotency-Key (lib/sync/api.ts)          │
│  • React Query con keys `[entity, clienteActivo, …]`                 │
│  • Service Worker Workbox (auto-update, NetworkFirst, BgSync regs)   │
│  • BroadcastChannel `cmms_sync` para multi-tab                       │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────────┐
│  Persistencia local — IndexedDB `cmms_sync_v2`                       │
│  Stores:                                                             │
│    • pending_ops      (cola FIFO con backoff)                        │
│    • blobs            (fotos/firmas Blob)                            │
│    • snapshots        (caché lectura particionada por clienteId)     │
│    • id_map           (localId → serverId si rename)                 │
│    • conflicts        (entradas 409 pendientes de resolución)        │
│    • meta             (lastSyncAt, clienteActivo, deviceId)          │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ fetch (online) + Background Sync (SW)
┌──────────────────────────▼───────────────────────────────────────────┐
│  Express 5 API (artifacts/api-server)                                │
│  Middlewares: pino-http, requireUser, requireCliente, requireRol     │
│  Idempotency cache (memoria → tabla; ver §18)                        │
│  Rutas REST por recurso (§16)                                        │
│  Validación zod (compartida con cliente)                             │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ Drizzle ORM
┌──────────────────────────▼───────────────────────────────────────────┐
│  PostgreSQL ≥ 14 (Replit / Neon / RDS / Supabase)                    │
│  Schemas: lib/db/src/schema/*                                        │
│  FK reales, índices únicos compuestos por clienteId                  │
│  Triggers de auditoría en tablas críticas                            │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Equivalencias proveedor-agnósticas

| Capa | Implementación actual | Alternativas portables |
|---|---|---|
| Hosting Node | Replit Reserved VM | Vercel Node (serverless o edge), Fly Machines, Railway, Render, AWS App Runner |
| Postgres | Replit Postgres | Neon (recomendado para Vercel), Supabase, RDS, Cloud SQL |
| Storage adjuntos | Replit Object Storage (`/api/storage/upload-url`) | S3, GCS, R2, Vercel Blob |
| Push notifications | Web Push VAPID self-managed | FCM, OneSignal |
| Reverse proxy | Replit shared proxy | Caddy, Nginx, Cloudflare, Vercel Edge |
| CDN PWA | servido por mismo Express estático | Vercel Edge, CloudFront, Cloudflare Pages |

### 2.3 Modelo de despliegue recomendado para producción

| Componente | Recomendación |
|---|---|
| Frontend PWA | Build estático `vite build` → CDN (Vercel/CloudFront), assets con hash, cache 1 año. SW con auto-update. |
| Backend Express | Single instance Reserved VM **o** Vercel Functions Node 20 con `vercel.json` mapeando `app.ts` como handler único. |
| Postgres | Neon serverless con autoscaling + branching para preview deploys. Pool de conexiones con pgBouncer / Neon's pooler. |
| Object Storage | Bucket privado con URLs firmadas (TTL 5 min para uploads, 30 min para downloads). |
| Sesiones | JWT stateless (HS256 con `SESSION_SECRET`) — no requiere store compartido. TTL 12 h + refresh. |
| Migraciones | One-shot runner al boot (`artifacts/api-server/src/lib/runOneShotMigrations.ts`) + tabla `applied_migrations`. |
| Observabilidad | pino-http → stdout → agregador (Vercel Logs / Better Stack). Métricas SLA en tabla `cmms_consola_eventos`. |
| CI/CD | `pnpm run typecheck` + `pnpm run build` antes de cada deploy. Bloqueo en errores zod/openapi. |

---

## 3. Modelo de datos REAL completo

> Convenciones globales:
> - PKs `text` (cuid o folio funcional) — sin uuid auto-incremental.
> - Toda tabla operativa: `clienteId text NOT NULL` (FK).
> - Toda tabla mutable: `version int NOT NULL DEFAULT 1` para concurrencia optimista.
> - Auditoría temporal: `createdAt timestamptz NOT NULL DEFAULT now()`, `updatedAt timestamptz NOT NULL DEFAULT now()` o `fechaActualizacion text` (ISO) según tabla legacy.
> - Baja lógica: `deletedAt timestamptz NULL`. `WHERE deleted_at IS NULL` en todos los reads.
> - Índices únicos compuestos por `(clienteId, X)` donde X es código humano.

### 3.1 `cmms_clientes`

| Columna | Tipo | Constraint | Regla |
|---|---|---|---|
| `id` | text | PK | cuid generado en cliente. |
| `nombre` | text | NOT NULL | Razón social. |
| `rut` | text | NULL | RUT chileno (módulo 11). |
| `plan` | text | NOT NULL CHECK in (`basico,profesional,enterprise`) | Plan comercial. |
| `activo` | boolean | NOT NULL DEFAULT true | Soft-disable global. |
| `createdAt` | timestamptz | NOT NULL DEFAULT now() | — |
| `updatedAt` | timestamptz | NOT NULL DEFAULT now() | trigger `set_updated_at`. |

**Índices**: `cmms_clientes_rut_unique` (parcial `WHERE rut IS NOT NULL`).

### 3.2 `cmms_usuarios` + `cmms_usuarios_clientes`

`cmms_usuarios`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | text PK | cuid. |
| `email` | text UNIQUE NOT NULL | identidad global. |
| `nombre` | text NOT NULL | display. |
| `pinHash` | text NOT NULL | SHA-256(`email::pin::SESSION_SECRET`). |
| `rol` | text NOT NULL CHECK in (`administrador,programador,supervisor,tecnico,visita`) | rol global. |
| `perfil` | text NOT NULL CHECK in (`tecnico,visita`) | capacidades en campo. |
| `mustChangePin` | boolean DEFAULT false | fuerza cambio al primer ingreso (Tarea #176). |
| `activo` | boolean DEFAULT true | desactivar sin borrar. |
| `createdAt / updatedAt` | timestamptz | — |

`cmms_usuarios_clientes`

| Columna | Regla |
|---|---|
| `userId text FK → cmms_usuarios.id` | — |
| `clienteId text FK → cmms_clientes.id` | — |
| `activo boolean DEFAULT true` | revocación per-cliente. |
| `puedeEditarMantenimientos boolean DEFAULT false` | override por par usuario/cliente. |
| **PK compuesta** `(userId, clienteId)` | — |

### 3.3 `cmms_equipos`

| Columna | Tipo | Regla |
|---|---|---|
| `tag` | text | parte de PK compuesta. |
| `clienteId` | text NOT NULL FK | tenant. |
| `nombre` | text NOT NULL | descripción visible. |
| `tipo` | text NOT NULL | whitelist controlada (`AC, CHILLER, UMA, EXTRACTOR, FANCOIL, COMPRESOR, …`). |
| `estado` | text NOT NULL CHECK in (`operativo,falla,mantenimiento,baja`) | estado lógico. |
| `marca / modelo / serie / capacidad / voltaje / corriente / refrigerante` | text NULL | datos técnicos HVAC. |
| `area / almacen / sucursal` | text NULL | sucursal implícita (§18.1). |
| `lat / lng` | numeric NULL | herencia de `ALMACEN_MAP` si vacíos. |
| `ultimoMantenimiento / proximoMantenimiento` | date NULL | derivadas materializadas para listas. |
| `version` | int NOT NULL DEFAULT 1 | optimistic locking. |
| `createdAt / updatedAt` | timestamptz | — |
| `deletedAt` | timestamptz NULL | baja lógica. |

**PK**: `(clienteId, tag)`. **Índices**: `idx_equipos_cliente_estado`, `idx_equipos_cliente_almacen`, `idx_equipos_lat_lng_partial`.

### 3.4 `cmms_mantenimientos`

| Columna | Regla |
|---|---|
| `id text PK` | folio `MNT-…` o `MNT-OT-{codigo}-{ts}`. |
| `clienteId text NOT NULL FK` | tenant. |
| `tag text NOT NULL` | equipo afectado (FK lógica). |
| `tipo text NOT NULL CHECK in (Preventivo, Correctivo, Inspección)` | tipo de servicio. |
| `fecha date NOT NULL` | fecha del servicio. |
| `tecnico text NOT NULL` | snapshot del nombre (no FK para historial). |
| `tecnicoUserId text NULL FK` | opcional, mejor trazabilidad. |
| `estado text NOT NULL CHECK in (pendiente, en-proceso, completado, cancelado)` | workflow. |
| `hallazgos / acciones / repuestos / proximaFecha` | varios | detalle. |
| `fotos jsonb NULL` | array de URLs o `blob:<id>` mientras offline. |
| `source text DEFAULT 'manual' CHECK in (manual, ot)` | origen. |
| `otId text NULL FK → cmms_tickets.id` | link a OT que lo generó. |
| `checklistPlantillaId text NULL` | plantilla usada. |
| `checklistRespuestas jsonb NULL` | respuestas del ChecklistRunner. |
| `editedByUser boolean DEFAULT false` | flag UI. |
| `editedBy text NULL` | quién editó. |
| `version int NOT NULL DEFAULT 1` | optimistic. |
| `fechaActualizacion text NOT NULL` | ISO string para sync cursor (legacy). |
| `createdAt timestamptz DEFAULT now()` | — |
| `deletedAt timestamptz NULL` | baja. |

**Índices**: `idx_mant_cliente_fecha`, `idx_mant_cliente_tag`, `idx_mant_cliente_estado`, `idx_mant_actualizacion`.

### 3.5 `cmms_tickets` (OT — Orden de Trabajo formal)

| Columna | Regla |
|---|---|
| `id text PK` | cuid. |
| `codigo text NOT NULL` | `OT-YYYY-NNNN`, único por cliente. |
| `clienteId text NOT NULL FK` | tenant. |
| `titulo text NOT NULL` | obligatorio. |
| `descripcion text NULL` | detalle. |
| `tipo text NOT NULL CHECK in (correctivo, preventivo, inspeccion, mejora)` | — |
| `prioridad text NOT NULL CHECK in (baja, media, alta, critica)` | — |
| `estado text NOT NULL CHECK in (borrador, abierta, asignada, en-progreso, en-pausa, resuelta, cerrada, cancelada, rechazada)` | máquina §6.1. |
| `tag text NULL` | equipo (obligatorio si correctivo de falla). |
| `solicitanteId text NULL FK → cmms_usuarios.id` | quien reporta. |
| `asignadoUserId text NULL FK → cmms_usuarios.id` | técnico. |
| `supervisorId text NULL FK → cmms_usuarios.id` | supervisor responsable. |
| `slaResponseDueAt timestamptz NULL` | calculado al transicionar a `abierta`. |
| `slaResolutionDueAt timestamptz NULL` | idem. |
| `slaPausedAt timestamptz NULL` | timestamp de pausa actual. |
| `slaPausedAccumMs bigint DEFAULT 0` | acumulado de pausas. |
| `mantenimientoId text NULL FK → cmms_mantenimientos.id` | si se generó al resolver. |
| `imagenes jsonb DEFAULT '[]'` | adjuntos. |
| `fechaCreacion timestamptz DEFAULT now()` | — |
| `fechaActualizacion timestamptz DEFAULT now()` | — |
| `asignadaAt / inProgresoAt / resueltaAt / cerradaAt` | timestamptz NULL — auditoría de transiciones. |
| `version int NOT NULL DEFAULT 1` | optimistic. |

**Índices**: `cmms_tickets_codigo_cliente_unique (clienteId, codigo)`, `idx_tickets_cliente_estado`, `idx_tickets_asignado`, `idx_tickets_sla_due`.

### 3.6 `cmms_ot_eventos` + `cmms_ot_comentarios`

Append-only, sin update ni delete. Cada transición y cada comentario insertan una fila.

`cmms_ot_eventos`

| Columna | Regla |
|---|---|
| `id text PK` | cuid. |
| `otId text NOT NULL FK → cmms_tickets.id` | — |
| `clienteId text NOT NULL FK` | tenant. |
| `kind text NOT NULL CHECK in (transition, asignacion, comentario, sla-pause, sla-resume, resuelta, reapertura)` | — |
| `fromEstado text NULL / toEstado text NULL` | para transitions. |
| `actorUserId text NOT NULL FK → cmms_usuarios.id` | — |
| `actorNombre text NOT NULL` | snapshot. |
| `payload jsonb DEFAULT '{}'` | detalles. |
| `createdAt timestamptz DEFAULT now()` | inmutable. |

`cmms_ot_comentarios`: similar, con `texto text NOT NULL`.

### 3.7 `cmms_informes_mantenimiento`

| Columna | Regla |
|---|---|
| `id text PK / folio text UNIQUE per cliente` | — |
| `clienteId text NOT NULL FK` | tenant. |
| `equipoTag text NOT NULL` | objeto del informe. |
| `mantenimientoId text NULL FK` | servicio asociado. |
| `estado text NOT NULL CHECK in (borrador, enviado, firmado, bloqueado)` | **columna nativa** (corrige E14). |
| `checklist24 jsonb NOT NULL` | 24 ítems HVAC estándar. |
| `medicionesElectricas jsonb NOT NULL` | R/S/T (V, A, fp). |
| `medicionesPresion jsonb NOT NULL` | circuitos 1–3 (alta/baja, sobrecalent., subenfr.). |
| `hallazgos / conclusiones / repuestos / fotos` | varios | detalle. |
| `firmaTecnico text NULL` | data-URL persistida. |
| `firmaCliente text NULL` | — |
| `firmadoPorUserId text NULL FK` | quién firmó como cliente. |
| `firmadoIp inet NULL` | trazabilidad. |
| `firmadoAt timestamptz NULL` | — |
| `claveFirmaHash text NULL` | set por técnico al enviar. |
| `hashFinal text NULL` | SHA-256 payload canónico inmutable post-firma. |
| `version int NOT NULL DEFAULT 1` | — |
| `fechaActualizacion text NOT NULL` | cursor. |
| `createdAt timestamptz DEFAULT now()` | — |
| `deletedAt timestamptz NULL` | — |

### 3.8 `cmms_sla_config`

Grilla por cliente.

| Columna | Regla |
|---|---|
| `id text PK` | cuid. |
| `clienteId text NOT NULL FK` | tenant. |
| `prioridad text NOT NULL CHECK in (baja,media,alta,critica)` | — |
| `tipo text NOT NULL CHECK in (correctivo,preventivo,inspeccion,mejora)` | — |
| `responseMinutos int NOT NULL` | minutos para asignar. |
| `resolutionMinutos int NOT NULL` | minutos para resolver. |
| `version int DEFAULT 1 / updatedAt timestamptz` | — |

**UNIQUE** `(clienteId, prioridad, tipo)`.

### 3.9 `cmms_checklist_plantillas`

| Columna | Regla |
|---|---|
| `id text PK` | cuid. |
| `clienteId text NOT NULL FK` | tenant. |
| `nombre text NOT NULL` | visible. |
| `tipoMantenimiento text NULL` | null = aplica a todos. |
| `tipoEquipo text NULL` | null = aplica a todos. |
| `items jsonb NOT NULL` | `[{ id, etiqueta, obligatorio:bool, tipo: bool|texto|numero|foto, opciones?:[] }]`. |
| `activo boolean DEFAULT true` | — |
| `version / createdAt / updatedAt / deletedAt` | — |

Precedencia de resolución (server-side): `(tipoMant + tipoEquipo)` > `(solo tipoMant)` > `(solo tipoEquipo)` > global.

### 3.10 `cmms_push_subscriptions`

`(userId, clienteId, endpoint)` único, payload VAPID, fechas.

### 3.11 Tablas auxiliares

`cmms_filter_presets, cmms_export_filter_presets, cmms_pm_planes, cmms_pm_plantillas, cmms_consola_eventos, applied_migrations, cmms_idempotency_keys` (§18.5).

### 3.12 Triggers y constraints recomendados

- **`set_updated_at`** en todas las tablas con `updatedAt`.
- **`prevent_hard_delete`** en tablas sincronizables → `RAISE EXCEPTION` ante `DELETE` directo (forzar `UPDATE deleted_at`).
- **`fk_cliente_tenant`** verifica que todos los FK secundarios apunten al mismo `clienteId`.
- **CHECK** `(slaPausedAccumMs >= 0)`, `(version >= 1)`.

---

## 4. Multi-tenancy obligatorio

| ID | Regla |
|---|---|
| MT-01 | Toda tabla operativa lleva `clienteId NOT NULL`. |
| MT-02 | El JWT incluye `userId + clienteActivo`; `clienteActivo` se setea tras `ClienteSelector` cuando el usuario tiene >1 cliente. |
| MT-03 | Toda ruta Express ejecuta `requireCliente()` antes de leer/escribir. Excepciones explícitas: `/auth/login`, `/auth/select-client`, `/healthz`. |
| MT-04 | Todo query Drizzle filtra `WHERE clienteId = :clienteActivo`. Snapshot tests evitan regresiones. |
| MT-05 | Códigos humanos (`OT-YYYY-NNNN`, folios `MNT-`, folios `INF-`) son únicos **por cliente**, no globales. |
| MT-06 | Cambio de cliente activo emite nuevo JWT y dispara `queryClient.invalidateQueries()` + reset selectivo de stores IndexedDB por `clienteId`. |
| MT-07 | IndexedDB usa **clave compuesta** `(clienteId, recursoId)` en `snapshots` y filtra `pending_ops` por `clienteId` al drenar. |
| MT-08 | Los blobs offline llevan `clienteId` para evitar fugas cross-tenant si el usuario cambia de cliente antes de sync. |
| MT-09 | Nunca exponer en respuestas datos cuyo `clienteId` no coincida con el JWT. Doble check server-side + asserts en tests. |

---

## 5. Roles, perfiles y permisos

| Rol | Capacidades clave |
|---|---|
| `administrador` | Todo: usuarios, clientes, SLA, plantillas, equipos, datos, reaperturas. |
| `programador` | Configurar plantillas, SLA, planes PM, equipos. Sin gestionar clientes. |
| `supervisor` | Asignar OT, ver KPIs, aprobar informes, cerrar OT. |
| `tecnico` | Resolver sus OT, registrar mantenimientos, firmar informe técnico. |
| `visita` | Solo lectura + scanner + crear mantenimiento si toggle on. |

Perfil `tecnico` vs `visita` controla acceso a campo (scanner, MiDía, captura de fotos). Permiso efectivo = `rol ∪ perfil ∪ overrides puntuales (puedeEditarMantenimientos)`.

Permisos vigentes: `ver_dashboard, ver_mantenimientos, ver_reportes, ver_informes, crear_informe, editar_mantenimiento, crear_ticket, configurar_sla, transicionar_ot, gestionar_usuarios, gestionar_equipos, gestionar_clientes`.

---

## 6. Workflows reales

### 6.1 OT (`cmms_tickets`)

```
borrador ─► abierta ─► asignada ─► en-progreso ─┬─► en-pausa ─► en-progreso
                                                  ├─► resuelta ─► cerrada
                                                  └─► cancelada
borrador ─► rechazada
abierta  ─► cancelada / rechazada
```

| Transición | Permitida a | Side-effects |
|---|---|---|
| `borrador → abierta` | creador / supervisor | calcula `slaResponseDueAt + slaResolutionDueAt`. |
| `abierta → asignada` | supervisor / programador | Setea `asignadoUserId + asignadaAt`. Push al técnico. |
| `asignada → en-progreso` | técnico asignado | Setea `inProgresoAt`. Cierra ventana SLA respuesta (compara con `slaResponseDueAt + pausa`). |
| `en-progreso → en-pausa` | técnico asignado | Setea `slaPausedAt`. Push al supervisor. |
| `en-pausa → en-progreso` | técnico asignado | Suma `(now - slaPausedAt)` a `slaPausedAccumMs`, limpia `slaPausedAt`. |
| `en-progreso → resuelta` | técnico asignado | Opcional crear `cmms_mantenimientos`, persistir checklist resuelto, set `resueltaAt`. |
| `resuelta → cerrada` | supervisor | Cierre formal. |
| `* → cancelada / rechazada` | supervisor con motivo obligatorio | Bloquea SLA. |

### 6.2 Mantenimiento

```
pendiente ─► en-proceso ─► completado
pendiente ─► cancelado
en-proceso ─► cancelado
```

"Vencido" = `estado=pendiente && fecha < hoy`. Derivada en UI.

### 6.3 Equipo

```
operativo ─► falla ─► mantenimiento ─► operativo
operativo ─► mantenimiento ─► operativo
* ─► baja  (set deletedAt y estado=baja)
```

### 6.4 Informe técnico

```
borrador ─► enviado ─► firmado ─► bloqueado
                   └─► (reapertura por administrador, registra evento)
```

Reapertura: copia el `hashFinal` al historial, crea evento `informe.reapertura` con motivo, incrementa `version`.

---

## 7. Sincronización offline-first — especificación quirúrgica

### 7.1 Principios fundacionales

1. **Local-first writes**: toda mutación se aplica primero al cache de React Query (optimistic update) y a la cola local. La UI no espera red.
2. **Granular por recurso REST**: no existe endpoint monolítico. Cada op encolada corresponde a una sola operación HTTP.
3. **Optimistic concurrency con `version`**: el cliente envía `baseVersion` (header `If-Match` o body); el servidor compara y responde 200 + `version+1` o 409 con `serverEntity`.
4. **Idempotencia con `Idempotency-Key`** UUID v4 por op; el servidor cachea el resultado por 24 h en tabla `cmms_idempotency_keys` (clave `(idempotencyKey, userId)`).
5. **Sin DELETE físico** en tablas sincronizables: solo `deletedAt`.
6. **Pull incremental** via `GET /api/sync/snapshot?since=<iso>`.
7. **Background Sync** (Service Worker) cuando el navegador lo soporta; fallback a `online` event listener + polling 15 min.
8. **Particionamiento por cliente activo**: cola filtra por `clienteId`, snapshots usan clave compuesta.

### 7.2 IndexedDB `cmms_sync_v2` — stores

```ts
interface PendingOp {
  id: string;                  // uuid local de la op
  clienteId: string;
  kind:
    | 'EQUIPO_CREATE' | 'EQUIPO_UPDATE'
    | 'MANT_CREATE'   | 'MANT_UPDATE'
    | 'OT_CREATE'     | 'OT_PATCH' | 'OT_TRANSITION'
    | 'OT_COMENTARIO' | 'OT_RESOLVE'
    | 'INFORME_CREATE'| 'INFORME_UPDATE' | 'INFORME_ENVIAR' | 'INFORME_FIRMAR';
  resourceId: string;          // id local o server del recurso
  payload: unknown;            // body JSON (puede llevar refs a blobs)
  blobIds: string[];           // ids dentro del store `blobs`
  baseVersion?: number;        // para If-Match
  idempotencyKey: string;      // UUID v4
  attempts: number;            // contador
  nextRetryAt: number;         // epoch ms
  lastError?: string;          // último error textual
  state: 'pending' | 'in-flight' | 'failed' | 'conflict' | 'done' | 'dropped';
  createdAt: number;
  updatedAt: number;
}

interface BlobEntry {
  id: string;                  // uuid (placeholder `blob:<id>`)
  clienteId: string;
  mime: string;
  size: number;
  data: Blob;                  // contenido binario
  watermark?: { texto: string; insertedAt: number };
  uploadUrl?: string;          // tras solicitarla
  uploadedAt?: number;         // cuando se subió
  finalUrl?: string;           // URL pública final
}

interface SnapshotEntry {
  key: string;                 // `${clienteId}:${entity}:${id}`
  entity: 'equipo' | 'mantenimiento' | 'ot' | 'informe';
  data: unknown;
  version: number;
  fetchedAt: number;
}

interface ConflictEntry {
  id: string;
  opId: string;
  serverEntity: unknown;
  localEntity: unknown;
  serverVersion: number;
  baseVersion: number;
  createdAt: number;
}

interface MetaEntry {
  key: 'lastSyncAt' | 'clienteActivo' | 'deviceId' | 'vapidSubscribed';
  value: unknown;
}

interface IdMapEntry {
  localId: string;
  serverId: string;
  entity: string;
  createdAt: number;
}
```

### 7.3 Ciclo de vida de una op

```
[create]  enqueue(op)         → state=pending,   attempts=0, nextRetryAt=now
[claim]   pickNextDue()       → state=in-flight
[upload]  uploadBlobs(op)     → reemplaza refs blob:<id> por URL final en payload
[send]    fetch(...)
            ├─ 2xx        → state=done, persiste server entity, emit BroadcastChannel
            ├─ 409        → state=conflict + push a conflicts store, UI banner
            ├─ 410        → state=dropped + toast informativo
            ├─ 422        → state=failed + UI muestra issues
            └─ 5xx/network→ state=pending, attempts++, nextRetryAt=now+backoff(attempts)
[drain]   done ops → eliminadas tras 7 días (auditoría)
```

**Backoff**: `min(5min, 5s * 2^attempts)` con jitter `±10%`. `attempts` máximo configurable (default 50; tras eso, op queda `failed` y requiere acción manual).

### 7.4 Política de conflicto (409)

1. Se inserta en `conflicts` con `serverEntity + localEntity + baseVersion + serverVersion`.
2. UI dispara banner "Hay 3 conflictos pendientes" con CTA "Resolver".
3. Modal muestra **diff campo por campo** y permite:
   - **Mantener mi versión** → reenvía con `baseVersion = serverVersion` (nueva op).
   - **Mantener servidor** → descarta op local, actualiza snapshot.
   - **Fusionar manual** → editor con merge por campo.
4. Resolver elimina entrada y reanuda el procesador.

### 7.5 Idempotencia y mutex

- **Idempotency-Key** UUID v4 por op, persistido en `pending_ops.idempotencyKey`. Si una op es reintentada, mantiene la misma key → server devuelve respuesta cacheada idéntica.
- **Mutex local** `inFlightByKey: Map<string, true>` evita encolar la misma transición dos veces. Clave: `${kind}:${resourceId}:${hashPayload}`.
- **Server cache**: tabla `cmms_idempotency_keys` `(key, userId, statusCode, responseBody, expiresAt)` con TTL 24 h.

### 7.6 Manejo de blobs (fotos, firmas)

1. Captura: `MultiPhotoCapture` produce `Blob` comprimido (`canvas.toBlob`, watermark fecha + usuario + tag).
2. Persistencia local: `blobs.put({ id, clienteId, mime, size, data })`.
3. El payload de la op referencia los blobs como `blob:<id>` en arrays (`fotos`, `imagenes`, `firmaTecnico`).
4. Antes del fetch: `uploadBlobs(op)` solicita `POST /api/storage/upload-url`, sube el binario con `fetch PUT signedUrl`, reemplaza el placeholder por la URL final en el payload, marca `blobs.finalUrl + uploadedAt`.
5. Si el upload falla → la op vuelve a `pending` con backoff (no se intenta el JSON sin antes haber subido blobs).
6. **GC**: blobs huérfanos (sin op referenciándolos) > 30 días → purgados.

### 7.7 Pull incremental + BroadcastChannel

- `GET /api/sync/snapshot?since=<iso>&entities=equipos,mantenimientos,ot` devuelve cambios incrementales filtrados por `clienteId`. Server limita `since` a un máximo de 30 días atrás para evitar payloads gigantes; si es mayor, devuelve `412 Precondition Failed` con `oldestAvailable` y el cliente debe hacer full snapshot.
- Tras aplicar, se actualiza `meta.lastSyncAt = serverTime`.
- `BroadcastChannel('cmms_sync')` notifica a otras tabs eventos: `op:done`, `op:conflict`, `snapshot:updated`, `cliente:changed`.

### 7.8 Particionamiento por cliente activo

- Cambio de cliente activo → llamar `selectivePurge(clienteId_anterior, { conservar: ['pending_ops','blobs'] })` que vacía solo `snapshots` del cliente anterior, invalida React Query caches y resetea `lastSyncAt`.
- `pending_ops` and `blobs` se mantienen segregados por `clienteId`; al volver al cliente original, retoma su cola.

### 7.9 Service Worker (Workbox)

- `injectManifest` con `sw-push.js` + `sw-sync.js`.
- Estrategias:
  - `app shell` → CacheFirst, precache hash.
  - `/api/equipos|mantenimientos|ot|sync/snapshot` → NetworkFirst, timeout 4 s, fallback caché 7 d.
  - `/api/storage/*` → no-cache.
- Background Sync: registración `sync-cmms` cuando una op falla por red.
- Periodic Sync: `periodicsync-cmms` cada 15 min (donde soportado).
- Eventos `online`/`offline` → flush manual + actualizar banner.

### 7.10 Errores semánticos del servidor

| HTTP | Significado | Acción cliente |
|---|---|---|
| 200/201 | OK | aplicar `entity + version`, op `done`. |
| 204 | OK sin body | op `done`. |
| 400 | request mal formado | op `failed` (bug cliente). |
| 401 | token inválido | logout + redirigir login. |
| 403 | sin permiso | op `failed` + toast. |
| 404 | recurso no existe | op `dropped` + invalidar caché. |
| 409 | conflicto de version | a `conflicts`. |
| 410 | recurso eliminado | op `dropped`. |
| 412 | precondition (snapshot fuera de rango) | full snapshot. |
| 422 | validation zod | op `failed` + mostrar issues. |
| 423 | locked (informe firmado) | op `failed` + UI. |
| 429 | rate limit | aplicar `Retry-After`. |
| 5xx | server | retry con backoff. |

---

## 8. TAG y QR

### 8.1 Fórmula oficial (objetivo §18.1)

```
TAG = CODIGO_SUCURSAL + "." + CODIGO_TIPO + "." + CORRELATIVO_3_DIGITOS
Ejemplo: 21-STK.AC.001
```

### 8.2 Estado actual y migración

Mientras no exista `cmms_sucursales + cmms_tipos_equipo`, los TAGs siguen el patrón del CSV de EECOL (texto libre validado por whitelist). El plan §18 introduce backfill garantizando unicidad por cliente.

### 8.3 Reglas TAG vigentes

| ID | Regla |
|---|---|
| TAG-01 | `(clienteId, tag)` es único. |
| TAG-02 | TAG no editable sin evento `equipo.retag` (auditoría). |
| TAG-03 | QR transporta `TAG` o URL `?tag=TAG` — nunca todo el activo. |
| TAG-04 | Escanear TAG inexistente → ofrecer "Crear equipo" solo si el rol lo permite. |
| TAG-05 | Conflicto offline: gana la primera op en aplicar (constraint único); la otra recibe 409 + propuesta de renombrar. |
| TAG-06 | Equipo en baja conserva TAG (filtrado por `deletedAt IS NULL` por defecto). |
| TAG-07 | Generación de correlativo: client-side al crear (3 dígitos, zero-pad), valida unicidad local + remota en línea. Si offline, optimista con sufijo `-PEND` que se renombra al sync (entrada en `id_map`). |

---

## 9. Reglas operativas por pantalla (catálogo extendido)

| # | Pantalla | Ruta | Fuente datos | Móvil offline (técnico) | Desktop online (supervisor) | Reglas críticas |
|---|---|---|---|---|---|---|
| 1 | Login | `/login` | `cmms_usuarios` | bypass por sesión persistida; PIN local validado contra hash cacheado en JWT cuando aplica. | auth normal, `mustChangePin` forzado. | MT-02; E16. |
| 2 | ClienteSelector | `/select-client` | `cmms_clientes` vía JWT | lista cacheada. | live. | MT-02. |
| 3 | Dashboard | `/` | equipos + tickets + mantenimientos | snapshot + KPIs cliente-side. | live + KPIs SLA. | `deletedAt`; filtros persistentes. |
| 4 | MiDía | `/mi-dia` | OT asignadas a mí | lista local con CTA Iniciar/Continuar/Resolver. FAB scanner. | vista informativa. | transición one-tap optimista. |
| 5 | Scanner | `/scanner` | equipos local | cámara + 4 quick actions. | + upload imagen + GPS. | TAG inexistente → modal "Crear equipo". |
| 6 | Equipos | `/equipos` | equipos | lista filtrable, búsqueda, captura fotos offline. | + import CSV, edición masiva. | crear bloqueado sin cliente activo. |
| 7 | EquipoDetalle | `/equipos/:tag` | equipo + mant + ot + informes | ficha + QR + histórico Recharts. | + edición avanzada. | acciones bloqueadas si `estado=baja`. |
| 8 | Mapa | `/mapa` | equipos lat/lng | vista por almacén; marker → detalle. | filtros estado/área/sucursal. | z-index ≥ 1100 sobre Leaflet. |
| 9 | Mantenimientos | `/mantenimientos` | mantenimientos | crear/editar/completar offline + fotos + checklist. | + edición libre. | bloqueado si tag no existe. |
| 10 | Calendario | `/calendario` | mantenimientos + PM | lectura. | programar fechas. | — |
| 11 | Plantillas PM | `/pm-plantillas` | `cmms_pm_plantillas` | lectura. | CRUD. | solo programador/admin. |
| 12 | Planes PM | `/pm-planes` | `cmms_pm_planes` | lectura. | CRUD + materialización. | — |
| 13 | KPIs | `/kpis` | agregados | vista limitada. | full. | KPI §14. |
| 14 | Informes HVAC | `/informes` | informes | crear borrador, capturar mediciones+firma técnico. | revisar, reabrir si admin. | firma cliente exige segundo usuario. |
| 15 | InformeEditor | `/informes/:id` | informe + equipo | editor mobile con steps. | editor full + export PDF. | hash inmutable post-firma. |
| 16 | OT listado | `/tickets` (alias `/ordenes-trabajo`) | tickets | filtros + badge SLA. | + crear con asignación. | estados §6.1. |
| 17 | OT detalle | `/tickets/:id` | + eventos + comentarios | transiciones one-tap, comentarios offline. | asignar, reabrir. | optimistic lock + idempotencia. |
| 18 | SLA Config | `/sla-config` | `cmms_sla_config` | lectura informativa. | edición grilla 4×4. | permiso `configurar_sla`. |
| 19 | Reportes | `/reportes` | agregados | export CSV/PDF cached. | export full. | no muta. |
| 20 | Administración | `/usuarios` | usuarios + usuarios_clientes | — | CRUD + per-cliente toggles. | admin (clientes) y programador (usuarios). |
| 21 | Consola | `/consola` | `cmms_consola_eventos` | log local. | log completo. | sin secretos. |
| 22 | Configuración | `/configuracion` | settings + push | activar push, cambio PIN, sync manual. | igual. | cambio PIN registra evento. |

---

## 10. Botones críticos

| Botón | Regla | Flujo |
|---|---|---|
| Crear / Guardar | Idempotency-Key + mutex local. | validar zod → optimistic cache → enqueue → fetch → reconciliar. |
| Resolver OT | bloquea hasta completar checklist obligatorio. | `POST /api/ot/:id/resolver` con `If-Match` + `Idempotency-Key`. |
| Firmar informe | segundo usuario + clave secreta. | hash final server-side. |
| Sincronizar manual | `SyncTrayButton` → `processor.flush()` único por click. | — |
| Exportar / Imprimir | no muta. | render cliente-side. |
| Dar baja equipo | confirmación fuerte + verificación de pendientes. | `deletedAt` server-side. |
| Reset local | confirmación 2 pasos + evento crítico. | `selectivePurge('all')`. |

---

## 11. Tablas de verdad

### 11.1 Crear equipo

| Cliente activo | TAG válido whitelist| Único `(cliente,tag)` | Permite | Resultado |
|---|---|---|---|---|
| No | n/a | n/a | No | ClienteSelector. |
| Sí | No | n/a | No | error inline. |
| Sí | Sí | No | No | "ya existe en este cliente". |
| Sí | Sí | Sí | Sí | optimistic + `EQUIPO_CREATE`. |

### 11.2 Crear mantenimiento

| Equipo existe | Vigente | Técnico | Fecha | Permite |
|---|---|---|---|---|
| No | n/a | n/a | n/a | bloquear. |
| Sí | No | n/a | n/a | "equipo en baja". |
| Sí | Sí | No | Sí | exigir técnico. |
| Sí | Sí | Sí | No | exigir fecha. |
| Sí | Sí | Sí | Sí | OK. |

### 11.3 Baja de equipo

| OT abiertas | MNT pendientes | Permiso | Acción |
|---|---|---|---|
| Sí | Sí | No | bloquear. |
| Sí | Sí | Sí | confirmación fuerte. |
| No | Sí | Sí | advertir. |
| No | No | Sí | `deletedAt + estado=baja`. |
| – | – | No | 403. |

### 11.4 Resultado de sync

| Backend | Cola local | Acción cliente |
|---|---|---|
| 200/201 | eliminar op (tras 7 días) | update version. |
| 204 | done | no-op. |
| 409 | conflicts | UI diff. |
| 410 | dropped | toast. |
| 422 | failed | error específico. |
| 423 | failed | "documento bloqueado". |
| 5xx/network | pending | backoff. |

---

## 12. Flujo móvil offline-first (paso a paso)

### 12.1 Apertura de la app sin red

1. SW responde el shell desde caché → React mounts.
2. `useAuth()` lee JWT de localStorage; si expirado y sin red → banner "Modo offline limitado, algunas acciones requieren login".
3. `useDataHydration()` lee `snapshots` por `clienteActivo` → renderiza listas inmediatamente.
4. `useSyncStatus()` chequea `pending_ops.count + lastSyncAt`; muestra badge "🔴 23 pendientes · última sync hace 12 min".
5. UI funcional al 100 % en lectura y escritura.

### 12.2 Crear OT desde Scanner offline

1. Técnico tap FAB scanner → cámara abre vía html5-qrcode.
2. Lee QR `?tag=21-STK.AC.001`.
3. Busca en `snapshots` → encuentra equipo → muestra ficha + quick actions.
4. Tap "Crear OT correctiva" → modal con título, descripción, prioridad. Asignado inferido del usuario actual.
5. Click "Guardar":
   1. Validación zod en cliente.
   2. Genera `id = cuid()`, `codigo = OT-2026-PEND-<short>` (sufijo `-PEND` que el server reemplaza).
   3. Si hay fotos: cada `File` → comprimir → `Blob` → `blobs.put({ id: blobId, clienteId, mime, size, data, watermark })`.
   4. Payload referencia `imagenes: ['blob:<blobId>']`.
   5. `enqueueOp({ kind: 'OT_CREATE', payload, blobIds:[blobId], baseVersion: 1, idempotencyKey: uuid() })`.
   6. Optimistic update: React Query inserta la OT en la lista con flag `_pending: true`.
   7. UI cierra modal, navega a `/tickets/:localId` mostrando badge "📤 Pendiente sync".

### 12.3 Reconexión y drenaje

1. SW detecta `online` o el navegador despierta `sync-cmms`.
2. `syncProcessor.runUntilEmpty()` se invoca con un mutex global.
3. Para cada op (FIFO, filtrada por `clienteActivo` y `nextRetryAt <= now`):
   1. Marca `state=in-flight`.
   2. Si `blobIds.length > 0`: para cada blob, `POST /api/storage/upload-url` → `PUT signedUrl` → reemplaza `blob:<id>` por `finalUrl` en payload.
   3. `fetch('/api/ot', { method:'POST', headers:{ 'Idempotency-Key': op.idempotencyKey, 'If-Match': String(op.baseVersion) }, body: JSON.stringify(payload) })`.
   4. Procesa respuesta según §7.10.
   5. Si 200/201: persiste `serverEntity` en `snapshots`, mapea `localId → serverId` en `id_map`, dispara `BroadcastChannel.postMessage({type:'op:done',entity:'ot',serverId})`.
4. UI escucha el broadcast → React Query refetcha o reconcilia caché → badge "📤 Pendiente" desaparece, se reemplaza por `codigo = OT-2026-0042` real.

### 12.4 Conflicto (otro técnico modificó la misma OT)

1. Server responde 409 con `serverEntity + serverVersion`.
2. Op pasa a `conflicts`; banner amber "1 conflicto" aparece.
3. Usuario tap → modal diff. Acciones:
   - "Mantener mío": nueva op `OT_PATCH` con `baseVersion = serverVersion + 1` (próxima escritura).
   - "Mantener servidor": descarta op, snapshot ya tiene `serverEntity`.
   - "Fusionar": editor campo a campo.
4. Resuelto → conflict store se vacía.

### 12.5 Firma de informe técnico en terreno

1. Técnico abre `/informes/:id` (creado previamente).
2. Completa checklist 24 ítems, mediciones, hallazgos, fotos.
3. Tap "Enviar": pide `claveFirma` (4-6 dígitos), genera `claveFirmaHash = sha256(clave)`.
4. `INFORME_ENVIAR` encolada: estado → `enviado`.
5. Sync → server registra hash, push al cliente.
6. Cliente (otro usuario) abre el informe en su dispositivo, ingresa la clave, firma con dedo en canvas.
7. `INFORME_FIRMAR` encolada con `firmaCliente` (data-URL → blob), clave ingresada.
8. Server valida `sha256(clave) === claveFirmaHash`, computa `hashFinal = sha256(canonicalize(payload))`, setea `firmadoPorUserId/IP/At`, transición a `firmado`.

### 12.6 Reset local controlado

1. Configuración → "Borrar datos locales".
2. Confirmación 2 pasos ("Esto descartará 23 cambios sin sincronizar").
3. `selectivePurge('all')` borra `snapshots, blobs, conflicts, meta` pero conserva `pending_ops` si hay para no perder datos.
4. Reload.

---

## 13. Flujo desktop online (paso a paso)

### 13.1 Login y selección de cliente

1. Supervisor abre `/login`, ingresa email + PIN.
2. `POST /api/auth/login` → JWT base + lista clientes.
3. Si >1 cliente → `/select-client`; tap elige → `POST /api/auth/select-client` → JWT con `clienteActivo`.
4. App hidrata: paralelo `getEquipos + getOt + getMantenimientos + slaConfig + usuarios`.
5. Dashboard se renderiza con KPIs en vivo + banner verde "Online".

### 13.2 Asignar OT a técnico

1. Supervisor abre `/tickets`, filtra `estado=abierta`, tap OT.
2. Drawer detalle se abre, click "Asignar".
3. Dropdown técnicos del cliente activo.
4. Selección → `POST /api/ot/:id/transition` body `{to:'asignada', asignadoUserId:'u-...'}` con `If-Match: 3`.
5. Server valida transición, setea `asignadoUserId + asignadaAt`, inserta `cmms_ot_eventos {kind:'asignacion'}`, dispara Web Push al técnico.
6. Push llega al móvil del técnico (incluso si app cerrada).
7. UI desktop refresca lista → OT pasa a estado `asignada` con avatar del técnico.

### 13.3 Resolver desde supervisor (excepción)

1. Solo si el supervisor mismo trabajó la OT.
2. Click "Resolver" → modal con campos hallazgos, acciones, opcional "Generar mantenimiento".
3. `POST /api/ot/:id/resolver`:
   - Si `generarMantenimiento=true`: server crea `cmms_mantenimientos` `source=ot, otId=...`, devuelve `mantenimientoId`.
   - Transición OT → `resuelta`, set `resueltaAt`, inserta evento.
4. UI redirige a `/mantenimientos/:id` para revisar.

### 13.4 SLA config

1. Admin/programador → `/sla-config`.
2. Grilla 4×4 (prioridad × tipo) con dos inputs por celda (responseMin, resolutionMin).
3. Click "Guardar": `PUT /api/sla-config` con array completo y `If-Match`.
4. Server upserts por `(clienteId, prioridad, tipo)`.
5. Próximas OT abiertas usan la nueva grilla; las ya `abierta` mantienen su due original.

### 13.5 Resolución de conflicto en desktop

1. Banner amber "3 conflictos pendientes" arriba del header.
2. Click → modal lista con preview de cada conflicto.
3. Para cada uno, mismo flujo que móvil (keep-mine / keep-theirs / merge).
4. Supervisores con permiso pueden forzar `keep-mine` aún si tiene cambios incompatibles.

### 13.6 Reapertura de informe firmado

1. Admin abre `/informes/:id` en estado `firmado`.
2. Click "Reabrir" (visible solo a administrador).
3. Modal pide motivo obligatorio.
4. `POST /api/informes/:id/reabrir` con `If-Match`.
5. Server inserta evento `informe.reapertura`, copia `hashFinal` al historial, setea estado `borrador`, incrementa `version`.
6. UI permite edición; al re-enviar se calculará nuevo `hashFinal`.

---

## 14. KPIs corregidos

| KPI | Fórmula | Fuente |
|---|---|---|
| Disponibilidad | `count(equipos.estado='operativo') / count(equipos no-baja)` | `cmms_equipos` |
| MTBF | promedio entre `mantenimientos.tipo='Correctivo'.fecha` por equipo | `cmms_mantenimientos` |
| MTTR | promedio (`resueltaAt - inProgresoAt`) en OT correctivas | `cmms_tickets` |
| Cumplimiento PM | `mantenimientos completados a tiempo / programados` | mantenimientos + planes PM |
| Backlog | `count(ot.estado IN abierta,asignada,en-progreso,en-pausa)` | tickets |
| % SLA Respuesta | `count(asignadaAt ≤ slaResponseDueAt + pausa) / total` | tickets |
| % SLA Resolución | `count(resueltaAt ≤ slaResolutionDueAt + pausa) / total` | tickets |
| OT vencidas activas | `count(slaResolutionDueAt + pausa < now AND estado activo)` | tickets |
| Tiempo de respuesta | `asignadaAt - fechaCreacion` | tickets |
| Reincidencia | OT correctivas repetidas por tag | tickets |

Reglas KPI:

- KPI-01 Excluir `deletedAt`.
- KPI-02 MTTR solo OT `resuelta/cerrada`.
- KPI-03 Backlog excluye `cerrada/cancelada/rechazada`.
- KPI-04 Cumplimiento PM requiere fecha programada + ejecución.
- KPI-05 SLA excluye OT `borrador/cancelada/rechazada`.
- KPI-06 Sumar pausa actual al due antes de evaluar.

---

## 15. Auditoría y trazabilidad

Tabla central: `cmms_consola_eventos`. Para OT específicamente `cmms_ot_eventos` (append-only).

| Acción | Nivel | Detalle |
|---|---|---|
| login / logout / cambio PIN | Medio | IP, user-agent. |
| crear / editar cliente | Alto | diff. |
| crear / editar equipo | Alto | diff. |
| baja equipo | Crítico | motivo + confirmación. |
| transición OT | Alto | from→to + actor. |
| resolver OT | Alto | + mantenimientoId. |
| firmar informe | Crítico | hash + firmante + IP. |
| reapertura informe | Crítico | requiere admin + motivo. |
| reset IndexedDB local | Crítico | solo botón Config con confirmación. |
| migración DB (post-merge) | Crítico | log stdout + `applied_migrations`. |

---

## 16. Contrato API REST granular

### 16.1 Headers comunes

```
Authorization: Bearer <jwt>
If-Match: <version>           # PATCH / transition / resolver
Idempotency-Key: <uuid-v4>    # POST / PATCH / transition / resolver
Content-Type: application/json
```

### 16.2 Endpoints clave

| Método| Ruta | Propósito |
|---|---|---|
| POST | `/api/auth/login` | login email+PIN |
| POST | `/api/auth/select-client` | seleccionar cliente |
| POST | `/api/auth/refresh` | refrescar JWT |
| GET/POST/PATCH | `/api/equipos`, `/api/equipos/:tag` | CRUD |
| GET/POST/PATCH | `/api/mantenimientos`, `:id` | CRUD |
| GET/POST | `/api/ot`, `:id` | listado/creación/lectura |
| PATCH | `/api/ot/:id` | edición |
| POST | `/api/ot/:id/transition` | máquina estados |
| POST | `/api/ot/:id/comentarios` | append comentario |
| POST | `/api/ot/:id/resolver` | resolver + opcional mantenimiento |
| GET/PUT | `/api/sla-config` | grilla por cliente |
| GET | `/api/checklist-plantillas/resolver?tipoMant&tipoEquipo` | resolver plantilla |
| POST | `/api/informes`, GET `/:id` | crear/leer |
| PATCH | `/api/informes/:id` | edición |
| POST | `/api/informes/:id/enviar` | borrador→enviado |
| POST | `/api/informes/:id/firmar` | enviado→firmado |
| POST | `/api/informes/:id/reabrir` | firmado→borrador |
| POST | `/api/storage/upload-url` | URL firmada upload |
| GET | `/api/sync/snapshot?since=<iso>&entities=` | pull incremental |
| POST | `/api/push/subscribe` | suscripción Web Push |
| POST | `/api/push/test` | enviar test |
| GET | `/api/healthz` | health |
| GET | `/api/usuarios` | gestión |

### 16.3 Forma estándar de respuesta

```jsonc
// 200 OK
{ "entity": { /* objeto */ }, "version": 7 }

// 409 Conflict
{ "error": "version_conflict", "serverVersion": 8, "serverEntity": { /* */ } }

// 422 Validation
{ "error": "validation_error", "issues": [{"path":["titulo"],"message":"requerido"}] }

// 410 Gone
{ "error": "resource_deleted", "deletedAt": "2026-05-24T..." }

// 423 Locked
{ "error": "resource_locked", "lockedReason": "informe_firmado" }
```

---

## 17. Aspecto / Prompt UI-UX integrado

> Pegar este bloque al sub-agente DESIGN o al sistema de mockups cuando se generen variantes.

```text
SISTEMA DE DISEÑO — CMMS HVAC PRO

Identidad: aplicación profesional B2B para gestión de activos HVAC.
Personalidad: industrial, confiable, ordenada, alto contraste, mobile-first, responsive auto-ajustable.

PALETA
- Fondo base: #0d1117 (deep ink) / claro: #f8fafc
- Fondo superficie: #0f1320 / claro: #ffffff
- Fondo card: #131a2c / claro: #ffffff con sombra
- Bordes: rgba(255,255,255,0.10) / claro: rgba(0,0,0,0.08)
- Texto primario: #e6edf3 / claro: #0f172a
- Texto secundario: #94a3b8 / claro: #475569
- Texto faint: #64748b / claro: #94a3b8
- Acento principal: cyan-400/500 (#22d3ee / #06b6d4)
- Acento secundario: amber-400 para CTAs destacadas
- Semáforo: emerald-400 ok, amber-400 warning, red-500 error

TIPOGRAFÍA
- Sans: Inter (UI), Barlow Semibold (titulares)
- Jerarquía: title-2xl / title-xl / heading-lg / body-base / caption-xs
- Tabular-nums en KPIs

LAYOUT RESPONSIVE
- breakpoints sm 640, md 768, lg 1024, xl 1280
- mobile-first: drawer + bottom nav fijo + FAB scanner
- desktop ≥ lg: sidebar fija + main scroll
- z-index escala: contenido 0–10, sticky 20, modal 50, sidebar 1100, dropdown 1200, drawer-button 1300

COMPONENTES
- Cards: rounded-xl, border 1px, shadow-sm, padding 16-20
- Botón primario: bg cyan-500/15 + text cyan-300 + border cyan-500/40 + drop-shadow neón
- Nav activo: bg cyan-500/15 con glow
- Inputs: 48 px alto mobile, focus-ring cyan-400
- Badges: rounded-full, text-[10px], colores semáforo
- Skeleton: pulse + bg-white/5
- Animaciones: 150-200 ms ease-out

ACCESIBILIDAD
- Touch targets ≥ 44×44
- Contraste AA ambos temas
- aria-labels en íconos
- Soporte teclado completo
- prefers-reduced-motion respetado

INTERACCIÓN MÓVIL
- Long-press 550 ms para reordenar menú
- Swipe lateral abre/cierra drawer
- FAB scanner siempre visible
- Vibración 30 ms en confirmaciones
- Banner offline cuando navigator.onLine = false

INTERACCIÓN DESKTOP
- Atajos: / foco búsqueda, g d dashboard, g o OT, ? ayuda
- Tablas densas con sticky header, sort, export inline
- Filtros chips horizontales persistentes en localStorage
- Tooltip portal en hover-supported
```

---

## 18. Plan de cierre de brechas (roadmap)

| # | Brecha | Acción | Impacto |
|---|---|---|---|
| 18.1 | Falta `cmms_sucursales`. | Crear `(id, clienteId, codigo, nombre, ciudad, region, activo, version)`. FK desde `cmms_equipos.sucursalId`. Migración backfill desde `equipos.almacen`. | Habilita TAG estandarizado §8. |
| 18.2 | Falta `cmms_tipos_equipo`. | `(codigo PK por cliente, descripcion, activo)`. Migración whitelist → tabla. | Validación catálogo. |
| 18.3 | OpenAPI desincronizado SLA `responseMinutes` vs `responseMinutos`. | Renombrar server-side a `responseMinutos`, regenerar codegen. | TS limpio cmms-hvac. |
| 18.4 | Pull-sync no usado por todos los recursos. | Extender `/api/sync/snapshot` a `informes + checklists`. | Convergencia total. |
| 18.5 | Idempotency cache en memoria. | Mover a `cmms_idempotency_keys` con TTL. | Resiliencia a restart. |
| 18.6 | Background Sync solo registration. | Migrar a `injectManifest` con handlers `sync` y `periodicsync`. | Real background sync. |
| 18.7 | E2E offline. | Playwright `context.setOffline(true)` cubriendo CRUD airplane-mode, reconexión, conflicto, idempotencia. | Anti-regresión. |
| 18.8 | Compresión de payloads. | Activar `compression()` en Express; `Accept-Encoding: br` desde SW. | Latencia reducida. |
| 18.9 | Métricas de cola. | Endpoint `/api/admin/sync-metrics` agregando latencia op, retries promedio. | Observabilidad. |

---

## 19. Matriz móvil ↔ desktop

| Caso de uso | Móvil offline (técnico) | Desktop online (supervisor) |
|---|---|---|
| Hidratar app | snapshots → render inmediato; pull en background. | snapshots + pull paralelo; banner "actualizando". |
| Escanear QR | cámara → tag en snapshot → ficha o crear. | + upload imagen + GPS. |
| Crear mantenimiento con fotos | data-URL en blob store + op MANT_CREATE + checklist runner. | drag-drop + checklist full. |
| Asignar OT | dropdown técnicos limitado; queue OT_PATCH. | dropdown completo + push al técnico. |
| Resolver OT + mantenimiento | gating obligatorio; OT_RESOLVE encolada; mantenimiento creado server `source=ot`. | mismo + revisión hallazgos. |
| Firmar informe | técnico setea claveFirmaHash; cliente firma con segundo login. | admin reabre con motivo. |
| Exportar PDF | jsPDF sobre snapshot. | full export. |
| Mapa | snapshot lat/lng; tiles cached (NetworkFirst). | tiles live + filtros. |
| Conflicto sync | banner amber + modal diff. | igual; supervisor puede forzar keep-mine. |
| Cambio cliente activo | reset selectivo + invalidate RQ. | + advertencia si hay pendientes. |

---

## 20. Criterios de aceptación funcional

| ID | Criterio |
|---|---|
| CA-01 | No se puede crear equipo, OT, mantenimiento ni informe sin `clienteActivo`. |
| CA-02 | Todas las tablas operativas tienen `clienteId NOT NULL` y todo query filtra. |
| CA-03 | No se puede crear mantenimiento sin equipo existente y vigente. |
| CA-04 | Mutaciones offline aparecen localmente al instante (optimistic). |
| CA-05 | Al reconectar, ops encoladas aplican respetando `If-Match + Idempotency-Key`. |
| CA-06 | Conflictos producen 409 con `serverEntity` y resolución asistida. |
| CA-07 | Bajas se propagan como `deletedAt`; nunca DELETE físico. |
| CA-08 | Operaciones fallidas con 5xx/red permanecen en cola con backoff exponencial. |
| CA-09 | Doble-click jamás duplica registros (Idempotency-Key + mutex). |
| CA-10 | KPIs excluyen `deletedAt` y respetan exclusiones §14. |
| CA-11 | Documentos firmados no se editan sin reapertura auditada. |
| CA-12 | TAGs únicos `(clienteId, tag)` y nunca colisionan entre clientes. |
| CA-13 | Menú lateral, dropdowns y banners están sobre cualquier mapa (z ≥ 1100). |
| CA-14 | Rutas mobile y desktop son las mismas; cambio de layout 100 % CSS responsive. |
| CA-15 | Cambio de cliente activo invalida cachés y refetchea sin recargar. |
| CA-16 | Background Sync intenta drenar la cola al volver red (donde soportado). |
| CA-17 | Blobs persistidos sobreviven cierre/relanzamiento del browser. |
| CA-18 | Pull `snapshot?since=` devuelve cambios filtrados por cliente activo. |

---

## 21. Pruebas mínimas obligatorias

```text
[Jerarquía]
- Intentar crear equipo sin clienteActivo → 401/403
- Crear cliente → asignar usuario → crear equipo → permitido

[Offline móvil]
- Cortar red → crear MNT con 2 fotos → verificar pending_ops and blobs
- Reconectar → ver MNT en Postgres con fotos subidas
- Reabrir app sin red → MNT visible desde snapshot

[Concurrencia]
- Dos terminales editan misma OT baseVersion=3 → uno 200, otro 409
- Reintento del 409 tras refetch → 200

[Idempotencia]
- Mismo Idempotency-Key reenviado → server devuelve respuesta cacheada idéntica

[Tag conflict]
- A y B crean (cliente=X, tag=21-STK.AC.001) offline → al sync, uno 200, otro 409

[Roles]
- Técnico no asignado intenta resolver OT ajena → 403
- Visita intenta firmar informe → 403

[Auditoría]
- Cada transición OT crea fila en cmms_ot_eventos
- Reapertura informe crea evento crítico

[Background sync]
- SW registra sync-cmms; al volver red, drena
- Pull 15 min en foreground

[Multi-tenant]
- Usuario con 2 clientes, cambia activo, no ve datos del anterior en lista
- pending_ops del cliente A persisten; al volver a A se drenan
```

---

## 22. Convenciones finales y guardrails para IA Studio

### 22.1 Convenciones

- Idioma UI: español-CL. Moneda CLP. Fechas `dd-MM-yyyy`. Horas 24 h.
- Versionado schemas: cambios en `lib/db/src/schema` → `pnpm --filter @workspace/db run push`; migraciones one-shot en `artifacts/api-server/src/lib/runOneShotMigrations.ts`.
- OpenAPI primero: cualquier campo nuevo en DB → reflejarlo en `lib/api-spec/openapi.yaml` y regenerar `pnpm --filter @workspace/api-spec run codegen`.
- Logging server: `req.log` en handlers, `logger` singleton fuera. Nunca `console.log` en servidor.
- Theming: `useTheme()` + CSS vars `--cmms-*`; nunca hardcodear colores.
- PWA: instalable, SW Workbox, cache NetworkFirst 4 s para snapshots, fallback 7 d.
- Compatibilidad legacy: `/tickets` alias `/ordenes-trabajo`; estados antiguos normalizados en backfill.

### 22.2 Guardrails (rechazo automático)

IA Studio debe marcar como defecto cualquier código que:

1. Cree recurso operativo sin `clienteId` o sin `clienteActivo`.
2. Use `POST /api/sync` monolítico.
3. Use `uuid_sync` o `sync_queue` como tabla del servidor.
4. Haga `DELETE` físico en tablas sincronizables.
5. Ignore `deletedAt` en reads.
6. Olvide `If-Match` o `Idempotency-Key` en mutaciones.
7. Permita doble-click sin mutex + Idempotency-Key.
8. Edite informes firmados sin reapertura.
9. Hardcodee credenciales, URLs de Neon o claves VAPID.
10. Filtre `clienteId` en JS post-fetch en lugar de en SQL.
11. Use estados antiguos `abierto/resuelto/cerrado` (con underscore) en nuevo código.
12. Ponga `console.log` en server.
13. Olvide regenerar codegen tras cambiar OpenAPI.
14. Use Dexie en lugar del wrapper IndexedDB nativo del proyecto.
15. Genere endpoints sin `requireUser + requireCliente`.

---

# Fin del documento — Reglas de negocio v2026-05-24 rev. 2
