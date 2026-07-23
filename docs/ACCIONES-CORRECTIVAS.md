# ACCIONES CORRECTIVAS — Resolución de conflictos detectados en la consolidación

## CMMS HVAC PRO

**Versión:** 1.0
**Fecha:** 2026-07-21
**Origen:** durante la fusión documental ejecutada por [`docs/PLAN-CORRECTIVO-DOCUMENTAL.md`](PLAN-CORRECTIVO-DOCUMENTAL.md), quedaron 11 conflictos de contenido real marcados `⚠️ REVISAR` en los dos documentos normativos (7 en Reglas de Negocio, 4 en Especificación Técnica) — ver el commit `db62aac`. Este documento registra la investigación directa del código fuente que resolvió cada uno, con evidencia verificable, y el estado final aplicado a los documentos normativos.

> Documento histórico de trazabilidad — no normativo. La resolución vigente de cada regla vive en [`CMMS_HVAC_PRO_Reglas_de_Negocio.md`](../CMMS_HVAC_PRO_Reglas_de_Negocio.md) o [`CMMS_HVAC_PRO_Especificacion_Tecnica.md`](../CMMS_HVAC_PRO_Especificacion_Tecnica.md). Ver [`DOCS_INDEX.md`](../DOCS_INDEX.md).

---

## Método

Ninguno de estos 11 conflictos se resolvió por preferencia o criterio propio del asistente de IA. Para cada uno se leyó directamente el código fuente relevante (`src/`, `server.ts`) para determinar qué hace el sistema **hoy**, y se corrigió el documento normativo para que describa esa realidad — no la propuesta que sonara más completa entre las dos fuentes fusionadas.

---

## R-01 — Cardinalidad OT↔Activo

- **Conflicto original:** v1 modela `work_orders.asset_id` (1:N); Fase 1 modela N:N vía tabla puente `work_order_assets`. La fusión inicial adoptó el modelo N:N de Fase 1 por parecer más detallado.
- **Evidencia de código:** `src/pages/EditorOrdenServicio.tsx` — el objeto de la Orden de Servicio usa un campo **singular** `generalData.equipoTag`; `AssetSearchModal` se invoca con `onSelect={(asset) => ...}`, un callback de selección única. No existe ninguna tabla `work_order_assets` en `src/db/database.ts` ni en `server.ts`.
- **Resolución:** el modelo real es **1:N** (v1 tenía razón) — una OT referencia exactamente un activo por su TAG; un activo puede aparecer en muchas OT a lo largo del tiempo. Se revirtió la adopción de N:N.
- **Aplicado en:** `CMMS_HVAC_PRO_Reglas_de_Negocio.md`, §4 (modelo ER).

## R-02 — Formato del `Tag_Id`

- **Conflicto original:** v1 usa máscara numérica `0000000.0000.000`; Fase 1 usa ejemplos alfanuméricos `{sucursal}.{tipo}.{seq}` (ej. `21-STK.AC.001`). La fusión inicial adoptó el formato de v1.
- **Evidencia de código:** `src/pages/EditorOrdenServicio.tsx` — `` const fullTag = `${tagData.almacen}.${tagData.tipo}.${correlativoMostrado.padStart(3, '0')}` ``.
- **Resolución:** el formato real es el de **Fase 1** (`{código_sucursal}.{código_tipo}.{correlativo de 3 dígitos}`) — se revirtió la adopción de la máscara numérica de v1.
- **Aplicado en:** `CMMS_HVAC_PRO_Reglas_de_Negocio.md`, RN-ACT-06/RN-ACT-07.

## R-03 — Formato de folio de OT/Informe

- **Conflicto original:** v1 usa `PREFIJO-AÑO-NNNNNN` (correlativo de 6 dígitos); Fase 1 usa `INF-{sucursal}.{tipo}-{tag_corr}-{seq}` con tabla `informe_sequences`. La fusión inicial adoptó el formato de v1.
- **Evidencia de código:** `src/pages/EditorInforme.tsx` — `` `INF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}` ``; borrador no sincronizado: `` `INF-PENDIENTE-${id.substring(0,6).toUpperCase()}` ``.
- **Resolución:** el formato real es `INF-{AÑO}-{4 dígitos aleatorios}` — no coincide exactamente con ninguna de las dos fuentes (estructura de v1, pero aleatorio de 4 dígitos, no secuencial de 6). **Observación registrada, no resuelta:** la UI etiqueta el campo como "Folio Correlativo" pero la implementación es aleatoria, no secuencial — posible mejora futura, no bloqueante.
- **Aplicado en:** `CMMS_HVAC_PRO_Reglas_de_Negocio.md`, RN-FOL-01/RN-FOL-02.

