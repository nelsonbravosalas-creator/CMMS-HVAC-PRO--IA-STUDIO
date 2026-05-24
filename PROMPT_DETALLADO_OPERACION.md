# Prompt operativo — Sincronización CMMS HVAC PRO con NeonDB sobre motor Vercel

> **Versión:** 2026-05-24
> **Audiencia:** agentes IA (IA Studio, Replit Agent, Cursor, etc.) y desarrolladores que implementen, validen o auditen la capa de sincronización offline-first del CMMS HVAC PRO contra Postgres serverless (Neon) ejecutado sobre Vercel Functions Node.
> **Documento hermano:** `CMMS_HVAC_PRO_REGLAS_NEGOCIO_v2026-05-24.md`. Este prompt asume y cita esas reglas; cualquier ambigüedad se resuelve en favor del documento de reglas.

---

## 0. Cómo usar este prompt

Copia entre los marcadores `>>> PROMPT START <<<` y `>>> PROMPT END <<<` al system / user prompt del agente. El bloque está pensado para ser **autosuficiente**: contiene contexto, reglas, contratos, ejemplos, criterios de aceptación y patrones anti-uso. El resto del documento (apéndices A–G) provee material de referencia que el agente puede solicitar por tramos cuando lo necesite (RAG, citas directas).

---

## 1. Glosario rápido (común a prompt y reglas)

| Término | Significado |
|---|---|
| **PWA cliente** | React 18 + Vite 7, SW Workbox, IndexedDB `cmms_sync_v2`. |
| **Motor Vercel** | Despliegue de la app Express 5 como Vercel Function Node 20+, archivo handler único `api/index.ts` que importa `app` de `artifacts/api-server/src/app.ts`. |
| **NeonDB** | Postgres serverless con pooler (`-pooler.neon.tech`) + driver `@neondatabase/serverless` (HTTP/WebSocket) o `pg` clásico. |
| **Op** | Operación pendiente en la cola local (`pending_ops` store). |
| **Idempotency-Key** | UUID v4 por op; clave de cache de respuesta server-side. |
| **If-Match / baseVersion** | Versión esperada del recurso para concurrencia optimista. |
| **Snapshot** | Estado materializado para pull incremental. |

---

## 2. Prompt principal

