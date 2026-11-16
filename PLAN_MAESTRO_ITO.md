# Plan Maestro — Módulo ITO (Inspección Técnica de Obra)

Estado: **plan consolidado, sin código, revisado por Gemini (veredicto: listo con condiciones), sin lanzar** · 2026-11-16

Este documento compila y reemplaza a `SPEC-INSPECCIONES.md`. Donde ambos difieran, vale este.
Fuentes: transcripción del flujo de controlobrax.cl (el video no fue visto por quien redactó),
revisión del código del repositorio y dos entrevistas con el propietario (20 preguntas más 5
decisiones previas).

## 1. Qué es y qué no es

**Es** un módulo para inspecciones técnicas de obras de **montaje, instalación y reparación**:
se planifica, se ejecuta en terreno desde el celular (también sin conexión), se marcan
observaciones sobre planos, firman tres partes y se emite un informe PDF verificable.

**No es** un sistema de avance de órdenes de servicio. Es un **módulo paralelo** a Órdenes de
Servicio y Mantenimientos: no los lee ni los modifica. Se conecta con **Clientes**, con el
**Calendario** y con lo que ya existe (usuarios, sincronización, correo).

## 2. Decisiones consolidadas

| Área | Decisión |
|------|----------|
| Número de ITO | `Correlativo.Obra.Cliente.Mes.AA`, p. ej. `0042.07.NORTEC.11.26`. Correlativo 0001–9999, obra 00–99 |
| Correlativo | Se reinicia **por cliente y por año**. Lo asigna el servidor; sin red queda provisional |
| Quién crea | Supervisor o administrador crea y asigna. El **cliente puede solicitar** una ITO; el supervisor la acepta y asigna |
| Cabecera obligatoria | Obra, zona, inspector, contratista y fecha. Plantilla, planos y partidas pueden agregarse después |
| Trabajo planificado | Checklist técnico de la plantilla **más** el avance de las partidas del contrato. El inspector puede agregar partidas en terreno |
| Partidas | Se escriben una por una (sin importar archivos) o se planifican antes. Avance en **%** con historial por ITO |
| Plan al contratista | Informarle el plan de inspección es **opcional** |
| Ítem de checklist | Cumple / No cumple / N/A, con **medición opcional** (valor, unidad, rango esperado) |
| Observaciones | Dos pestañas dentro de la ITO: **planificado** y **no planificado** |
| No planificada | Descripción, foto y responsable. **Bloquea la aprobación solo si el inspector la marca crítica** |
| Hallazgos | Responsable y fecha límite, con **aviso por correo** al asignar y al vencer. La fecha aparece en el Calendario |
| Evidencia | Fotos y **archivos adjuntos (PDF)** por ítem |
| Planos | **Biblioteca** de planos. Varios por ITO, con **revisiones** (Rev A, B, C). Imágenes primero; PDF en fase posterior |
| Marcas | Pines y dibujo (línea, círculo, texto) sobre una **capa transparente**. El documento base nunca se modifica |
| Re-inspección | Se **reabre la misma ITO**; solo se re-evalúan los No cumple; el historial queda en el ítem |
| Firmas | **Inspector → contratista → cliente** |
| Firma del cliente | El perfil `cliente` firma **dentro de la app**. El enlace temporal es para quien no tiene cuenta |
| Envío | Correo con Resend (ya existe en `api/communications.ts`) y enlace copiable de respaldo |
| Informe | PDF automático al aprobarse, con logo del cliente, a cliente, contratista e inspector. **Una sola lista** de observaciones con etiqueta |
| Plantillas | Administrador global y supervisor, **con versiones**. Una ITO conserva la versión con que nació |
| Almacenamiento | Fotos en Neon, comprimidas en el celular. Migrar si el volumen crece |
| Otros módulos | No actualiza avances de OS ni de mantenimientos |

## 3. Ciclo de vida

```
solicitada ──(supervisor acepta y asigna)──► programada ──(primer registro)──► en_progreso
                                                                                   │
                                          ┌──────────(re-inspección)───────────────┤
                                          │                                        ▼
                                      observada ◄──(contratista firma con      por_firmar
                                                    bloqueantes abiertos)          │
                                                                                   ▼
                                                              (cliente firma, R3) aprobada  [inmutable]
```

