# SPEC — Módulo «Inspección de Obra» (Inspecciones y Protocolos)

Estado: **PLAN (sin código), decisiones tomadas el 2026-11-16** · Fecha: 2026-11-16 · Fuente: transcripción del flujo de
controlobrax.cl (video no verificado por el autor del plan) + revisión del repositorio.

## 0. Decisiones tomadas (2026-11-16)

| Tema | Decisión |
|------|----------|
| Fotos | Neon con compresión en el celular; migrar a otro almacén si el volumen crece |
| Planos | Imágenes primero; PDF en una fase posterior |
| Relación con otros módulos | **Módulo paralelo a Órdenes de Servicio.** Se conecta con Cliente (cliente y sucursal) y con Calendario (fecha programada y estado). **No actualiza avances** de OS ni mantenimientos |
| Envío al firmante | Correo con Resend (ya existe) y enlace copiable como respaldo |
| Perfil `cliente` | Ve y firma **dentro de la app** con su sesión; el enlace temporal queda para quien no tiene cuenta |

Supuestos derivados, por confirmar: el Calendario lee las inspecciones programadas desde su tabla sin duplicar eventos; el perfil cliente ve las inspecciones de su empresa enviadas a firma, aprobadas u observadas (no borradores); cada inspección y plano pertenece al cliente activo y a una sucursal.

> Donde el resto de este documento mencione avance de OS o mantenimiento, `onInspectionApproved` o PDF de planos en la Fase 2, **esta sección prevalece**. El diagrama animado en `docs/PLAN_INSPECCION_DE_OBRA.html` ya refleja estas decisiones.

## 1. Resumen ejecutivo

El módulo es viable sobre la arquitectura actual sin cambiar de stack. Se implementa como un
módulo más (patrón `ordenes_servicio` / `reports`): páginas lazy en React, tablas Dexie
offline-first, tablas JSONB multi-tenant en Neon y sincronización por el motor existente.

Tres piezas **no encajan** en lo existente y requieren decisiones:

| # | Pieza | Por qué es nueva | Propuesta |
|---|-------|------------------|-----------|
| 1 | Portal público `/liberar/:token` | `App.tsx` redirige a `/login` toda ruta sin sesión | Rutas públicas evaluadas **antes** del guard de auth + endpoints públicos sin `requireAuth` |
| 2 | Fotos y planos | No hay almacenamiento de archivos (solo `blobs` en Dexie y JSONB en Neon) | Tabla `inspection_media` (compresión en cliente) en MVP; Vercel Blob/S3 en fase posterior |
| 3 | PDF con hash de verificación | `jspdf` ya existe (cliente); Puppeteer no corre en funciones Vercel | `jspdf` + `html2canvas` en cliente; hash SHA-256 calculado y fijado en servidor |

## 2. Hallazgos de la estructura actual (relevantes para el módulo)

- **Frontend**: React 19 + Vite + Tailwind 4 + wouter + zustand + Dexie. Páginas con `React.lazy` en `src/App.tsx`; menú en `NAV_ITEMS` de `src/components/Layout.tsx` (+ drawer móvil).
- **Offline-first**: `src/db/database.ts` (Dexie, versión actual **16**), repositorios que extienden `BaseRepository` (`create/update/save/delete` + `sync_queue`), `src/sync/syncEngine.ts`.
- **Backend dual**: `server.ts` (Express, dev/Docker) **y** `api/*.ts` + `server/vercel/handlers/*` con `vercel.json` rewrites (producción Vercel). Todo endpoint nuevo debe existir en **ambos**.
- **Neon**: tablas genéricas `(uuid_sync, id, data JSONB, updated_at, created_at, deleted_at, cliente_id)` creadas en `scripts/db/bootstrap.ts`. Tablas permitidas en sync: `SYNC_WRITABLE_TABLES` y `ALLOWED_TABLES` en `server.ts`.
- **Multi-tenant**: `cliente_id` + `requireCliente`; roles: `visita, cliente, contratista, tecnico, supervisor, administrador` (`PERMISOS_POR_PERFIL` en `src/types.ts`).
- **Reutilizable**: `FullscreenSignatureModal` (canvas de firma), `DictationTextarea`, `SearchableSelect`, `ScannerQR`, `OrdenesServicio`/`EditorOrdenServicio`, `src/rules/orderReportRules.ts` (patrón de reglas puras con test en `tests/`), `rateLimit`, `jspdf`, `html2canvas`.
- **Seguridad**: CSP en `vercel.json` (`img-src 'self' data: blob:`; `connect-src 'self'`): fotos y planos propios funcionan; no se pueden cargar visores/CDN externos sin ampliar CSP.
- **Riesgo conocido**: el endpoint genérico `/api/sync` acepta escrituras de cualquier tabla de `SYNC_WRITABLE_TABLES` con validación mínima (hoy solo `validateWorkOrderPayload`). La **inmutabilidad post-firma exige validador específico** en servidor.

