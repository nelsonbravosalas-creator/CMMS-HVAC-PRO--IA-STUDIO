# CMMS HVAC PRO — Prompt de Reparación Arquitectural (Auditoría 2026-06-15)

> **Origen:** Auditoría comparativa entre `claude/project-audit-refactor-ly9mb3` (rama de referencia con documentación de arquitectura) y el estado actual del código.
> **Propósito:** Guiar a un agente IA o desarrollador a reparar el proyecto de forma sistemática y sin romper lo que ya funciona.
> **Estado del proyecto:** ~45% funcional. Módulos de CRUD básico, auth y UI están operativos. Sincronización, firma digital, multi-tenancy profundo y manejo de errores están rotos o incompletos.

---

## CONTEXTO DEL PROYECTO

**CMMS HVAC PRO** es una aplicación mobile-first multi-tenant para gestión de mantenimiento de equipos HVAC. Funciona offline-first: el cliente guarda todo en IndexedDB (Dexie v14) y sincroniza con un servidor Express + PostgreSQL (Neon) cuando hay conexión.

**Stack:**
- Frontend: React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4 + Wouter (router) + Zustand (store) + Dexie (IndexedDB) + TanStack Query
- Backend: Express en `server.ts` (monolito, ~2000 líneas)
- DB: PostgreSQL vía `@neondatabase/serverless`
- IA: Google Gemini (`@google/genai`)
- PDF: jsPDF + html2canvas
- QR: `@yudiel/react-qr-scanner` + `html5-qrcode`

**Fuente de verdad del negocio:** `REGLAS_DE_NEGOCIO.md` (60KB). Cualquier divergencia entre código y ese documento es un bug.

---

## MÓDULOS FUNCIONALES (NO TOCAR sin revisar primero)

Estos módulos están completos y funcionando. Solo tocarlos si el fix lo requiere explícitamente:

- ✅ Login con email + PIN (AuthContext.tsx, Login.tsx)
- ✅ Selector de cliente (ClientSelector.tsx)
- ✅ CRUD equipos/assets (Assets.tsx, Equipos.tsx, DetalleEquipo.tsx, useAssets.ts)
- ✅ CRUD órdenes de trabajo / tickets (Tickets.tsx, OrdenesServicio.tsx, TicketForm.tsx, useTickets.ts)
- ✅ CRUD mantenimientos preventivos (Mantenimientos.tsx, useMantenimientos.ts)
- ✅ Schema IndexedDB Dexie v14 con 16 tablas (src/db/database.ts)
- ✅ Zustand stores: useAppStore, useSyncStore, useAuthStore, useUiStore
- ✅ Componentes reutilizables: ErrorBoundary, SyncIndicator, StatusIndicator, SearchableSelect
- ✅ Generación de etiquetas QR (QRLabelModal.tsx)
- ✅ Scanner QR básico (ScannerQR.tsx)

---

## BUGS CRÍTICOS A REPARAR (TIER 1 — Bloquean producción)

### BUG-01: Sync solo hace PUSH, nunca PULL incremental

**Archivo:** `src/services/syncEngine.ts`

**Problema:** `triggerSync()` solo envía operaciones pendientes (POST /api/sync) pero nunca descarga cambios del servidor. En un entorno multi-device, un técnico B nunca verá los cambios del técnico A.

**Regla violada:** REGLAS_DE_NEGOCIO.md §7.7 ("Pull incremental: GET /api/sync/snapshot?since=ISO&clienteId=X")

**Solución requerida:**
1. Implementar en `server.ts` el endpoint `GET /api/sync/snapshot` que acepte `since` (ISO timestamp) y `clienteId` como query params, y devuelva todos los registros modificados después de `since` para ese cliente.
2. En `src/services/syncEngine.ts`, después de cada push exitoso, hacer un GET a ese endpoint y actualizar las tablas Dexie locales con `db.table.put(record)` para cada entidad recibida.
3. Guardar el timestamp de última sincronización en `db.meta.put({ key: 'lastSyncAt', value: new Date().toISOString() })`.
4. En el pull, usar `lastSyncAt` de meta store como valor de `since`.

```typescript
// Estructura esperada del endpoint GET /api/sync/snapshot
// Response: { equipos: [...], tickets: [...], mantenimientos: [...], usuarios: [...], serverTime: ISO }
```

---

### BUG-02: Conflictos 409 son ignorados silenciosamente

**Archivo:** `src/services/syncEngine.ts` líneas 105-143

**Problema:** Cuando el servidor responde 409 (conflicto de versión optimista), el cliente no hace nada. Los datos divergen permanentemente sin que el usuario lo sepa.