- **solicitada**: la pidió el cliente. Si la crea el supervisor, nace en `programada`.
- **por_firmar**: el inspector firmó (R1 cumplida). Esperan contratista y cliente.
- **observada**: el contratista acusó recibo y quedan bloqueantes abiertos (No cumple u observación crítica).
- **aprobada**: firmó el cliente. Queda sellada (R4).
- **rechazada**: el contratista o el cliente se niegan a firmar, con motivo obligatorio. Se avisa al supervisor, que la reabre a `en_progreso` o la archiva. *(Agregado tras la revisión externa.)*
- Pasar a `por_firmar` y crear enlaces de firma exige conexión: sin red, la firma del inspector queda en cola hasta sincronizar y recibir el correlativo definitivo.
- Mientras el número sea provisional, la pantalla muestra «Pendiente de sincronización» en lugar del número de ITO.

## 4. Modelo de datos

Patrón existente: tablas `(uuid_sync, id, data JSONB, updated_at, created_at, deleted_at, cliente_id)`,
espejo en Dexie y cola de sincronización.

| Tabla | Sync | Contenido |
|-------|------|-----------|
| `obras` | sí | número 00–99 por cliente, nombre, sucursal opcional, estado |
| `obra_partidas` | sí | obra, código, descripción, origen (`planificada` o `terreno`) |
| `ito_plantillas` | sí | nombre, especialidad, **versión**, ítems (con medición y regla de foto) |
| `planos` | sí | biblioteca por cliente u obra: nombre, revisiones `[{rev, media_id, ancho, alto}]` |
| `itos` | sí | cabecera, estado, plantilla y versión, ítems del checklist, avances de partidas, firmas, historial |
| `ito_observaciones` | sí | observaciones planificadas y no planificadas: tipo, crítica, responsable, fecha límite, estado, historial |
| `ito_marcas` | sí | marcas sobre planos: ITO, plano, revisión, tipo y coordenadas |
| `ito_media` | sí (subida aparte) | fotos y adjuntos: mime, tamaño, sha256, ITO, ítem u observación |
| `ito_secuencias` | **solo servidor** | contador por cliente y año |
| `ito_tokens_firma` | **solo servidor** | hash del token, vencimiento, uso, firmante |

Decisiones de diseño:

1. **Checklist y avances viven dentro de la ITO** (`data`); **observaciones y marcas van en tablas propias**. Cambio tras la revisión externa: con un solo JSON y «gana el último», un cambio del supervisor en la cabecera y el trabajo del inspector sin red se pisarían.
2. **Desde `en_progreso`, la cabecera solo la edita el servidor en línea** (reasignar inspector, cambiar fecha), nunca por sincronización de un dispositivo.
3. **Las marcas son de la ITO, no del plano**: `{plano_id, rev, tipo, x, y, x2?, y2?, texto?}` con coordenadas 0–1. Cada revisión guarda ancho, alto y proporción; si una revisión nueva cambia la proporción, el sistema avisa y las marcas anteriores quedan con su revisión, sin trasladarse.
4. **Fotos y adjuntos fuera del JSON** (`ito_media`), para no inflar la sincronización.
5. **Tokens de firma 1:N** por ITO; se guarda solo `sha256(token)`; nunca llegan al dispositivo.
6. **Dexie v17 solo agrega tablas.** Las versiones 14 y 16 vaciaron datos; no se repite.

## 5. Reglas de negocio

Viven en `src/rules/itoRules.ts` (módulo puro, usado por cliente y servidor, con tests). El
servidor es la autoridad.

