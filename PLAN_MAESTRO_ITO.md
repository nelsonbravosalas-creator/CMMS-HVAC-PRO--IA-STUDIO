# Plan Maestro — Módulo ITO (Inspección Técnica de Obra)

Estado: **plan consolidado, sin código, revisado por Gemini; sin puntos abiertos que bloqueen; pendiente la validación de pantallas contra el video y la aprobación para lanzar la Fase 1A** · 2026-11-17

Este documento compila y reemplaza a `SPEC-INSPECCIONES.md`. Donde ambos difieran, vale este.
Fuentes: transcripción del flujo de controlobrax.cl (el video no fue visto por quien redactó),
revisión del código del repositorio, dos entrevistas con el propietario (20 preguntas más 5
decisiones previas) y una tercera ronda de 10 preguntas sobre las observaciones de Gemini.

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
| Número de ITO | `Correlativo.Obra.Cliente.Mes.AA`, p. ej. `0042.007.NORTEC.11.26`. Correlativo 0001–9999, **obra 000–999 (3 dígitos)**. Si un cliente llega a 9.999 ITO en un año, el sistema avisa y bloquea en vez de repetir un número |
| Correlativo | Se reinicia **por cliente y por año**. Lo asigna el servidor; sin red queda provisional |
| Quién crea | Supervisor o administrador crea y asigna. El **cliente puede solicitar** una ITO; el supervisor la acepta y asigna |
| Cabecera obligatoria | Obra, zona, inspector, contratista y fecha. Plantilla, planos y partidas pueden agregarse después |
| Trabajo planificado | Checklist técnico de la plantilla **más** el avance de las partidas del contrato. El inspector puede agregar partidas en terreno |
| Partidas | Se escriben una por una (sin importar archivos) o se planifican antes. Avance en **%** con historial por ITO |
| Plan al contratista | Informarle el plan de inspección es **opcional** |
| Ítem de checklist | Cumple / No cumple / N/A, con **medición opcional** (valor, unidad, rango esperado) |
| Observaciones | Dos pestañas dentro de la ITO: **planificado** y **no planificado** |
| No planificada | Descripción, foto y responsable. **Bloquea la aprobación solo si el inspector la marca crítica** |
| Hallazgos | Responsable y fecha límite, con **aviso por correo al asignar**. La fecha aparece en el Calendario. **Sin correo al vencer por ahora**: los vencidos se ven en rojo en el panel y en el Calendario |
| Cierre de una observación crítica no planificada | **Re-inspección o aceptación del inspector.** La aceptación exige una justificación escrita, que queda en el historial y en el informe |
| Obra | **Entidad nueva** por cliente (número 000–999, nombre), con **sucursal opcional**. Una sucursal puede tener varias obras |
| Código corto del cliente | **Campo nuevo** en la ficha del cliente, de hasta 6 letras y único. El sistema sugiere las primeras letras del nombre y el administrador lo ajusta |
| Firmas al reabrir | **Se conservan** las del inspector y del contratista; solo falta el cliente (ver R10) |
| Rechazo de firma | Estado **`rechazada`** con motivo obligatorio; el supervisor decide si reabre o archiva |
| Inspector sin conexión | Puede firmar; el paso a «por firmar», el número definitivo y los avisos ocurren al sincronizar |
| Conflictos de edición | Observaciones y marcas en tablas propias; la **cabecera solo se edita con conexión** |
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
| Archivos | Fotos de unos **300 KB**; adjuntos PDF de hasta **3 MB**; fecha y hora en cada foto; **GPS opcional** (se guarda si el inspector lo autoriza) |
| Perfil cliente (visibilidad) | Ve las ITO de su empresa **enviadas a firma, observadas, rechazadas y aprobadas**; no ve borradores ni ITO en ejecución |
| Vercel | Plan **Hobby**: los endpoints nuevos van agrupados en funciones existentes |
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
- **rechazada**: el contratista o el cliente se niegan a firmar, con motivo obligatorio. Se avisa al supervisor, que la reabre a `en_progreso` o la archiva.
- **Reapertura**: una ITO `observada` o `rechazada` vuelve a `en_progreso` para re-inspeccionar solo lo pendiente. Las firmas del inspector y del contratista se conservan (R10).
- El inspector puede firmar sin red. El paso a `por_firmar`, la creación de enlaces de firma y los avisos quedan en cola hasta sincronizar y recibir el número definitivo.
- Mientras el número sea provisional, la pantalla muestra «Pendiente de sincronización» en lugar del número de ITO.