## R-04 — Catálogo de estados de Activo

- **Conflicto original:** v1 usa 4 estados (`operativo`/`observado`/`detenido`/`baja`); Fase 1 usa 5 (`operativo`/`en_observacion`/`en_falla`/`mantenimiento`/`retirado`). La fusión inicial adoptó el catálogo de 5 de Fase 1.
- **Evidencia de código:** `src/db/database.ts` línea 32 — `estado: 'operativo' | 'falla' | 'mantenimiento' | 'baja'`.
- **Resolución:** son exactamente **4 estados**, con estos nombres exactos: `operativo`, `falla`, `mantenimiento`, `baja`. Ninguna de las dos fuentes tenía los nombres exactos correctos (v1 usaba `observado`/`detenido`; Fase 1 usaba `en_falla`/`retirado`/un 5º estado inexistente).
- **Aplicado en:** `CMMS_HVAC_PRO_Reglas_de_Negocio.md`, §16.2.

## R-05 — Mecanismo de frecuencia de Mantenimiento Preventivo

- **Conflicto original:** v1 usa tabla `mp_plans.frecuencia_dias` (entero); Fase 1 usa `equipos.frecuencia_mantenimiento` (enum en el activo). La fusión inicial adoptó el mecanismo de v1.
- **Evidencia de código:** `src/pages/Equipos.tsx` — `calculateAndFormatProximoMantenimiento(equipo.ultimo_mantenimiento, equipo.proximo_mantenimiento, equipo.frecuencia_mantenimiento)`; `src/db/database.ts` — `frecuencia_mantenimiento?: string` es un campo directo de `LocalActivo`. No existe tabla `mp_plans` en el código.
- **Resolución:** el mecanismo real es el de **Fase 1** — la frecuencia vive en el activo, no en una tabla de planes separada. Se revirtió la adopción del modelo `mp_plans` de v1 (queda documentado como diseño objetivo no implementado, si aporta valor).
- **Aplicado en:** `CMMS_HVAC_PRO_Reglas_de_Negocio.md`, RN-MP-01…04.

## R-06 — Tope de reintentos de sincronización y curva de backoff

- **Conflicto original:** v1 fija tope de 3 reintentos, sin curva definida; Fase 1 documenta backoff exponencial de 5 pasos (`1s,2s,4s,8s,16s,max60s`). La fusión inicial adoptó el tope de 3 de v1 pero sin verificar la curva.
- **Evidencia de código:** `src/sync/syncEngine.ts` línea ~60 — `if ((item.retry_count || 0) >= 3) return false;` (confirma tope de 3, v1 correcto). `src/sync/syncQueue.ts` método `markFailed` — la curva real **no es exponencial**: intento 1 falla → espera 30s; intento 2 falla → espera 5 min (300s); intento 3 falla → fallo permanente, sin más reintentos automáticos. El ciclo `setInterval` de 15s en `syncEngine.ts` es lo que efectivamente reintenta un item vencido su `next_retry_at`. Existe una clase `RetryManager` en `src/sync/retryManager.ts` (maxRetries=5, backoff exponencial con jitter) que **no se usa en ningún lugar del código** — código muerto.
- **Resolución:** tope de 3 confirmado correcto (v1); curva real = 30s → 5min → fallo permanente (ni v1 ni Fase 1 la tenían bien).
- **Aplicado en:** `CMMS_HVAC_PRO_Reglas_de_Negocio.md` RN-SYNC-04, y `CMMS_HVAC_PRO_Especificacion_Tecnica.md` §W-04.

## R-07 — Enumeración de roles