## 3. Mapeo del dominio «Obra» → CMMS HVAC

| Concepto del video | En este CMMS |
|--------------------|--------------|
| Partida / WBS | Orden de Servicio (`ordenes_servicio`) o mantenimiento (`preventive_maintenance`) vinculado; opcional: Equipo (`assets`) |
| Plano | Plano/diagrama de la sucursal o del equipo (imagen; PDF página 1 en fase 2) |
| Especialidad | Climatización, Eléctrica, Control, Refrigeración, Seguridad, Obra civil |
| ITO / Cliente / Auditor | Firmante externo sin cuenta (cliente final, ITO, mandante) |
| Supervisor responsable | Usuario `supervisor`; ejecuta el `tecnico` |
| Avance de partida | **Descartado.** El módulo es paralelo; su estado se refleja en el Calendario |

Plantillas semilla HVAC sugeridas: Puesta en marcha de chiller/VRF, Recepción de UMA/fan-coil,
Estanqueidad y aislación de ductos, Tablero eléctrico de climatización, Sala de máquinas y
seguridad de refrigerantes, Entrega final de instalación.

## 4. Modelo de datos

### 4.1 Decisiones de diseño (desvíos respecto a la propuesta original)

1. **Ítems embebidos en la inspección** (`data.items[]`) y no tabla aparte: una inspección la edita un solo técnico, el guardado es atómico y funciona offline; evita N sincronizaciones por ítem. Conflictos: se resuelven a nivel de inspección (último escritor + `version`), igual que `ordenes_servicio`.
2. **Fotos fuera del JSON** (`inspection_media`): evita inflar el payload de sync y los límites de JSONB. El ítem guarda solo `media_ids[]`.
3. **Token de firma 1:N** (no 1:1): se reenvía tras vencimiento o rechazo. Se guarda solo `sha256(token)`; **nunca** se sincroniza a Dexie (tabla solo servidor).
4. **Estados adicionales**: se agrega `OBSERVADA` (rechazo del externo) y vuelta a `EN_PROGRESO` para re-inspección.
5. **Pines**: se mantienen en el ítem (`pin: {blueprint_id, x, y, tipo, estado, responsable, fecha_limite}`) con coordenadas normalizadas 0–1; además permite pines sueltos (`Incidencia/Pendiente/RFI/Nota`) en `data.pins[]`.

### 4.2 Tablas

```
inspection_templates   (Dexie+Neon, sync)  data: {nombre, especialidad, items_schema[], foto_obligatoria_cumple, activo}
inspection_blueprints  (Dexie+Neon, sync)  data: {nombre, sucursal_id?, asset_tag?, media_id, ancho, alto, pagina}
inspections            (Dexie+Neon, sync)  data: {codigo INS-014, titulo, template_id, blueprint_id?, zona, especialidad,
                                                  tecnico_id, supervisor_id, fecha_programada, estado,
                                                  vinculo:{tipo:'orden_servicio'|'mantenimiento'|'activo', uuid},
                                                  items:[{id, grupo, descripcion, estado:null|CUMPLE|NO_CUMPLE|NA,
                                                          observacion, accion_correctiva, media_ids[], pin?, historial[]}],
                                                  pins:[...], progreso, cumplimiento, hallazgos_abiertos,
                                                  historial:[{evento, usuario, ts}], verification_hash?, aprobada_at?}
inspection_media       (Neon + Dexie `blobs` local)  uuid_sync, mime, bytes/ref, sha256, cliente_id, inspection_uuid
inspection_sign_tokens (SOLO Neon, no sync)  id, inspection_uuid, cliente_id, token_hash, expires_at, used_at,
                                              signer_{nombre,rut,cargo}, signature_media_id, decision, ip, user_agent
```