## 4. Modelo de datos

Patrón existente: tablas `(uuid_sync, id, data JSONB, updated_at, created_at, deleted_at, cliente_id)`,
espejo en Dexie y cola de sincronización.

| Tabla | Sync | Contenido |
|-------|------|-----------|
| `obras` | sí | número 000–999 por cliente, nombre, `sucursal_id` opcional, estado |
| `clientes` (existente) | sí | **se agrega** `codigo_corto` (hasta 6 letras, único, sugerido por el sistema, editable por el administrador) |
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
| R10 | Orden de firmas: inspector, contratista, cliente. Ninguna se salta. **Al reabrir una ITO observada o rechazada, las firmas del inspector y del contratista se conservan** y solo falta la del cliente. Cada re-inspección se registra en el historial con fecha, inspector y resultado, y el informe final las lista. Consecuencia aceptada: el contratista no firma el resultado final, solo el acuse inicial |
| R11 | El archivo original de un plano no se modifica; una revisión nueva no borra las marcas de la anterior |
| R12 | Una ITO conserva la versión de plantilla con que nació |
| R13 | Si el servidor rechaza un cambio por inmutabilidad (409), el dispositivo descarta ese cambio de su cola y reemplaza su copia local por la versión del servidor |
| R14 | Una observación crítica no planificada se cierra por re-inspección (con foto) o por aceptación del inspector (con justificación escrita). Ambas quedan en el historial |
| R15 | La cabecera de una ITO (inspector, fecha, obra, contratista) solo la modifica el servidor con conexión; un dispositivo que estuvo sin red no la sobrescribe |

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

El Calendario (`Planificacion.tsx`) muestra las ITO programadas, las fechas límite de hallazgos
y las solicitudes de clientes, con el número de ITO. **Decisión del propietario: se crea un
evento por cada ITO** en la tabla de eventos existente (en vez de leer las ITO directamente,
que era la recomendación). Reglas: el evento lleva el UUID de la ITO y su origen; solo lo
escribe el código de ITO (en el Calendario es de solo lectura); cambia de fecha o de estado
cuando cambia la ITO, en la misma operación; y se elimina o archiva si la ITO se archiva.

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
| `src/pages/Planificacion.tsx` | mostrar los eventos de origen ITO como solo lectura |

## 9. Fases

Cada fase es una rama y un PR, con `npm test` y `npm run build` en verde. Los tamaños son
relativos entre sí, no estimaciones de tiempo.