| ID | Regla |
|----|-------|
| R1 | El inspector no puede firmar con ítems sin evaluar, ni con un No cumple sin observación, acción correctiva, responsable, fecha límite y al menos una foto. Tampoco con una observación no planificada **crítica** sin descripción, responsable y foto |
| R2 | No cumple → Cumple en re-inspección: el pin pasa a resuelto y la observación original se conserva en el historial |
| R3 | El cliente aprueba solo con **0 No cumple abiertos y 0 observaciones no planificadas críticas abiertas**, y con al menos un ítem aplicable en Cumple |
| R4 | `aprobada` es inmutable: el servidor rechaza con 409 toda escritura posterior, también la que llegue por `/api/sync` |
| R5 | El módulo no escribe en órdenes de servicio ni mantenimientos |
| R6 | Cumplimiento % = Cumple ÷ (Cumple + No cumple). N/A no cuenta |
| R7 | Token de 256 bits, solo su hash en la base, vence en 7 días (configurable), un uso. Límite de intentos con el limitador respaldado en base de datos (`cmms_rate_limits`), no en memoria. Un enlace vencido se regenera desde la pantalla de firmas, lo que invalida el anterior |
| R8 | Foto obligatoria en Cumple solo si la plantilla lo exige |
| R9 | El correlativo lo asigna el servidor de forma atómica por cliente y año; nunca se reutiliza un número |
| R10 | Orden de firmas: inspector, contratista, cliente. Ninguna se salta |
| R11 | El archivo original de un plano no se modifica; una revisión nueva no borra las marcas de la anterior |
| R12 | Una ITO conserva la versión de plantilla con que nació |
| R13 | Si el servidor rechaza un cambio por inmutabilidad (409), el dispositivo descarta ese cambio de su cola y reemplaza su copia local por la versión del servidor |

## 6. Perfiles

| Acción | visita | cliente | contratista | técnico | supervisor | administrador |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|
| Solicitar ITO | | ✔ | | | ✔ | ✔ |
| Crear y asignar | | | | | ✔ | ✔ |
| Ejecutar (inspector) | | | | ✔ | ✔ | ✔ |
| Firmar como contratista | | | ✔ | | | |
| Firmar como cliente | | ✔ | | | | |
| Gestionar plantillas y planos | | | | | ✔ | ✔ |
| Ver ITO aprobadas | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

## 7. Pantallas y rutas

```
/inspecciones                 panel: KPIs, filtros, listado
/inspecciones/nueva           cabecera obligatoria + plan opcional (plantilla, planos, partidas)
/inspecciones/:id             ejecución: switch planificado / no planificado, partidas, checklist
/inspecciones/:id/planos      biblioteca, revisiones, capa de marcas
/inspecciones/:id/firmas      tres firmas en orden
/inspecciones/plantillas      plantillas con versiones
/liberar/:token               PÚBLICA: firma de quien no tiene cuenta
/verificar/:codigo            PÚBLICA: autenticidad del informe
```

El Calendario (`Planificacion.tsx`) suma una fuente de lectura: ITO programadas, fechas límite
de hallazgos y solicitudes de clientes, con el número de ITO. No se crean eventos duplicados.

Prototipo navegable: `docs/PROTOTIPO_FRONT_ITO.html`. Diseño del informe: `docs/INFORME_ITO_EJEMPLO.pdf`.

## 8. Dónde se toca el código

| Archivo | Cambio |
|---------|--------|
| `src/rules/itoRules.ts` + `tests/` | reglas puras y máquina de estados |
| `src/db/database.ts` | Dexie v17, solo agrega tablas |
| `scripts/db/bootstrap.ts` | tablas nuevas, incluidas las dos de solo servidor |
| `server.ts` | listas de sincronización, validador por tabla (R4), endpoints |
| `api/operations.ts` + `vercel.json` | los mismos endpoints para producción en Vercel |
| `api/communications.ts` | avisos de hallazgos, enlace de firma, envío del informe |
| `src/App.tsx` | rutas del módulo; rutas públicas atendidas **antes** del control de sesión |
| `src/components/Layout.tsx`, `src/types.ts` | menú y permisos |
| `src/pages/Planificacion.tsx` | nueva fuente de lectura |

## 9. Fases

Cada fase es una rama y un PR, con `npm test` y `npm run build` en verde. Los tamaños son
relativos entre sí, no estimaciones de tiempo.