**Regla violada:** REGLAS_DE_NEGOCIO.md §7.4 ("409 con `serverEntity`; UI ofrece keep-mine / keep-theirs / merge")

**Solución requerida:**
1. En el handler de respuesta sync, detectar status 409.
2. Guardar el conflicto en `db.conflicts.add({ id: uuid(), localOp: op, serverEntity: response.serverEntity, detectedAt: new Date().toISOString(), resolved: false })`.
3. Mostrar badge rojo en `SyncIndicator.tsx` cuando `db.conflicts.count() > 0`.
4. Crear componente `ConflictResolutionModal.tsx` con 3 opciones: "Mantener mi versión", "Usar versión del servidor", "Ver diferencias" (diff visual de campos).
5. Al resolver, re-encolar la op ganadora o descartarla según elección.

---

### BUG-03: Sin Idempotency-Key — doble submit crea duplicados

**Archivos:** `src/services/syncEngine.ts`, `src/repositories/BaseRepository.ts`

**Problema:** Si el usuario presiona "Guardar" dos veces rápido, o si la red falla después de que el servidor procesó el request pero antes de devolver la respuesta, se crean registros duplicados.

**Regla violada:** REGLAS_DE_NEGOCIO.md §7.5 ("Idempotency-Key UUID v4 en header o body; cache servidor 24h")

**Solución requerida:**
1. En `BaseRepository.enqueueSync()`, generar un `idempotencyKey: crypto.randomUUID()` y guardarlo con la operación.
2. En `syncEngine.ts`, enviar `Idempotency-Key: op.idempotencyKey` como header HTTP en cada request.
3. En `server.ts`, crear tabla en memoria (o tabla `cmms_idempotency_keys` en Postgres) que expire en 24h. Antes de procesar cualquier mutación, verificar si ya existe esa key → si sí, devolver el resultado anterior sin re-ejecutar.
4. En Dexie `database.ts`, agregar store `idempotency_cache` con índice `idempotencyKey` para deduplicación local también.

---

### BUG-04: Hash SHA-256 de informes firmados nunca se calcula

**Archivo:** `src/pages/EditorInforme.tsx`

**Problema:** La variable `hashFinal` siempre queda `null`. Los documentos "firmados" no tienen integridad verificable.

**Regla violada:** REGLAS_DE_NEGOCIO.md §E15 ("Hash SHA-256 del payload canónico + firmadoPorUserId + firmadoIp + claveFirmaHash")

**Solución requerida:**
1. Crear función en `src/lib/documentHash.ts`:
```typescript
export async function generarHashDocumento(payload: object): Promise<string> {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const buffer = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```
2. Llamar esta función antes de guardar el informe como "firmado", pasándole el payload del informe (sin incluir el hash mismo).
3. Guardar el hash en `informe.hashFinal` y en el registro de sync queue.
4. En la UI, mostrar los primeros 8 caracteres del hash junto a la fecha de firma.

---

### BUG-05: Race condition en BaseRepository.update() sin transacción

**Archivo:** `src/repositories/BaseRepository.ts`

**Problema:** El método `update()` hace `getById()` → modifica → `put()` sin transacción. Si dos tabs actualizan el mismo registro simultáneamente, se pierden datos (last-write-wins sin merge).

**Solución requerida:**
Reemplazar el patrón manual con `db.transaction('rw', db[tableName], async () => { ... })`:

```typescript
async update(id: string, changes: Partial<T>): Promise<T> {
  return await db.transaction('rw', db[this.tableName], async () => {
    const existing = await db[this.tableName].get(id);
    if (!existing) throw new Error(`${this.tableName}/${id} not found`);
    const updated = { ...existing, ...changes, updatedAt: new Date().toISOString(), version: (existing.version ?? 0) + 1 };
    await db[this.tableName].put(updated);
    await this.enqueueSync(updated, 'pending_update');
    return updated;
  });
}
```

---

## BUGS ALTOS A REPARAR (TIER 2 — Pérdida de datos / UX pobre)

### BUG-06: Backoff de retry hardcodeado e incorrecto

**Archivo:** `src/services/syncEngine.ts`

**Problema:** El retry usa intervalos fijos (30s → 5min) en lugar de exponencial con jitter.

**Regla violada:** REGLAS_DE_NEGOCIO.md §7.3 (`min(5min, 5s × 2^attempts) + random(0-1s)`)

**Solución:**
```typescript
function calcularBackoff(intentos: number): number {
  const base = Math.min(300_000, 5_000 * Math.pow(2, intentos));
  const jitter = Math.random() * 1_000;
  return base + jitter;
}
```