| Fase | Contenido | Tamaño | Criterio de aceptación |
|------|-----------|--------|------------------------|
| **0. Cierre del plan** | Resolver los puntos abiertos de la sección 11; revisión externa del plan | Pequeño | **Cumplida** salvo los puntos 6 a 10, que no cambian el modelo |
| **1A. Estructura** | Reglas con tests; Dexie v17; tablas en Neon; obras y partidas; código corto del cliente; plantillas con versiones; menú y permisos | Mediano | Datos maestros creados y sincronizados; migración sin pérdida de datos |
| **1B. Ejecución** | Crear ITO; ejecución con checklist, mediciones, avance de partidas y observaciones; fotos y adjuntos; panel. **Incluye los tests de inmutabilidad (R4, R13) y de aislamiento entre clientes** | Grande | Un inspector completa una ITO sin red y se sincroniza al volver; los tests de seguridad pasan |
| **2. Planos** | Biblioteca, revisiones, visor con zoom, capa de marcas (pin, línea, círculo, texto), pines ligados a ítems | Mediano | Una marca hecha en Rev A sigue con Rev A tras subir Rev B; el original no cambia |
| **3. Firmas y avisos** | Tres firmas en orden; rechazo con motivo; solicitud del cliente; firma del cliente en la app; enlace temporal y su regeneración; aviso por correo al asignar un hallazgo y al enviar a firma. **Incluye los tests del token** (reutilizado, vencido, fuerza bruta) | Mediano | El cliente no puede aprobar con bloqueantes; el enlace usado deja de servir; los tests del token pasan |
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
| Sin aviso por correo al vencer un hallazgo | Decisión del propietario: se agrega más adelante; mientras tanto, rojo en el panel y en el Calendario |
| El contratista no firma el resultado final tras una re-inspección | Decisión del propietario; el historial y el informe listan cada re-inspección con fecha, inspector y resultado |
| La aceptación de una crítica por el inspector, sin volver a terreno, reduce la evidencia | Justificación escrita obligatoria, visible en el informe que recibe el cliente |
| El PDF real se arma con jsPDF, que no replica el HTML del prototipo | Reproducir el diseño con sus primitivas; validar contra el PDF de ejemplo |
| Migración Dexie destructiva (precedente en v14 y v16) | v17 solo agrega tablas; revisión explícita en el PR |
| Un evento por ITO puede quedar desalineado de la ITO (fecha o estado) | Se escribe en la misma operación que la ITO; el evento no se edita desde el Calendario; test que compruebe ambos |
| Plan Hobby de Vercel: cuerpo de petición de hasta 4,5 MB (un PDF de 3 MB en base64 pesa ~4 MB), pocas funciones y una sola ejecución diaria en tareas programadas | Subir adjuntos como binario y no en base64; agrupar endpoints; si llega el correo al vencer, una ejecución al día alcanza |

## 11. Puntos abiertos antes de lanzar

**Resueltos el 2026-11-17** (los cinco que bloqueaban el inicio): cierre de una crítica no
planificada, entidad obra, código corto del cliente, firmas al reabrir y aviso al vencer.
Las decisiones están en la sección 2.

**Resueltos también el 2026-11-17** (los demás puntos):

| Punto | Decisión |
|-------|----------|
| Tamaño de archivos y GPS | Fotos de unos 300 KB, PDF de hasta 3 MB, GPS opcional |
| Límites del número | **Obra pasa a 3 dígitos (000–999)**; correlativo se mantiene en 0001–9999 |
| Visibilidad del perfil cliente | Enviadas a firma, observadas, rechazadas y aprobadas |
| Cómo aparece en el Calendario | **Un evento por cada ITO** (distinto de la recomendación; ver sección 7 y riesgos) |
| Plan de Vercel | **Hobby**; se verificó que el plan no es visible desde la herramienta de Vercel, así que es dato del propietario |
| Aviso al vencer un hallazgo | Aplazado; en Hobby alcanzaría una ejecución diaria cuando se haga |

**Sigue abierto:**

1. **Validar las pantallas contra el video**, que no fue visto al redactar. El propietario lo revisará y reportará las diferencias; el prototipo se ajusta antes de la Fase 1B.

Supuesto vigente: cada ITO y plano pertenece al cliente activo y a una de sus obras o sucursales.

## 12. Documentos del proyecto