| Fase | Contenido | Tamaño | Criterio de aceptación |
|------|-----------|--------|------------------------|
| **0. Cierre del plan** | Resolver los puntos abiertos de la sección 11; revisión externa del plan | Pequeño | Sin puntos abiertos que cambien el modelo de datos |
| **1A. Estructura** | Reglas con tests; Dexie v17; tablas en Neon; obras y partidas; código corto del cliente; plantillas con versiones; menú y permisos | Mediano | Datos maestros creados y sincronizados; migración sin pérdida de datos |
| **1B. Ejecución** | Crear ITO; ejecución con checklist, mediciones, avance de partidas y observaciones; fotos y adjuntos; panel. **Incluye los tests de inmutabilidad (R4, R13) y de aislamiento entre clientes** | Grande | Un inspector completa una ITO sin red y se sincroniza al volver; los tests de seguridad pasan |
| **2. Planos** | Biblioteca, revisiones, visor con zoom, capa de marcas (pin, línea, círculo, texto), pines ligados a ítems | Mediano | Una marca hecha en Rev A sigue con Rev A tras subir Rev B; el original no cambia |
| **3. Firmas y avisos** | Tres firmas en orden; rechazo con motivo; solicitud del cliente; firma del cliente en la app; enlace temporal y su regeneración; avisos por correo de hallazgos. **Incluye los tests del token** (reutilizado, vencido, fuerza bruta) | Mediano | El cliente no puede aprobar con bloqueantes; el enlace usado deja de servir; los tests del token pasan |
| **4. Informe y calendario** | PDF con el diseño aprobado en jsPDF; hash y código de verificación; envío automático; página de verificación; fuente en el Calendario | Mediano | Un PDF aprobado se verifica por código y la ITO aparece en el Calendario |
| **5. Piloto** | Repaso completo de seguridad y piloto con una obra real | Pequeño | Pruebas de regresión en verde y piloto sin incidentes |

## 10. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| `/api/sync` valida poco y permitiría saltarse la inmutabilidad (R4) | Validador por tabla en sincronización y en la API; test de regresión |
| Fotos y **PDF adjuntos** en Neon crecen rápido | Compresión, tamaño máximo por archivo, tabla aparte; medir en el piloto y migrar si hace falta |
| Dos backends (Express y Vercel) que divergen | Lógica en módulos compartidos; un test que ejercite ambos |
| Primera ruta pública de la app (`/liberar`) | Respuesta mínima sin identificadores internos, límite de intentos, token con hash, pruebas antes de publicar |
| Dos inspectores editando la misma ITO sin red: gana el último y el otro cambio se pierde sin aviso | Una ITO, un inspector asignado; detectar versión en el servidor y avisar del conflicto |
| El aviso «al vencer» necesita una tarea programada que hoy no existe | Definir el mecanismo en la Fase 0 (ver punto abierto 5) |
| El PDF real se arma con jsPDF, que no replica el HTML del prototipo | Reproducir el diseño con sus primitivas; validar contra el PDF de ejemplo |
| Migración Dexie destructiva (precedente en v14 y v16) | v17 solo agrega tablas; revisión explícita en el PR |

## 11. Puntos abiertos antes de lanzar

1. **Cierre de una observación crítica no planificada**: ¿por re-inspección, por aceptación del inspector, o ambas?
2. **Obra**: ¿es una entidad nueva (00–99 por cliente) o equivale a una sucursal existente?
3. **Código corto del cliente** (`NORTEC` en el número): los clientes hoy no tienen ese campo; hay que agregarlo y definir quién lo asigna.
4. **Firmas al reabrir**: si una ITO observada se reabre, ¿las firmas del inspector y del contratista se piden de nuevo?
5. **Aviso al vencer un hallazgo**: requiere una tarea programada en el servidor; confirmar que el plan de Vercel la permite.
6. **Tamaño máximo** de fotos y adjuntos, y si las fotos exigen GPS.
7. **Límites del número**: 100 obras por cliente y 9.999 ITO por cliente al año. ¿Alcanzan?
8. **Supuestos por confirmar**: el Calendario lee las ITO sin duplicar eventos; el cliente ve solo ITO enviadas a firma, aprobadas u observadas; cada ITO y plano pertenece al cliente activo.
9. **Límite de funciones en Vercel**: hoy hay 6 en `api/`; por eso los endpoints nuevos entran en `api/operations.ts`. Verificar el plan contratado.
10. **Validar las pantallas contra el video**, que no fue visto al redactar.

## 12. Documentos del proyecto

| Documento | Estado |
|-----------|--------|
| `PLAN_MAESTRO_ITO.md` | **vigente** |
| `docs/PROTOTIPO_FRONT_ITO.html` | vigente (pantallas) |
| `docs/INFORME_ITO_EJEMPLO.pdf`, `docs/FILOSOFIA_DISENO_INFORME.md` | vigentes (diseño del informe) |
| `docs/DIAGRAMAS_PROCESO_MODULOS.html` | vigente (cómo funciona hoy la app) |
| `SPEC-INSPECCIONES.md` | histórico, reemplazado por este plan |
| `docs/PLAN_INSPECCION_DE_OBRA.html` | **desactualizado**: muestra dos firmas y no incluye partidas, planos con revisiones ni observaciones no planificadas |