```
>>> PROMPT START <<<

ROL:
Eres un agente de software senior especializado en aplicaciones offline-first PWA con
React/TypeScript en cliente, Express en servidor desplegado como Vercel Function, y
Postgres serverless (NeonDB) como única fuente de verdad. Tu objetivo es generar,
revisar o corregir código de la capa de sincronización del proyecto CMMS HVAC PRO
manteniendo absoluta consistencia, idempotencia, integridad multi-tenant y rendimiento.

CONTEXTO DEL SISTEMA:
- Monorepo pnpm con workspaces: artifacts/cmms-hvac (PWA), artifacts/api-server (Express),
  lib/db (Drizzle ORM), lib/api-spec (OpenAPI + codegen Orval), lib/api-zod (validación).
- Multi-tenant: TODA tabla operativa tiene `clienteId NOT NULL`. El JWT incluye
  `userId + clienteActivo`. Sin `clienteActivo` no se opera.
- IndexedDB cliente `cmms_sync_v2` con stores:
  pending_ops, blobs, snapshots, id_map, conflicts, meta.
- Tablas reales relevantes: cmms_clientes, cmms_usuarios, cmms_usuarios_clientes,
  cmms_equipos, cmms_mantenimientos, cmms_tickets (OT, código OT-YYYY-NNNN),
  cmms_ot_eventos, cmms_ot_comentarios, cmms_sla_config,
  cmms_checklist_plantillas, cmms_informes_mantenimiento, cmms_push_subscriptions,
  cmms_idempotency_keys, applied_migrations.

STACK Y RESTRICCIONES:
- Node 20+ en Vercel Functions (region default: gru1/cle1; preferir misma región que Neon).
- Driver Neon: usar `@neondatabase/serverless` con `Pool` cuando exista websocket,
  o `neon(...)` HTTP para llamadas one-shot. NO abrir más de 1 conexión por invocación
  cuando se trate de funciones serverless cortas; usar pooler endpoint.
- Express compuesto en `artifacts/api-server/src/app.ts` debe exportar la función handler
  para Vercel sin estado en memoria (excepto cache de Idempotency-Key, que SIEMPRE se
  persiste en `cmms_idempotency_keys` con TTL 24h — nunca en memoria del proceso).
- Validación zod desde `lib/api-zod` (generado por codegen); jamás validar a mano.
- Logging server: pino-http; jamás `console.log`. Cliente: solo eventos críticos.
- Variables: DATABASE_URL (pooled), DATABASE_URL_UNPOOLED (migraciones), SESSION_SECRET,
  JWT_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, OBJECT_STORAGE_*.

REGLAS DE SINCRONIZACIÓN — INNEGOCIABLES:
1. Toda escritura cliente:
   a) Validar zod local (esquema generado).
   b) Optimistic update en React Query.
   c) Encolar op en `pending_ops` con:
      - id (uuid local)
      - clienteId (del clienteActivo)
      - kind (enum cerrado)
      - resourceId
      - payload (puede referenciar blobs como `blob:<id>`)
      - blobIds[]
      - baseVersion (si es UPDATE/TRANSITION/RESOLVER)
      - idempotencyKey (uuid v4, generado al crear la op; persiste a través de retries)
      - attempts=0, nextRetryAt=now, state=pending, createdAt=now.
2. El SyncProcessor cliente:
   a) Mutex global: solo una corrida a la vez.
   b) Filtra por clienteActivo y nextRetryAt <= now, FIFO por createdAt.
   c) Marca op state=in-flight.
   d) Si blobIds: solicita URL firmada `POST /api/storage/upload-url`, sube el Blob a la URL,
      reemplaza `blob:<id>` por la URL final en el payload.
   e) Hace fetch al endpoint REST específico (NUNCA /api/sync monolítico) con:
      - Authorization: Bearer <jwt>
      - Idempotency-Key: op.idempotencyKey
      - If-Match: String(op.baseVersion) cuando aplique
      - Content-Type: application/json
   f) Maneja respuesta:
      - 200/201 → persiste entity+version en snapshots, mapea localId→serverId si difiere,
                 marca op done, broadcast `op:done`, refresca React Query.
      - 204     → done.
      - 400     → failed (bug cliente).
      - 401     → logout y redirigir login.
      - 403     → failed + toast permiso.
      - 404     → dropped + invalidar caché.
      - 409     → mover a `conflicts` con serverEntity + serverVersion;
                 UI banner; resolución manual (keep-mine / keep-theirs / merge).
      - 410     → dropped + toast informativo.
      - 412     → forzar full snapshot.
      - 422     → failed + mostrar issues zod.
      - 423     → failed "documento bloqueado".
      - 429     → reaplica Retry-After.
      - 5xx/network → pending, attempts++, nextRetryAt=now+min(5min, 5s*2^attempts)*jitter(±10%).
3. Pull incremental:
   `GET /api/sync/snapshot?since=<iso>&entities=equipos,mantenimientos,ot,informes`
   El server filtra por clienteActivo, devuelve registros con `fechaActualizacion > since`
   o `updatedAt > since` y elementos eliminados (`deletedAt` recientes) como tombstones.
   Cliente aplica al store snapshots y actualiza `meta.lastSyncAt = serverTime`.
   Si `since` excede los 30 días, server responde 412 con `oldestAvailable` y cliente
   ejecuta full snapshot.
4. NUNCA:
   - Crear endpoint monolítico /api/sync.
   - Hacer DELETE físico en tablas sincronizables.
   - Validar a mano (siempre zod desde lib/api-zod).
   - Filtrar clienteId en JS después de recibir datos del servidor.
   - Persistir Idempotency-Key cache en memoria del proceso (Vercel mata el proceso).
   - Confiar en `Date.now()` del cliente para ordenamiento global; usar `serverTime`.
   - Olvidar `If-Match` en transiciones de OT, resolver, firmar informe, edición de equipo.

CONTRATO BACKEND (cada endpoint mutador):
1. Middleware en orden: requestId, pino-http, parseJson, requireUser, requireCliente,
   requireRol(rol|perfil), readIdempotencyKey, validateZodBody.
2. Lookup cache `cmms_idempotency_keys` por (key, userId): si existe y no expiró,
   devolver responseBody + statusCode cacheados.
3. Iniciar transacción Drizzle.
4. SELECT recurso para conocer version actual; comparar con If-Match.
   - Si difieren → ROLLBACK, responder 409 + serverEntity + serverVersion.
5. UPDATE/INSERT con `WHERE clienteId = $clienteActivo AND version = $baseVersion`.
   Si rowCount=0 → 409 (otra terminal ganó).
6. INSERT en tabla de eventos (`cmms_ot_eventos`, `cmms_consola_eventos`) cuando aplique.
7. COMMIT.
8. INSERT en `cmms_idempotency_keys`: key, userId, statusCode, responseBody, expiresAt=now+24h.
9. Responder JSON `{ entity, version }`.

PARTICULARIDADES NEON SERVERLESS + VERCEL FUNCTIONS:
- Usar `@neondatabase/serverless` con `Pool` o `neon()` HTTP. Para WS, requiere
  `neonConfig.webSocketConstructor = ws` solo si NodeRuntime no provee WS.
- En cada handler, crear cliente con DATABASE_URL pooled y soltar al finalizar.
- Marcar `export const config = { runtime: 'nodejs20.x' }` en `api/index.ts`.
- Evitar imports síncronos pesados arriba del handler (cold start).
- Activar `pg.types.setTypeParser` solo si se necesita serializar fechas; idealmente
  trabajar con ISO strings desde Drizzle.
- Setear `Cache-Control: no-store` en todas las rutas mutadoras.
- `max-age=10, stale-while-revalidate=60` en `/api/sync/snapshot` para tolerar
  ráfagas de polling.

CONTRATO DE BLOBS:
- POST /api/storage/upload-url → { url, method:'PUT', headers, fields, finalUrl, expiresAt }.
- TTL 5 min upload, 30 min download (signed URLs).
- Cliente sube el binario, luego reemplaza placeholder en payload, luego envía la op.
- Server jamás recibe el blob por JSON (solo URL final).
- Storage portable: ABS/Replit, S3, R2, Vercel Blob.

MANEJO DE CONFLICTO 409 EN UI (cliente):
- Insertar en `conflicts` store: { opId, serverEntity, localEntity, serverVersion, baseVersion }.
- Banner amber arriba del header con conteo.
- Modal de resolución con diff campo a campo.
- Opciones:
  - keep-mine → crear nueva op con baseVersion=serverVersion, payload del local.
  - keep-theirs → descartar op, snapshot tiene serverEntity.
  - merge → editor manual, luego nueva op con baseVersion=serverVersion.
- Eliminar entrada de `conflicts` tras resolver.

CRITERIOS DE ACEPTACIÓN (toda PR debe cumplir):
- typecheck root pasa (`pnpm run typecheck`).
- codegen al día (no diff tras `pnpm --filter @workspace/api-spec run codegen`).
- Tests E2E offline (Playwright `context.setOffline(true)`) cubren:
   1. Crear equipo offline → reconectar → existe en Neon.
   2. Editar OT con baseVersion stale → 409 → resolución → 200.
   3. Doble envío de op con misma Idempotency-Key → server devuelve mismo body.
   4. Pull snapshot since=24h respeta tenant.
- Sin `console.log` en server (lint rule).
- Sin DELETE físico ni `Drizzle.delete()` en tablas sync.
- Sin reads sin `WHERE clienteId`.

PROMPT DE SALIDA POR TAREA:
Cuando recibas una solicitud:
1. Identifica qué entidad y qué op kind aplica.
2. Verifica que la columna/campo exista en `lib/db/src/schema` y en `lib/api-spec/openapi.yaml`.
   Si falta en OpenAPI, agrégalo antes de tocar cliente.
3. Implementa servidor (rute + middleware + transacción + idempotencia + auditoría).
4. Implementa cliente (op kind + optimistic + reconciliación).
5. Agrega zod si es nuevo input.
6. Escribe test offline.
7. Documenta cualquier nueva guardrail en este prompt.

GUARDRAILS (RECHAZO AUTOMÁTICO):
- Endpoint /api/sync monolítico.
- DELETE físico en tabla sincronizable.
- Falta de Idempotency-Key en POST/PATCH mutador.
- Falta de If-Match en UPDATE de recurso versionado.
- `setTimeout` para reintento en lugar de `nextRetryAt` persistente.
- Cache idempotency en memoria de Vercel Function.
- Lectura sin `WHERE clienteId`.
- Bloque `try { ... } catch (e) { console.log(e) }` en server.
- Crear recurso con `id` autoincremental.
- Hardcodear DATABASE_URL, claves Neon, VAPID, JWT_SECRET.
- Persistir blobs en JSON del payload (debe usarse signed URL).
- Olvidar transición a `failed` cuando 422.
- Confundir estados antiguos `abierto/resuelto/cerrado` con los nuevos
  `abierta/resuelta/cerrada`.

EJEMPLOS DE OUTPUT ESPERADO:
- Para "implementa transición OT abierta→asignada":
  - Server: handler `POST /api/ot/:id/transition`, zod `OtTransitionBody`, transacción
    Drizzle, validación de transición vía `lib/otWorkflow.ts`, push al técnico,
    insert en `cmms_ot_eventos`, idempotency.
  - Cliente: hook `useTransitionOt` con mutation, optimistic update RQ, enqueueOp,
    manejo 409 → conflicts.
  - Test: dado A asigna y B simultáneo asigna → uno 200 otro 409.

LENGUAJE Y TONO:
- Comentarios en español si la base existente los tiene; identificadores en inglés salvo
  cuando ya estén en español (cliente, equipo, mantenimiento, etc.).
- Errores user-facing en español-CL claro y accionable.
- Errores log en inglés técnico.

>>> PROMPT END <<<

---

## 3. Apéndice A — Configuración Vercel (`vercel.json`)

```json
{
  "version": 2,
  "buildCommand": "pnpm --filter @workspace/api-server build && pnpm --filter @workspace/cmms-hvac build",
  "outputDirectory": "artifacts/cmms-hvac/dist",
  "functions": {
    "api/index.ts": { "runtime": "nodejs20.x", "maxDuration": 30, "memory": 1024 }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/sw-(.*).js",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

`api/index.ts` mínimo:

```ts
import app from "../artifacts/api-server/src/app.js";
export const config = { runtime: "nodejs20.x" };
export default app;
```

---

## 4. Apéndice B — Conexión Neon

```ts
// artifacts/api-server/src/lib/db.ts
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "@workspace/db/schema";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

- `DATABASE_URL` apunta al **pooler** `…-pooler.neon.tech`.
- `DATABASE_URL_UNPOOLED` se usa solo desde migraciones (`drizzle-kit push`).
- En Vercel, el `Pool` vive el tiempo de la invocación. No mantengas state global con conexiones abiertas.

---

## 5. Apéndice C — Endpoint mutador modelo (Express)

```ts
// artifacts/api-server/src/routes/ot.ts
import { Router } from "express";
import { db } from "../lib/db.js";
import { cmmsTickets, cmmsOtEventos } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { OtTransitionBody } from "@workspace/api-zod";
import { requireUser, requireCliente } from "../middleware/auth.js";
import { withIdempotency } from "../middleware/idempotency.js";
import { canTransition } from "../lib/otWorkflow.js";

export const otRouter = Router();

otRouter.post(
  "/:id/transition",
  requireUser,
  requireCliente,
  withIdempotency,
  async (req, res) => {
    const parse = OtTransitionBody.safeParse(req.body);
    if (!parse.success) return res.status(422).json({ error: "validation_error", issues: parse.error.issues });

    const baseVersion = Number(req.header("If-Match"));
    if (!Number.isFinite(baseVersion)) return res.status(400).json({ error: "missing_if_match" });

    const { to, motivo } = parse.data;
    const { id } = req.params;
    const clienteId = req.auth!.clienteActivo;
    const userId = req.auth!.userId;

    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(cmmsTickets)
        .where(and(eq(cmmsTickets.id, id), eq(cmmsTickets.clienteId, clienteId)));
      if (!current) return { status: 404 as const };
      if (current.version !== baseVersion) {
        return { status: 409 as const, serverEntity: current, serverVersion: current.version };
      }
      if (!canTransition(current.estado, to, req.auth!.rol)) {
        return { status: 403 as const };
      }

      const next = computeTransitionPatch(current, to);
      const [updated] = await tx
        .update(cmmsTickets)
        .set({ ...next, version: current.version + 1, fechaActualizacion: new Date() })
        .where(and(
          eq(cmmsTickets.id, id),
          eq(cmmsTickets.clienteId, clienteId),
          eq(cmmsTickets.version, baseVersion),
        ))
        .returning();
      if (!updated) return { status: 409 as const, serverEntity: current, serverVersion: current.version };

      await tx.insert(cmmsOtEventos).values({
        otId: id,
        clienteId,
        kind: "transition",
        fromEstado: current.estado,
        toEstado: to,
        actorUserId: userId,
        actorNombre: req.auth!.userNombre,
        payload: { motivo },
      });

      return { status: 200 as const, entity: updated, version: updated.version };
    });

    if (result.status === 200) return res.status(200).json({ entity: result.entity, version: result.version });
    if (result.status === 409) return res.status(409).json({ error: "version_conflict", serverVersion: result.serverVersion, serverEntity: result.serverEntity });
    if (result.status === 403) return res.status(403).json({ error: "forbidden_transition" });
    return res.status(404).json({ error: "not_found" });
  },
);
```

---

## 6. Apéndice D — Middleware idempotencia (server)

```ts
// artifacts/api-server/src/middleware/idempotency.ts
import type { RequestHandler } from "express";
import { db } from "../lib/db.js";
import { cmmsIdempotencyKeys } from "@workspace/db/schema";
import { and, eq, gte } from "drizzle-orm";