| Documento | Estado |
|-----------|--------|
| `PLAN_MAESTRO_ITO.md` | **vigente** |
| `docs/PROTOTIPO_FRONT_ITO.html` | vigente (pantallas) |
| `docs/INFORME_ITO_EJEMPLO.pdf`, `docs/FILOSOFIA_DISENO_INFORME.md` | vigentes (diseño del informe) |
| `docs/DIAGRAMAS_PROCESO_MODULOS.html` | vigente (cómo funciona hoy la app) |
| `SPEC-INSPECCIONES.md` | histórico, reemplazado por este plan |
| `docs/MAPA_PROCESO_ITO.html` | **vigente**: mapa de proceso con entradas, proceso y salidas, flujos por rol, estados, reglas, **revisión crítica** (14 inconsistencias, 10 optimizaciones y 20 capacidades de libro de obra) y revisión para aprobar |
| `docs/PLAN_INSPECCION_DE_OBRA.html` | **reemplazado** por el mapa de proceso; muestra dos firmas y no incluye partidas, planos con revisiones ni observaciones no planificadas |

## 13. Lista de lanzamiento

- [x] Revisión externa del plan (Gemini, sección 14)
- [x] Los cinco puntos que cambiaban el modelo o el flujo, resueltos (2026-11-17)
- [x] Puntos abiertos de la sección 11 resueltos, salvo la validación contra el video
- [ ] Validación de las pantallas contra el video, con diferencias reportadas y corregidas en el prototipo
- [ ] Diagrama del plan actualizado o retirado
- [ ] Aprobación del propietario para iniciar la Fase 1

## 14. Revisión externa (Gemini)

Revisión hecha con `gemini-3.6-flash` el 2026-11-16. El modelo Pro no estaba disponible en el
nivel gratuito de la clave. Respuesta completa, sin editar: `docs/REVISION_GEMINI_PLAN_MAESTRO.md`.
**Veredicto: listo con condiciones.**

| # | Hallazgo de Gemini | Gravedad | Qué se hizo |
|---|--------------------|----------|-------------|
| 1.1 | Las firmas al reabrir no están definidas y chocan con R10 | Alta | **Resuelto con una decisión distinta a la de Gemini**: el propietario eligió conservar las firmas del inspector y del contratista. R10 lo declara y registra cada re-inspección en el historial |
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

Recomendaciones de Gemini para los cinco puntos que bloqueaban el inicio, y qué decidió el propietario el 2026-11-17:

| # | Punto | Recomendación de Gemini | Decisión del propietario |
|---|-------|-------------------------|--------------------------|
| 1 | Cierre de una crítica no planificada | Solo por re-inspección, con foto | **Distinta**: re-inspección **o** aceptación del inspector con justificación |
| 2 | Obra | Entidad nueva, sucursal opcional | **Igual** |
| 3 | Código corto del cliente | Campo nuevo, editable por el administrador | **Igual** |
| 4 | Firmas al reabrir | Invalidarlas y pedir las tres de nuevo | **Distinta**: se conservan; solo falta el cliente |
| 5 | Aviso al vencer un hallazgo | Tarea diaria en Vercel | **Distinta**: sin correo al vencer por ahora |

También respondió el propietario a las demás observaciones: rechazo de firma con estado `rechazada` (igual),
firma del inspector sin red en cola (igual), tablas separadas y cabecera bloqueada (igual), Fase 1 dividida en
1A y 1B (igual) y pruebas de seguridad en cada fase (igual).

Condiciones de Gemini para iniciar la Fase 1: resolver los cinco puntos (**hecho**), separar observaciones y
marcas del JSON (**hecho**) y definir el manejo del 409 (**hecho**, R13). **Las tres condiciones están cumplidas.**

## 15. Revisión crítica (2026-11-17)

Lectura independiente del plan, incluida en `docs/MAPA_PROCESO_ITO.html` (pestaña «Revisión crítica»).
Conclusión: el proceso funciona como **inspección con tres firmas**, pero **no es todavía un libro de obra**.
Seis inconsistencias son de gravedad alta y se recomienda cerrarlas **antes de la Fase 1A**:

| # | Inconsistencia alta |
|---|---------------------|
| I1 | Una ITO aprobada no se puede corregir: falta ITO complementaria o anotación de corrección |
| I2 | Las firmas conservadas al reabrir ya no respaldan el resultado final |
| I3 | Dos fuentes de verdad para las observaciones (checklist y tabla de observaciones) |
| I4 | Las críticas no planificadas las puede cerrar quien las levantó; trato distinto al No cumple |
| I5 | El número de ITO es por cliente y año; un libro exige folio consecutivo por obra |
| I6 | No está definido quién es dueño de la cuenta ni cómo entra el contratista de otra empresa |