- **Conflicto original:** Fase 1 declaraba "6 roles" pero solo nombraba 5 (`administrador`, `supervisor`, `tecnico`, `cliente`, `proveedor`) en las fuentes fusionadas.
- **Evidencia de código:** `src/data/users.ts` línea 5 — `perfil: 'visita' | 'tecnico' | 'supervisor' | 'administrador' | 'cliente' | 'contratista'`.
- **Resolución:** son 6 roles reales: `visita`, `tecnico`, `supervisor`, `administrador`, `cliente`, `contratista`. El rol `proveedor` **no existe** en el código — es `contratista`. El sexto rol que faltaba es `visita`.
- **Aplicado en:** `CMMS_HVAC_PRO_Reglas_de_Negocio.md`, §3.3 (tabla de roles).

## R-08 — Dos mecanismos de resolución de conflictos de sync coexistentes

- **Conflicto original:** el servidor implementa dos mecanismos reales y distintos (`POST /api/sync` con LWW silencioso; `POST /api/cmms/:resource` con bloqueo optimista y HTTP 409 explícito), y no estaba claro cuál usa el frontend hoy.
- **Evidencia de código:** `src/sync/syncEngine.ts` — único motor de sync activo en el frontend, llama exclusivamente a `fetch('/api/sync', ...)`. Nunca invoca `/api/cmms/:resource` ni la ruta `/api/sync/upload/${tabla}` que describía el pseudocódigo de `FASE_2_PLAN_IMPLEMENTACION_FRONTEND.md`.
- **Resolución:** el Mecanismo 1 (`POST /api/sync`, LWW silencioso) es la vía vigente y única en uso real. El Mecanismo 2 (`/api/cmms/:resource`, HTTP 409) es un endpoint legacy huérfano, sin consumidor activo — y además roto (ver R-09). **Recomendación de limpieza de código** (fuera de alcance de este documento): eliminar `/api/cmms/:resource` y su lógica de versión optimista.
- **Aplicado en:** `CMMS_HVAC_PRO_Especificacion_Tecnica.md`, §W-05 (workflow marcado ✅ Normado).

## R-09 — `DROP` de tablas `cmms_*` en el arranque vs. rutas activas que dependen de ellas

- **Conflicto original:** `server.ts` elimina (`DROP TABLE ... CASCADE`) las tablas `cmms_*` en el arranque, pero define rutas de API que dependen de que esas mismas tablas existan — contradicción interna del propio código.
- **Evidencia de código:** `server.ts` — `ensureTables()` se invoca **incondicionalmente** en `startServer()` (sin flag, sin condición), es decir, en **cada** arranque del servidor. Dentro de `ensureTables()`, el array `obsoleteTables` incluye `cmms_tickets`, `cmms_equipos`, `cmms_mantenimientos`, `cmms_ot_eventos`, `cmms_ot_comentarios`, `cmms_users`, `cmms_clientes`, `cmms_usuarios_clientes`, `cmms_informes_mantenimiento`, `cmms_sla_config`, `cmms_pm_planes`, `cmms_pm_plantillas`, `cmms_checklist_plantillas`, `cmms_push_subscriptions`, y ejecuta `DROP TABLE IF EXISTS ... CASCADE` sobre cada una. `cmms_auth_failures` y `cmms_idempotency_keys` **no** están en esa lista — esas sí sobreviven.
- **Resolución:** **confirmado como bug de código, no ambigüedad documental.** La ruta `/api/cmms/:resource` depende de tablas que se destruyen en cada despliegue — está efectivamente rota en producción, coherente con que el frontend tampoco la invoca (R-08). **Recomendación de limpieza de código** (fuera de alcance de este documento): eliminar tanto el bloque `DROP` de esas 14 tablas obsoletas (ya cumplió su propósito de migración) como la ruta que depende de ellas.
- **Aplicado en:** `CMMS_HVAC_PRO_Especificacion_Tecnica.md`, §9.1 y §10.

## R-10 — Posible traslape "Ticket" vs "Orden de Servicio"