---

### BUG-07: Biometric login completa stub — nunca genera token JWT

**Archivo:** `src/context/AuthContext.tsx` líneas 95-139

**Problema:** `biometricLogin()` verifica credencial WebAuthn localmente pero nunca llama al servidor para obtener un JWT real. El usuario queda "logueado" sin token válido para APIs.

**Solución:**
1. Después de verificar la credencial WebAuthn localmente, llamar a `POST /api/auth/biometric` con el `assertionResponse`.
2. El servidor verifica la aserción y devuelve un JWT igual que el login normal.
3. Si el endpoint no existe en server.ts, crearlo con la misma lógica de generación de token que `/api/auth/login`.

---

### BUG-08: Código Firebase legacy en auth.ts

**Archivo:** `src/lib/auth.ts` línea 41

**Problema:** `throw new Error('Failed to get access token from Firebase Auth')` — el proyecto NO usa Firebase. Es código zombie que confunde.

**Solución:** Eliminar cualquier referencia a Firebase de `src/lib/auth.ts`. El token viene de JWT + localStorage.

---

### BUG-09: Google Tasks integration stub — tira error al invocar

**Archivo:** `src/hooks/useGoogleTasks.ts` línea 16

**Problema:** `throw new Error("No Google token available")` — no hay flujo OAuth de Google.

**Solución:** Comentar o eliminar la integración Google Tasks hasta implementar OAuth2 correctamente. Reemplazar con un TODO claro:
```typescript
// TODO: Implementar OAuth2 Google Tasks cuando se configure GCP OAuth client
export function useGoogleTasks() { return { isAvailable: false }; }
```

---

### BUG-10: Silencio de errores con .catch(console.error)

**Afecta:** 20+ archivos (useMantenimientos.ts, EditorInforme.tsx, syncEngine.ts, etc.)

**Problema:** Errores críticos de Dexie, fetch y PDF se tragan sin notificar al usuario.

**Solución:** Reemplazar `.catch(console.error)` por un handler que:
1. Loguee con `logger.error(context, error)` (usar `src/lib/logger.ts` existente)
2. Agregue el error al `useSyncStore` con `addError(message)` para mostrarlo en `SyncIndicator`
3. O muestre un toast/alert al usuario si el error es accionable

Crear una función de utilidad en `src/lib/errorHandler.ts`:
```typescript
export function handleError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(context, { message });
  useSyncStore.getState().addError(`${context}: ${message}`);
}
// Uso: .catch(e => handleError('EditorInforme:autoguardado', e))
```

---

## BUGS MEDIOS A REPARAR (TIER 3 — Funciona pero incompleto)

### BUG-11: Tablas faltantes en Dexie schema

**Archivo:** `src/db/database.ts`

**Faltantes críticos (agregar en version 15):**
```typescript
// En db.version(15).stores():
idempotency_cache: 'idempotencyKey, expiresAt',
conflicts: '++id, entityId, entityType, resolved, detectedAt',
blobs: 'id, entityId, entityType, mimeType, createdAt',
meta: 'key',
```

---

### BUG-12: Multi-tenancy incompleta en búsquedas

**Archivo:** `src/repositories/BaseRepository.ts`

**Problema:** `search()` y `getAll()` no filtran por `clienteId` activo.

**Solución:** Inyectar `clienteId` en constructor y aplicarlo en todas las queries:
```typescript
async getAll(): Promise<T[]> {
  const clienteId = useAuthStore.getState().clienteActivo?.id;
  if (!clienteId) return [];
  return db[this.tableName].where('clienteId').equals(clienteId).toArray();
}
```

---

### BUG-13: Mismatches entre server.ts y lib/api.ts

**Problema:** El cliente llama endpoints que el servidor no implementa o con schemas distintos.

**Verificar y alinear:**
- Cliente llama `users.email` → Servidor tiene `cmms_usuarios.correo` → Alinear a `correo`
- Cliente llama `POST /api/sync` esperando `{ results: { inserts, updates, deletes } }` → Verificar que server.ts devuelve exactamente eso
- Cliente define `/api/v1/:clienteId/work-orders` → Verificar que server.ts implementa esa ruta (no `/api/tickets`)

---

### BUG-14: OCR sin validación de tamaño de payload

**Archivo:** `src/pages/EditorInforme.tsx` ~línea 2200

**Problema:** Fotos > 5MB enviadas a OCR endpoint causan crash o timeout.