Notas: `codigo` correlativo por cliente (`INS-001…`) asignado en servidor (offline usa `PEND-…`,
mismo patrón que `BaseRepository`). Dexie pasa a **versión 17** (solo añade stores; **sin**
`clear()` — las versiones 14 y 16 borraron datos y no debe repetirse).

## 5. Reglas de negocio (módulo puro compartido)

Archivo nuevo `src/rules/inspectionRules.ts` (sin dependencias de UI, importable desde servidor,
testeable con `node --test` como `orderReportRules`).

| ID | Regla | Dónde se impone |
|----|-------|-----------------|
| R1 | No completar si hay ítems `null`, o `NO_CUMPLE` sin observación + acción correctiva + ≥1 foto | cliente (UX) **y** servidor (autoridad) |
| R2 | `NO_CUMPLE → CUMPLE` en re-inspección: pin pasa a `RESUELTO` conservando historial | reglas puras |
| R3 | Liberar solo si 0 `NO_CUMPLE` y ≥1 ítem aplicable evaluado en `CUMPLE` (todo-`N/A` bloquea) | servidor al firmar + UI del portal |
| R4 | `APROBADA` ⇒ inmutable (ítems, fotos, pines); toda escritura posterior rechazada con 409 | validador servidor en `/api/sync` y `/api/v1/...` |
| R5 | Módulo paralelo: no modifica OS ni mantenimientos; la aprobación deja registro en `audit_logs` y el Calendario muestra el estado | servidor y Calendario |
| R6 | Cumplimiento % = `CUMPLE / (CUMPLE + NO_CUMPLE)`; `N/A` excluido | reglas puras |
| R7 | Token: 256 bits aleatorios, hash en BD, vigencia configurable (default 7 d), un solo uso, `rateLimit` por IP | servidor |
| R8 | Foto obligatoria en `CUMPLE` según flag de plantilla | cliente + servidor |

## 6. Rutas y permisos

Frontend (todas lazy en `App.tsx`):

```
/inspecciones                 Dashboard + listado          (ver_inspecciones)
/inspecciones/nueva           Wizard: plantilla → ficha → checklist (crear_inspeccion)
/inspecciones/:id             Ejecución móvil / detalle / historial
/inspecciones/:id/plano       Visor de plano + pines
/inspecciones/plantillas      Gestor de plantillas (supervisor/administrador)
/liberar/:token               PÚBLICA, sin Layout ni sesión
/verificar/:codigo            PÚBLICA, valida autenticidad del PDF (opcional, fase 4)
```

Nuevos permisos en `PERMISOS_POR_PERFIL`: `ver_inspecciones`, `crear_inspeccion` (tecnico,
supervisor, contratista, administrador), `gestionar_plantillas` (supervisor, administrador),
`enviar_a_firma` (supervisor, administrador). `cliente`/`visita`: solo lectura de aprobadas.

API (servidor **y** handlers Vercel + `vercel.json`):

```
GET/POST/PUT  /api/v1/:cliente_id/inspections | inspection-templates | inspection-blueprints   (patrón V1_WRITABLE_RESOURCES)
POST          /api/inspections/:uuid/media            subida de foto (compresión previa en cliente)
POST          /api/inspections/:uuid/send-for-signature   → crea token, devuelve URL
GET           /api/public/liberacion/:token           resumen (sin datos internos)
POST          /api/public/liberacion/:token/sign      firma | rechazo
GET           /api/public/verificar/:codigo
```

Para no exceder el límite de funciones Vercel (hoy 6 en `api/`; **verificar el plan**), las
rutas públicas y de inspecciones entran como nuevos `handler=` dentro de `api/operations.ts`.

## 7. Plan por fases

Cada fase = una rama/PR independiente, con `npm test` y `npm run build` en verde.