- **Conflicto original:** no estaba claro si existe una tabla de "Ticket/Incidencia" real y separada en Postgres, o si el módulo de Tickets del frontend persiste solo en Dexie sin contraparte server-side.
- **Evidencia de código:** `src/db/database.ts` confirma **dos entidades reales y distintas**: `work_orders: Table<LocalTicket>` (campos de incidencia ligera: `titulo`, `descripcion`, `prioridad`, `estado`, `equipo_tag`, `asignado_a`) y `ordenes_servicio: Table<LocalOrdenServicio>` (schema mínimo con `data: any` — el contenido real, con checklist y firma, vive en un blob JSON no tipado a nivel Dexie, editado por `src/pages/EditorOrdenServicio.tsx`).
- **Resolución:** **confirmado por código — es una dualidad real de arquitectura, no un error de documentación.** Un "Ticket" (incidencia/solicitud ligera, tabla `work_orders`) y una "Orden de Servicio" (informe de intervención completo, tabla `ordenes_servicio`) son entidades distintas hoy. **No se encontró código que vincule explícitamente un Ticket con la Orden de Servicio que lo resuelve** — si existe (o debería existir) un flujo "Ticket escala a OT", requiere confirmación del equipo de producto. Nota de deuda técnica adicional: la tabla Dexie llamada `work_orders` almacena datos con forma de "Ticket", un nombre potencialmente confuso.
- **Aplicado en:** `CMMS_HVAC_PRO_Especificacion_Tecnica.md`, §9.1 y §10. **Sigue abierto:** confirmar con Nelson Bravo si debe existir un flujo formal Ticket → Orden de Servicio.

## R-11 — Placeholder de versión de schema Dexie

- **Conflicto original:** la fuente usaba `NEXT_SCHEMA_VERSION` como placeholder simbólico, sin fijar un número real.
- **Evidencia de código:** `src/db/database.ts` — llamadas explícitas `this.version(10)` … `this.version(13)`; la versión más alta declarada es **13**.
- **Resolución:** la versión actual del schema Dexie es 13; cualquier migración nueva debe usar `this.version(14)`.
- **Aplicado en:** `CMMS_HVAC_PRO_Especificacion_Tecnica.md`, §5.3.

---

## Resumen

| # | Conflicto | Fuente que tenía razón | Estado |
|---|---|---|---|
| R-01 | Cardinalidad OT↔Activo | v1 (1:N) | ✅ Resuelto |
| R-02 | Formato `Tag_Id` | Fase 1 (alfanumérico) | ✅ Resuelto |
| R-03 | Formato de folio | Ninguna exactamente | ✅ Resuelto (formato real documentado) |
| R-04 | Catálogo de estados de activo | Ninguna exactamente | ✅ Resuelto (4 estados reales documentados) |
| R-05 | Mecanismo de frecuencia MP | Fase 1 | ✅ Resuelto |
| R-06 | Tope de reintentos / curva de backoff | v1 (tope), ninguna (curva) | ✅ Resuelto |
| R-07 | Enumeración de roles | Ninguna exactamente (6 roles reales) | ✅ Resuelto |
| R-08 | Mecanismo de sync vigente | — (hallazgo de código) | ✅ Resuelto |
| R-09 | `DROP` cmms_* vs rutas activas | — (bug confirmado) | ✅ Resuelto (documentado como bug) |
| R-10 | Ticket vs Orden de Servicio | — (dualidad real confirmada) | 🟡 Documentado — lifecycle Ticket→OT pendiente de decisión de producto |
| R-11 | Versión de schema Dexie | — (hallazgo de código) | ✅ Resuelto |

**10 de 11 quedaron completamente resueltos con evidencia de código verificable.** El ítem R-10 quedó documentado con precisión pero mantiene una pregunta abierta de producto (si debe existir un flujo formal Ticket → Orden de Servicio) que solo Nelson Bravo puede decidir.

**Hallazgos adicionales de calidad de código detectados durante esta investigación** (no son conflictos documentales, son bugs/deuda técnica reales, quedan registrados aquí para que no se pierdan — su corrección en código está fuera del alcance de este proceso documental):
- La ruta legacy `POST /api/cmms/:resource` está rota en producción (depende de tablas que se eliminan en cada arranque) y sin consumidores activos — candidata a eliminación.
- La clase `RetryManager` (`src/sync/retryManager.ts`) es código muerto, no utilizada por ningún módulo.
- El campo de folio etiquetado "Folio Correlativo" en la UI (`EditorInforme.tsx`) en realidad genera un valor aleatorio, no secuencial.
- La tabla Dexie `work_orders` almacena datos con forma de `LocalTicket` — nombre potencialmente confuso frente a `ordenes_servicio`.