## 13. Lista de lanzamiento

- [x] Revisión externa del plan (Gemini, sección 14)
- [ ] Puntos abiertos 1 a 5 resueltos (cambian el modelo o el flujo)
- [ ] Puntos abiertos 6 a 10 resueltos o aceptados como riesgo
- [ ] Diagrama del plan actualizado o retirado
- [ ] Aprobación del propietario para iniciar la Fase 1

## 14. Revisión externa (Gemini)

Revisión hecha con `gemini-3.6-flash` el 2026-11-16. El modelo Pro no estaba disponible en el
nivel gratuito de la clave. Respuesta completa, sin editar: `docs/REVISION_GEMINI_PLAN_MAESTRO.md`.
**Veredicto: listo con condiciones.**

| # | Hallazgo de Gemini | Gravedad | Qué se hizo |
|---|--------------------|----------|-------------|
| 1.1 | Las firmas al reabrir no están definidas y chocan con R10 | Alta | **Pendiente del propietario** (punto abierto 4). Gemini recomienda invalidarlas y pedir las tres de nuevo |
| 1.2 | R1 no cubría las observaciones críticas no planificadas | Media | **Aceptado**: R1 ampliada |
| 2.1 | No había salida si el contratista o el cliente rechazan | Alta | **Aceptado**: estado `rechazada` |
| 2.2 | Firma del inspector sin red con número provisional | Alta | **Aceptado**: `por_firmar` exige conexión |
| 2.3 | Token vencido sin forma de regenerarlo | Media | **Aceptado**: regeneración en R7 |
| 3.1 | Un solo JSON por ITO con «gana el último» pierde cambios | Alta | **Aceptado en parte**: observaciones y marcas pasan a tablas propias, y la cabecera deja de editarse por sincronización. El checklist sigue dentro de la ITO |
| 3.2 | Coordenadas 0–1 se desalinean si la revisión cambia de proporción | Media | **Aceptado**: se guarda la proporción y las marcas no se trasladan entre revisiones |
| 3.3 | El número provisional confunde al inspector | Media | **Aceptado**: se muestra «Pendiente de sincronización» |
| 4.1 | Un 409 por inmutabilidad bloquearía la cola de sincronización | Alta | **Aceptado con corrección**: verificado en `syncEngine.ts` que la cola no se bloquea (un cambio fallido sale del ciclo tras 3 intentos), pero el registro quedaba en conflicto sin resolverse. Nueva R13 |
| 4.2 | El límite de intentos por IP no sirve en funciones sin estado; propone Redis | Alta | **Rechazada la solución, aceptado el riesgo**: verificado que `server/vercel/security.ts` ya limita con la tabla `cmms_rate_limits` en Neon. No hace falta Redis; R7 exige usar ese limitador |
| 4.3 | El endpoint público podría exponer la ITO completa | Media | **Ya estaba en el plan** (sección 10: respuesta mínima) |
| 5.1 | La Fase 1 es demasiado grande | Media | **Aceptado**: dividida en 1A y 1B |
| 5.2 | Las pruebas de seguridad llegaban al final | Media | **Aceptado**: pasan a las fases 1B y 3 |

Recomendaciones de Gemini para los puntos abiertos 1 a 5, que **siguen siendo decisión del propietario**:

1. Observación crítica no planificada: se cierra solo por re-inspección, con foto.
2. Obra: entidad nueva ligada al cliente, con sucursal opcional.
3. Código corto del cliente: campo nuevo editable por el administrador, con las primeras letras del nombre por defecto.
4. Firmas al reabrir: se invalidan y se piden las tres de nuevo.
5. Aviso al vencer: tarea programada diaria en Vercel. Hoy `vercel.json` no define ninguna.

Condiciones de Gemini para iniciar la Fase 1 y su estado: resolver los puntos abiertos 1 a 5
(**pendiente**), separar observaciones y marcas del JSON (**hecho en el plan**) y definir el
manejo del 409 (**hecho en el plan**, R13).