### Fase 1 — Core y checklist (base)
- `src/rules/inspectionRules.ts` + `tests/inspection-rules.test.ts` (R1, R3, R6, máquina de estados).
- Dexie v17 (stores `inspections`, `inspection_templates`, `inspection_blueprints`), `InspectionRepository`, hooks `useInspecciones`.
- Bootstrap Neon + alta en `SYNC_WRITABLE_TABLES`/`ALLOWED_TABLES`/`V1_WRITABLE_RESOURCES` + validador de payload.
- Páginas: dashboard KPI (total, liberadas, pendientes, % cumplimiento, hallazgos abiertos), listado con filtros y buscador, wizard de creación, gestor de plantillas con 6 plantillas semilla.
- Ejecución móvil: Cumple/No cumple/N/A, observación (con dictado), acción correctiva, cámara, barra de progreso, bloqueo de cierre (R1).
- Fotos: compresión en cliente (~1280 px, JPEG 0.7), `inspection_media`.
- Entrada en el menú (desktop + drawer móvil) y permisos.
- **Criterio de aceptación**: un técnico completa una inspección sin conexión y se sincroniza al volver la red.

### Fase 2 — Planos y pines
- Visor con zoom/paneo (CSS transform + pointer events; sin dependencia pesada), coordenadas normalizadas.
- Alta de pines libres y vinculación de ítems `NO_CUMPLE`; colores rojo/verde automáticos (R2).
- Planos como imagen; **PDF de plano** vía `pdfjs-dist` (única dependencia nueva; requiere ajustar CSP `worker-src`/`script-src` — ya admite `blob:`).
- Integración opcional con equipo: iniciar inspección escaneando el QR del activo (`ScannerQR`).

### Fase 3 — Liberación externa
- Tabla `inspection_sign_tokens`, endpoints públicos, `rateLimit`, respuesta mínima (sin datos de otros clientes).
- Ruta pública `/liberar/:token` evaluada antes del guard de auth en `App.tsx`; layout propio móvil.
- Firma en canvas reutilizando `FullscreenSignatureModal`; nombre, RUT/DNI (validación RUT chileno), cargo; opción Rechazar/Observar.
- Bloqueo de botón si hay `NO_CUMPLE` (R3, también en servidor); invalidación tras uso; transición a `APROBADA` (R4).
- Entrega del enlace: correo con el servicio existente (`/api/export`, Resend; requiere `RESEND_API_KEY` y `RESEND_FROM_EMAIL`) y copia manual del enlace como respaldo.

### Fase 4 — PDF, trazabilidad y avance
- PDF con `jspdf`: encabezado, miniatura de plano con pines, tabla de ítems, anexo fotográfico, firmas con timestamp, código `CO-AAAA-XXXXXXXXXXXX`.
- Hash SHA-256 del contenido canónico fijado en servidor al aprobar (no recalculable por el cliente).
- Línea de tiempo auditada (creada → asignada → completada → enviada → liberada) desde `historial`.
- Auditoría en `audit_logs` y lectura de inspecciones programadas desde `Planificacion.tsx` (R5), sin duplicar eventos.
- Página pública `/verificar/:codigo`.
- Pruebas de seguridad en `tests/security-regression.test.mjs`: token reutilizado, vencido, inmutabilidad, aislamiento entre tenants.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Neon/JSONB con fotos base64 crece rápido | Compresión + tabla aparte; migrar a Vercel Blob si el volumen supera lo esperado |
| Dos backends (Express y Vercel) divergen | Lógica en módulos compartidos (`src/rules`, `server/vercel/handlers`) y un test que ejercite ambos |
| Endpoint de sync genérico permite saltar R4 | Validador por tabla en sync **y** en `/api/v1`; test de regresión |
| Migración Dexie destructiva (precedente v14/v16) | v17 solo agrega stores; revisión explícita en PR |
| PWA precache ya ~2,9 MB | Módulo lazy; `pdfjs-dist` solo en chunk del visor de planos |
| Ruta pública expone datos | DTO mínimo, sin IDs internos, `Cache-Control: no-store`, `rateLimit`, token hash |
| Video no verificado | Validar con una pasada visual del video antes de cerrar el diseño de pantallas de Fase 1 |

## 9. Decisiones abiertas (requieren confirmación del propietario)

1. **Almacenamiento de fotos**: ¿Neon (simple) o Vercel Blob/S3 (escalable) desde el inicio?
2. **Formato de planos**: ¿solo imagen en MVP o PDF desde Fase 2?
3. **Entidad que recibe el avance**: ¿Orden de Servicio, mantenimiento preventivo o ambas?
4. **Firmante externo**: el envío por correo ya existe (Resend); ¿se reutiliza para el enlace de firma o basta copiar el enlace?
5. **Alcance de roles** para `cliente` (¿ver inspecciones aprobadas dentro de la app?).