**Solución:**
```typescript
if (file.size > 5 * 1024 * 1024) {
  handleError('OCR', new Error('Imagen demasiado grande. Máximo 5MB.'));
  return;
}
```

---

## INSTRUCCIONES GENERALES PARA EL AGENTE REPARADOR

### Reglas de trabajo:

1. **Lee REGLAS_DE_NEGOCIO.md §7 completo** antes de tocar cualquier archivo de sincronización.
2. **No elimines módulos funcionales** (TIER 0 lista arriba). Si debes modificar uno, hazlo quirúrgicamente.
3. **Cada fix debe tener su test manual**: describe cómo verificar que el bug quedó resuelto.
4. **Prioridad de reparación**: BUG-01 → BUG-02 → BUG-03 → BUG-04 → BUG-05 → luego TIER 2 → luego TIER 3.
5. **No agregar dependencias nuevas** sin justificación. El stack actual tiene todo lo necesario.
6. **Commit atómico por bug**: un commit por cada BUG-XX para poder revertir individualmente.
7. **No tocar server.ts sin revisar la ruta completa**: tiene ~2000 líneas, un cambio en la parte de auth puede romper sync.

### Orden de archivos a modificar:

```
Fase 1 (sync core):
  src/services/syncEngine.ts   → BUG-01, BUG-02, BUG-03, BUG-06
  server.ts                    → BUG-01 (GET snapshot), BUG-03 (idempotency)
  src/db/database.ts           → BUG-11 (nuevas tablas v15)
  src/repositories/BaseRepository.ts → BUG-05, BUG-12

Fase 2 (datos e integridad):
  src/pages/EditorInforme.tsx  → BUG-04, BUG-14
  src/lib/documentHash.ts      → BUG-04 (crear nuevo)
  src/lib/errorHandler.ts      → BUG-10 (crear nuevo)
  src/lib/auth.ts              → BUG-08

Fase 3 (auth e integraciones):
  src/context/AuthContext.tsx  → BUG-07
  src/hooks/useGoogleTasks.ts  → BUG-09
  src/lib/api.ts               → BUG-13

Fase 4 (propagación de errorHandler):
  src/hooks/useMantenimientos.ts → BUG-10
  src/hooks/useAssets.ts         → BUG-10
  src/hooks/useTickets.ts        → BUG-10
  src/pages/EditorOrdenServicio.tsx → BUG-10
```

---

## CRITERIOS DE ACEPTACIÓN

El proyecto está reparado cuando:

- [ ] Un técnico en Device A crea un equipo offline → se sync → aparece en Device B sin reload manual (BUG-01)
- [ ] Edición simultánea en 2 devices del mismo ticket → UI muestra modal de conflicto (BUG-02)
- [ ] Doble-click en "Guardar informe" no crea duplicado (BUG-03)
- [ ] Un informe firmado tiene `hashFinal` no-null de 64 chars hex (BUG-04)
- [ ] Actualizar equipo desde 2 tabs simultáneas → no se pierden campos (BUG-05)
- [ ] Sync falla → reintentos con intervalos exponenciales (BUG-06)
- [ ] Login con huella → JWT válido para llamadas API (BUG-07)
- [ ] No hay referencias a Firebase en el código (BUG-08)
- [ ] `useGoogleTasks` no tira error al importar (BUG-09)
- [ ] Error de Dexie en autoguardado → aparece mensaje en SyncIndicator, no silencioso (BUG-10)

---

## ARCHIVOS DE REFERENCIA CLAVE

| Archivo | Propósito | Crítico para |
|---|---|---|
| `REGLAS_DE_NEGOCIO.md` | Fuente de verdad del negocio | Todo |
| `ARCHITECTURE.md` | Diagrama de capas y despliegue | Sync, API |
| `src/db/database.ts` | Schema Dexie v14 (16 tablas) | BUG-11, BUG-03 |
| `src/services/syncEngine.ts` | Core sync push/pull | BUG-01, BUG-02, BUG-03, BUG-06 |
| `src/repositories/BaseRepository.ts` | CRUD + enqueue | BUG-05, BUG-12 |
| `src/context/AuthContext.tsx` | Auth + biometric | BUG-07 |
| `src/pages/EditorInforme.tsx` | Informes técnicos (~2000 líneas) | BUG-04, BUG-14 |
| `server.ts` | Backend monolito Express | BUG-01, BUG-03, BUG-13 |
| `src/lib/api.ts` | Client API layer | BUG-13 |

---

*Generado por auditoría arquitectural — 2026-06-15. Basado en análisis de ~85 archivos TypeScript y comparación con REGLAS_DE_NEGOCIO.md (fuente de verdad).*