Decisión previa a lanzar: ¿se construye la inspección con firmas (vía A), la inspección más un libro de obra
mínimo (vía B, recomendada) o el libro completo con gestión de obra (vía C)? Cambia el modelo de datos desde la Fase 1A.

## 16. Líneas de desarrollo anotadas por el propietario (borrador, 2026-11-17)

Apuntes del propietario, incompletos. Se registran tal cual para no perderlos; **ninguno cambia todavía el plan vigente**.

| # | Línea | Estado |
|---|-------|--------|
| 1 | Vincular los usuarios con roles y correo | Anotada |
| 2 | «Metodología de cómo…» | **Incompleta**: el texto quedó cortado |
| 3 | Desarrollar el módulo **Libro de Obra** con mayor detalle; **la ITO será hija del Libro de Obra** | Anotada; equivale a la vía B o C de la sección 15 |
| 4 | (vacía) | **Incompleta** |

Efecto previsto de la línea 3 sobre el plan, a confirmar al diseñarla: el Libro de Obra pasa a ser la entidad
principal (una por obra, con folio consecutivo) y la ITO se convierte en un tipo de anotación dentro de él. Eso
reordena las fases: el libro, los participantes por obra y las anotaciones van antes que la ITO. Aborda de
raíz las inconsistencias I1 (corrección sin borrar), I5 (folio por obra) e I6 (participantes por obra y empresa).

## 17. Resolución de las 14 inconsistencias (2026-11-17)

Decisiones del propietario sobre la revisión crítica (sección 15). **Prevalecen sobre las secciones 2 a 11 donde
difieran.** La ITO se entiende como **hija del Libro de Obra** (sección 16, apunte 3).

| # | Inconsistencia | Decisión | Respecto a la recomendación |
|---|----------------|----------|------------------------------|
| I1 | Una ITO aprobada no se puede corregir | **Anotación de corrección en el libro**: no se toca la ITO; la anotación la referencia y lleva firma | Igual |
| I2 | Las firmas conservadas no respaldan el resultado final | **Cada firma queda ligada a la versión que firmó (con hash).** Al cerrar una revisión queda como **R00**; cada nuevo cierre agrega **R01, R02…** (R de revisión y correlativo de 2 dígitos). El cliente aprueba la versión final, que lista qué cambió | Igual, con el formato de revisión definido por el propietario |
| nuevo | Cómo responde el contratista | **Respuesta por observación, con texto, fotos y adjuntos, acción tomada y fecha.** La observación pasa a «respondida»; el inspector verifica en la re-inspección y la cierra o la devuelve. La respuesta queda en el historial y en la revisión siguiente | Igual |
| I3 | Dos fuentes de verdad para las observaciones | **Una sola tabla de observaciones** (planificadas, no planificadas, críticas); el ítem del checklist guarda su resultado y apunta a la observación | Igual |
| I4 | Cierre desigual de las críticas | **Como está: el inspector acepta con justificación**, sin segunda persona | **Distinta** (se recomendaba segunda persona) |
| I5 | El número no sirve como folio de obra | **Folio del libro por obra, consecutivo, además del número de ITO** (que conserva su formato y su revisión) | Igual |
| I6 | Dueño de la cuenta y acceso del contratista | **Participantes por obra**: usuario con correo, empresa y rol en esa obra, invitados por correo | Igual |
| I7 | Una sola fecha para varias visitas | **Dos fechas por revisión: apertura y cierre**; cada revisión reinicia ambas. El informe final muestra la **fecha de apertura** y el **cierre de la última revisión**, cuando el inspector la cierra en conformidad. No hay entidad Visita | **Distinta** (se proponía una entidad Visita) |
| I8 | Eventos del Calendario | **Un evento por revisión (de apertura a cierre)** más uno por cada fecha límite de observación; se escriben en la misma operación que la ITO y son de solo lectura en el Calendario | Igual |
| I9 | Dos conceptos para trabajo fuera de contrato | **Una sola figura: trabajo no planificado**, con partida opcional | Igual |
| I10 | Hora de una firma sin red | **Se guardan la hora del dispositivo y la del servidor**; una diferencia grande queda marcada | Igual |
| I11 | «Por firmar» sin plazo | **Estado por firma, plazo configurable por obra y aviso al supervisor** | Igual |
| I12 | Falta el flujo previo de apertura de obra | **Se crea la obra al programar la primera ITO** | **Distinta** (se proponía una etapa de apertura del libro) |
| I13 | Avisos tardíos y fecha límite sin consecuencia | **Se declara que el aviso sale al sincronizar** y los vencidos se destacan en rojo en los paneles y en el Calendario, sin correo al vencer | Igual |
| I14 | Sin tope de evidencia | **Hasta 5 fotos y 2 PDF por observación y 150 MB por ITO; subida por partes** de no más de 4,5 MB por petición, reanudable | Igual |