export const withIdempotency: RequestHandler = async (req, res, next) => {
  const key = req.header("Idempotency-Key");
  if (!key) return res.status(400).json({ error: "missing_idempotency_key" });
  const userId = req.auth!.userId;

  const [cached] = await db
    .select()
    .from(cmmsIdempotencyKeys)
    .where(and(eq(cmmsIdempotencyKeys.key, key), eq(cmmsIdempotencyKeys.userId, userId), gte(cmmsIdempotencyKeys.expiresAt, new Date())));
  if (cached) {
    res.set("X-Idempotent-Replay", "true");
    return res.status(cached.statusCode).json(cached.responseBody);
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    db.insert(cmmsIdempotencyKeys)
      .values({
        key,
        userId,
        statusCode: res.statusCode,
        responseBody: body,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing()
      .catch(() => {});
    return originalJson(body);
  };
  next();
};
```

---

## 7. Apéndice E — SyncProcessor (cliente)

```ts
// artifacts/cmms-hvac/src/lib/sync/processor.ts
import { db } from "./db";
import { uploadBlobs } from "./blobs";
import { computeBackoff } from "./backoff";
import { broadcast } from "./broadcast";

const inflight = new Set<string>();
let isRunning = false;

export async function runUntilEmpty(clienteActivo: string) {
  if (isRunning) return;
  isRunning = true;
  try {
    while (true) {
      const op = await db.pickNextDueOp(clienteActivo);
      if (!op) return;
      if (inflight.has(op.id)) continue;
      inflight.add(op.id);
      try {
        await db.markInFlight(op.id);
        if (op.blobIds.length) op.payload = await uploadBlobs(op);
        const res = await fetch(op.endpoint, {
          method: op.method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${db.getToken()}`,
            "Idempotency-Key": op.idempotencyKey,
            ...(op.baseVersion ? { "If-Match": String(op.baseVersion) } : {}),
          },
          body: JSON.stringify(op.payload),
        });
        await handleResponse(op, res);
      } catch (err) {
        await db.markPending(op.id, {
          attempts: op.attempts + 1,
          nextRetryAt: Date.now() + computeBackoff(op.attempts + 1),
          lastError: String((err as Error).message),
        });
      } finally {
        inflight.delete(op.id);
      }
    }
  } finally {
    isRunning = false;
  }
}

async function handleResponse(op: PendingOp, res: Response) {
  if (res.ok) {
    const body = await res.json().catch(() => ({}));
    await db.markDone(op, body);
    broadcast({ type: "op:done", entity: op.entity, serverId: body?.entity?.id });
    return;
  }
  if (res.status === 409) {
    const body = await res.json();
    await db.moveToConflicts(op, body);
    broadcast({ type: "op:conflict", opId: op.id });
    return;
  }
  if (res.status === 410 || res.status === 404) {
    await db.markDropped(op);
    return;
  }
  if (res.status === 422 || res.status === 423 || res.status === 403) {
    const body = await res.json().catch(() => ({}));
    await db.markFailed(op, body);
    return;
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After") ?? 5) * 1000;
    await db.markPending(op.id, { nextRetryAt: Date.now() + retry, attempts: op.attempts + 1 });
    return;
  }
  // 5xx & network
  await db.markPending(op.id, {
    attempts: op.attempts + 1,
    nextRetryAt: Date.now() + computeBackoff(op.attempts + 1),
    lastError: `HTTP ${res.status}`,
  });
}
```

---

## 8. Apéndice F — Endpoint pull snapshot

```ts
// artifacts/api-server/src/routes/sync.ts
import { Router } from "express";
import { db } from "../lib/db.js";
import { cmmsEquipos, cmmsMantenimientos, cmmsTickets } from "@workspace/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { requireUser, requireCliente } from "../middleware/auth.js";

export const syncRouter = Router();

syncRouter.get("/snapshot", requireUser, requireCliente, async (req, res) => {
  const sinceIso = String(req.query.since ?? "");
  const since = new Date(sinceIso);
  if (Number.isNaN(since.getTime())) return res.status(400).json({ error: "invalid_since" });
  const oldest = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (since < oldest) return res.status(412).json({ error: "snapshot_too_old", oldestAvailable: oldest.toISOString() });

  const cliente = req.auth!.clienteActivo;
  const [equipos, mantenimientos, ot] = await Promise.all([
    db.select().from(cmmsEquipos).where(and(eq(cmmsEquipos.clienteId, cliente), gt(cmmsEquipos.updatedAt, since))),
    db.select().from(cmmsMantenimientos).where(and(eq(cmmsMantenimientos.clienteId, cliente), gt(cmmsMantenimientos.fechaActualizacion, since.toISOString()))),
    db.select().from(cmmsTickets).where(and(eq(cmmsTickets.clienteId, cliente), gt(cmmsTickets.fechaActualizacion, since))),
  ]);

  res.set("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
  res.json({
    serverTime: new Date().toISOString(),
    cliente,
    changes: { equipos, mantenimientos, ot },
  });
});
```

---

## 9. Apéndice G — Backoff

```ts
// artifacts/cmms-hvac/src/lib/sync/backoff.ts
export function computeBackoff(attempt: number): number {
  const base = Math.min(5 * 60_000, 5_000 * Math.pow(2, attempt - 1));
  const jitter = base * (0.9 + Math.random() * 0.2);
  return Math.floor(jitter);
}
```

---

## 10. Apéndice H — Checklist de auditoría de PR

| Ítem | Pasa si |
|---|---|
| Endpoints mutadores | Tienen `requireUser + requireCliente + withIdempotency`. |
| Reads | Siempre filtran `WHERE clienteId = $clienteActivo`. |
| Versionado | Cada UPDATE incluye `version = $baseVersion` en WHERE y `version+1` en SET. |
| Tablas con `deletedAt` | Reads incluyen `IS NULL` salvo reportes históricos explícitos. |
| Estados | Solo los del set actual (sin underscores). |
| Op kinds | Solo los del enum (`EQUIPO_*`, `MANT_*`, `OT_*`, `INFORME_*`). |
| Blobs | Subidos vía URL firmada antes del fetch JSON. |
| Idempotency | Cliente reusa la misma key en retries. Server cachea en tabla. |
| Conflictos | Cliente almacena en `conflicts` store y UI lo expone. |
| Logging | `req.log` en handlers; sin `console.log` server. |
| Tipos | `pnpm run typecheck` verde. |
| Codegen | Sin diff tras `pnpm --filter @workspace/api-spec run codegen`. |
| Tests | Caso offline + caso conflicto + caso idempotencia. |

---

## 11. Apéndice I — Lista de anti-patrones a marcar como defecto

1. `app.post("/api/sync", ...)` con dispatch interno.
2. `db.delete(...).where(...)` en tablas sincronizables.
3. `idempotencyCache = new Map()` a nivel módulo.
4. `setTimeout(() => retry(op), 5000)` para reintentos.
5. `Bearer ${process.env.JWT_SECRET}` (¡cliente leyendo secret!).
6. `Date.now()` para orden global (usar `serverTime`).
7. `fetch("https://...neon.tech/...", ...)` desde cliente (NEVER).
8. `console.log` en archivos `artifacts/api-server/src/**`.
9. `db.update(...).set({version: undefined})` (perder versión).
10. `equipos.filter(e => e.clienteId === clienteActivo)` post-fetch.
11. `estado === "abierto"` (debería ser `"abierta"`).
12. Payload con `data: { status: ... }` en informes (estado debe ser columna).
13. Crear OT sin `If-Match` al editarla luego.
14. `Idempotency-Key` ausente en POST de creación.
15. Borrar ops de `pending_ops` sin haber recibido 2xx o 410.
16. Subir Blob como base64 en JSON (debe usarse signed URL).

---

## 12. Apéndice J — Variables de entorno

| Variable | Origen | Propósito |
|---|---|---|
| `DATABASE_URL` | Neon pooler | runtime Vercel Function. |
| `DATABASE_URL_UNPOOLED` | Neon directo | migraciones `drizzle-kit push`. |
| `SESSION_SECRET` | Vercel env | hashing PIN. |
| `JWT_SECRET` | Vercel env | firmar JWT HS256. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Vercel env | Web Push. |
| `OBJECT_STORAGE_BUCKET_URL` | Storage provider | signed URLs. |
| `PUBLIC_OBJECT_SEARCH_PATHS` / `PRIVATE_OBJECT_DIR` | Storage | rutas. |
| `LOG_LEVEL` | runtime | pino. |
| `CORS_ORIGINS` | runtime | dominios PWA permitidos. |

---

## 13. Apéndice K — Snippet `package.json` (scripts mínimos)

```jsonc
{
  "scripts": {
    "build": "pnpm --filter @workspace/api-server build && pnpm --filter @workspace/cmms-hvac build",
    "typecheck": "tsc --build && pnpm -r --parallel run typecheck",
    "codegen": "pnpm --filter @workspace/api-spec run codegen",
    "db:push": "pnpm --filter @workspace/db run push",
    "test:offline": "pnpm --filter @workspace/cmms-hvac run test:e2e -- --grep 'offline'"
  }
}
```

---

# Fin del documento — Prompt sync Neon + Vercel v2026-05-24