### Reglas nuevas o modificadas

| ID | Regla |
|----|-------|
| R16 | Una ITO cerrada no se edita ni se borra: un error se corrige con una anotación del libro que la referencia |
| R17 | Cada firma lleva el hash de la versión que firmó, la hora del dispositivo y la hora del servidor |
| R18 | Cada revisión (R00, R01…) tiene fecha de apertura y de cierre propias; al reabrir se crea la siguiente |
| R19 | La respuesta del contratista es por observación; el inspector la verifica o la devuelve |
| R20 | Cada firma tiene su estado y su plazo; al vencer el plazo se avisa al supervisor |
| R21 | Cada anotación del libro, incluida la ITO, lleva un folio consecutivo por obra asignado por el servidor |
| R14 (modificada) | El inspector cierra una observación por re-inspección o por aceptación con justificación escrita; no requiere segunda persona |

### Tensiones que dejan estas decisiones (a revisar antes de lanzar)

1. **Interpretación de «cierre» (I2 e I7).** Se asume que una revisión se cierra cuando el inspector firma. Si el contratista queda con observaciones, se abre la revisión siguiente (R01) con nueva fecha de apertura. **Por confirmar.**
2. **Crear la obra con la primera ITO (I12) frente al Libro de Obra y los participantes por obra (I6).** El libro de una obra debería existir desde el inicio y los participantes se necesitan para asignar al inspector y al contratista. Al crear la primera ITO habrá que pedir, en el mismo asistente, la obra, sus participantes y sus partidas. Mientras tanto, el libro de la obra empezaría con la ITO como primer folio y no podría haber anotaciones anteriores.
3. **El inspector cierra sus propias críticas (I4).** Se mantiene el conflicto de interés. Mitigación propuesta: toda aceptación con justificación aparece destacada en el informe que recibe el cliente, que puede rechazar la aprobación.
4. **Plazo de firma con aviso al supervisor (I11) frente a «sin correo al vencer» (I13).** Un aviso al vencer un plazo necesita una tarea programada o una revisión al abrir la app. Hay que elegir: una ejecución diaria en Vercel Hobby (solo para este aviso) o mostrar los plazos vencidos en el panel y avisar al abrir. **Por decidir.**
5. **Tope de 150 MB por ITO (I14).** Con muchas ITO por obra puede superar el almacenamiento de Neon contratado. Verificar la cuota y, si hace falta, bajar el tope o pasar la evidencia a otro almacén.
6. **Efecto en el mapa de proceso.** Hay que agregar la etapa de respuesta del contratista, las revisiones R00 y siguientes, las dos fechas por revisión y el Libro de Obra como entidad principal. El mapa publicado todavía muestra el flujo anterior.
