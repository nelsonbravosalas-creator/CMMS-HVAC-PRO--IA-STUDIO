# Reporte QA de producción — CMMS HVAC PRO

**Fecha:** 24 de julio de 2026  
**Entorno:** `https://cmms-hvac-pro-ia-studio.vercel.app`  
**Tipo de prueba:** caja negra sobre producción, navegación real por perfiles, permisos, consola, responsive y endpoints críticos  
**Resultado global:** **NO APROBADO**

## Resumen ejecutivo

El sitio carga y los seis perfiles parametrizados pueden autenticarse con PIN. Sin embargo, la sincronización principal falla en producción con `500 FUNCTION_INVOCATION_FAILED`. Como consecuencia, las pantallas trabajan con datos incompletos o locales, el indicador queda repetidamente en `Sincronizando...` y no es posible certificar los flujos que dependen de Neon.

Se observaron además identidades duplicadas en Administración, métricas demostrativas presentadas como reales, acceso demasiado amplio a Configuración y problemas de accesibilidad.

### Resultado

| Área | Resultado |
|---|---|
| Carga del dominio principal | Aprobado |
| Login con PIN | Aprobado para 6/6 perfiles |
| Selección de cliente | Aprobado con observaciones |
| Autorización por perfil | Parcial |
| Sincronización Neon | **Fallido** |
| Datos operativos | No certificables por fallo de sincronización |
| Responsive móvil | Parcial |
| Accesibilidad básica | Fallido |
| Consola del navegador | Fallido por errores repetidos de sincronización |

## Usuarios probados

Se probaron las seis identidades parametrizadas existentes:

| Usuario | Perfil | Login | Cliente | Resultado de navegación |
|---|---|---:|---|---|
| `admin@cmms.local` | Administrador | OK | Vista global / EECOL ELECTRIC | Acceso administrativo correcto; sincronización fallida |
| `supervisor@cmms.local` | Supervisor | OK | EECOL ELECTRIC | Operación habilitada; Administración restringida |
| `tecnico@cmms.local` | Técnico | OK | EECOL ELECTRIC | Operación habilitada; Administración restringida |
| `contratista@cmms.local` | Contratista | OK | EECOL ELECTRIC | Operación habilitada; Administración restringida |
| `cliente@cmms.local` | Cliente | OK | EECOL ELECTRIC | Mantenimiento y Administración restringidos |
| `visita@cmms.local` | Visita | OK | EECOL ELECTRIC | Acceso de lectura amplio; Administración restringida |

No se crearon, editaron ni eliminaron registros durante este QA.

## Matriz observada de acceso

`OK` indica que la vista cargó. `Restringido` indica que la aplicación mostró “Acceso Restringido”.

| Perfil | Equipos | Tickets | Mantenimientos | Informes | Administración | Configuración |
|---|---:|---:|---:|---:|---:|---:|
| Administrador | OK | OK | OK | OK | OK | OK |
| Supervisor | OK | OK | OK | OK | Restringido | OK |
| Técnico | OK | OK | OK | OK | Restringido | OK |
| Contratista | OK | OK | OK | OK | Restringido | OK |
| Cliente | OK | OK | Restringido | OK | Restringido | OK |
| Visita | OK | OK | OK | OK | Restringido | OK |

Observaciones:

- El perfil Visita se describe como “Solo lectura reportes”, pero puede abrir Equipos, Tickets y Mantenimientos. Los controles de escritura no siempre aparecen, pero el alcance visual no coincide con la descripción del perfil.
- Configuración está disponible para todos los perfiles probados. La pantalla contiene operaciones técnicas y de sincronización que deberían ocultarse o separarse de la configuración personal.
- La autorización de Administración sí bloquea correctamente a los perfiles no administradores.

## Hallazgos

### QA-001 — La función de sincronización cae en producción

**Severidad:** Crítica  
**Estado:** Reproducible  
**Ruta:** `/api/sync?status=1`

La función responde con:

- HTTP `500 INTERNAL_SERVER_ERROR`
- Código Vercel: `FUNCTION_INVOCATION_FAILED`
- Request ID observado: `gru1::wzl89-1784937793444-34d7c336672a`

La consola registra repetidamente:

```text
[SyncEngine] Sync failed with unexpected error
Sync Error: Unknown Server Error (Status: 500)
```

Impacto:

- La información de Neon no llega de forma confiable al navegador.
- El indicador permanece en `Sincronizando...`.
- Equipos, tickets, mantenimientos e informes aparecen vacíos.
- No es posible certificar CRUD ni consistencia multiusuario.

Recomendación:

1. Revisar el log de la invocación usando el Request ID.
2. Confirmar que el bundle de `api/sync.ts` incluya correctamente sus handlers movidos.
3. Verificar `DATABASE_URL` y `JWT_SECRET` en Production.
4. Añadir una prueba desplegada de `/api/sync?status=1` después de cada release.

### QA-002 — Usuarios duplicados en Administración

**Severidad:** Alta  
**Estado:** Reproducible  
**Ruta:** `/administracion`

La pantalla muestra 12 filas para solo seis identidades. Cada cuenta aparece dos veces:

- Admin
- Supervisor
- Técnico
- Contratista
- Cliente
- Visita

Impacto:

- Riesgo de editar o desactivar el registro equivocado.
- Conteos administrativos incorrectos.
- Posibles duplicados entre caché local y respuesta del servidor.

Recomendación:

- Corregir la reconciliación por `uuid_sync`/correo.
- No concatenar usuarios de Dexie y API sin deduplicación.
- Verificar que el reset de IndexedDB se ejecute en la versión desplegada.

### QA-003 — Producción muestra métricas ficticias como datos reales

**Severidad:** Alta  
**Estado:** Reproducible

Con cero registros sincronizados se muestran, entre otros:

- MTBF `4800h`
- MTTR `3.5h`
- Pendientes de firma `01 / 01 / 01`
- Mantenimientos: `128`, `12`, `3` y `98%`
- Demanda estimada para Santiago y Antofagasta
- Gráfico mensual de costos

Impacto:

- El usuario puede interpretar cifras demostrativas como información operacional.
- Los reportes ejecutivos no son confiables.

Recomendación:

- Desplegar en `main` las correcciones ya realizadas en `develop`.
- Mostrar `Sin datos` o `—` hasta disponer de mediciones reales.

### QA-004 — Configuración accesible para todos los perfiles

**Severidad:** Alta  
**Estado:** Reproducible

Supervisor, Técnico, Contratista, Cliente y Visita pueden abrir `/configuracion`.

Aunque los endpoints administrativos deben validar permisos en servidor, la UI expone controles de sincronización, importación, clonación y mantenimiento técnico.

Recomendación:

- Separar preferencias personales de Administración del sistema.
- Restringir clonación, importación, reset e inicialización al Administrador.
- Ocultar controles no autorizados además de proteger el endpoint.

### QA-005 — Selector de cliente no es un control semántico

**Severidad:** Media  
**Estado:** Reproducible  
**Ruta:** `/client-selector`

La tarjeta “EECOL ELECTRIC” es clicable, pero no se expone como botón o enlace. En el árbol accesible solo aparece el botón Cerrar sesión.

Impacto:

- Navegación deficiente con teclado y lectores de pantalla.
- Automatización más frágil.

Recomendación:

- Usar `<button type="button">` o un enlace con nombre accesible.
- Añadir foco visible y soporte para teclado.

### QA-006 — Controles sin nombre accesible

**Severidad:** Media  
**Estado:** Reproducible

En el encabezado y navegación aparecen botones sin nombre accesible. Los filtros del Dashboard se exponen como combobox sin etiqueta.

Recomendación:

- Añadir `aria-label` a menú, tema, notificaciones, filtros y controles flotantes.

### QA-007 — CSS visible en el contenido accesible de Planificación

**Severidad:** Media  
**Estado:** Reproducible  
**Ruta:** `/planificacion`

Durante la prueba móvil, reglas como `.rbc-calendar`, `.rbc-btn-group button` y propiedades CSS aparecieron dentro del texto principal.

Impacto:

- Lectura incorrecta con tecnologías asistivas.
- Contenido técnico expuesto al usuario.

Recomendación:

- Mover las reglas a una hoja CSS o renderizarlas dentro de una etiqueta `<style>` válida que no participe del contenido accesible.

### QA-008 — Contexto de cliente cambia entre nombre e identificador

**Severidad:** Media  
**Estado:** Reproducible

Después de elegir “EECOL ELECTRIC”, el encabezado de algunas rutas muestra `C1` en vez del nombre comercial. Otras rutas vuelven a mostrar el nombre.

Recomendación:

- Resolver siempre el nombre desde el mismo objeto de cliente.
- Evitar que el fallo de sincronización reemplace el nombre por el identificador.

## Prueba responsive

Se ejecutó una revisión en viewport móvil:

- No se detectó scroll horizontal global.
- La navegación y el contenido principal cargan.
- Planificación expone CSS como texto accesible.
- Los controles flotantes y el indicador de sincronización requieren una segunda revisión cuando el endpoint de sincronización funcione.

## Criterio de salida

El release no debe aprobarse hasta cumplir, como mínimo:

1. `/api/sync?status=1` responde `200`.
2. La sincronización completa deja de generar errores repetidos.
3. Administración muestra una sola fila por usuario.
4. Producción deja de mostrar métricas demostrativas.
5. Se valida nuevamente la matriz de permisos con datos sincronizados.

## Evidencia técnica

- Dominio principal probado: `https://cmms-hvac-pro-ia-studio.vercel.app`
- Fecha de ejecución: 24/07/2026
- Perfiles autenticados: 6/6
- Request ID crítico: `gru1::wzl89-1784937793444-34d7c336672a`
- No se efectuaron mutaciones de datos.

## Mejoras implementadas después del QA

Estado local validado antes del despliegue:

- **QA-001:** la función consolidada de sincronización ahora carga cada handler bajo demanda, captura fallos de inicialización y responde un error JSON controlado en vez de derribar la invocación completa.
- **QA-002:** la lista local de usuarios se reemplaza con la respuesta autoritativa del servidor y además se deduplica por correo normalizado.
- **QA-003:** se integraron en `main` las correcciones que eliminan métricas demostrativas y cálculos ficticios.
- **QA-004:** Configuración se ocultó del menú y se protegió a nivel de página para perfiles que no sean administrador.
- **QA-005:** las tarjetas de selección de cliente ahora son botones semánticos navegables con teclado.
- **QA-007:** los estilos del calendario se movieron fuera del contenido renderizado a la hoja CSS global.
- **QA-008:** el nombre del cliente activo se conserva como contexto estable y se limpia al cambiar a vista global o cerrar sesión.
- Se corrigió también el orden de inicialización de `isProduction` en el servidor integrado desde `develop`.

Validaciones realizadas:

- TypeScript sin errores.
- 6 pruebas de regresión y seguridad aprobadas.
- Build de producción aprobado.
- Empaquetado aislado de las 5 funciones Vercel aprobado.

Los puntos relacionados con producción quedan **pendientes de revalidación en el dominio desplegado** después de publicar este commit.

## Revalidación del 25/07/2026

- El endpoint sin sesión ya responde `401` controlado y dejó de producir `FUNCTION_INVOCATION_FAILED`.
- El inicio de sesión de administrador y el selector global funcionan.
- El Dashboard ya muestra estados vacíos reales (`0`, `—` y mensajes sin datos), sin métricas demostrativas.
- Los filtros del Dashboard tienen nombres accesibles.
- La sincronización normal seguía generando `500` porque cada ciclo sin cambios ejecutaba un `POST` con escritura y pull masivo combinado.

Corrección aplicada:

- Los ciclos sin cambios pendientes utilizan ahora un pull incremental por `GET`.
- Las escrituras por `POST` responden al terminar el push; el pull incremental se ejecuta en el siguiente ciclo.
- Esto reduce duración, consultas y riesgo de timeout en funciones del plan Hobby.
- Las pruebas autenticadas restantes y las mutaciones controladas se reanudarán después de desplegar esta corrección.

### Resultado posterior al despliegue `0994913`

- Bundle de producción confirmado: `index-Bnoakuay.js`.
- Sincronización incremental: ciclo automático superior a 15 segundos sin errores del bundle vigente.
- Clientes cargados desde Neon: EECOL ELECTRIC y Cliente Internacional.
- Administración: 6 identidades y 6 filas, sin duplicados.
- Acceso válido: administrador, supervisor, técnico, contratista, cliente y visita.
- Configuración y Administración: restringidas correctamente en los cinco perfiles no administradores.
- Selector de cliente: tarjetas expuestas como botones semánticos.
- Contexto del cliente: EECOL ELECTRIC se muestra por nombre, sin degradar a `C1`.
- Planificación móvil: sin CSS expuesto ni scroll horizontal global.

Hallazgo adicional:

- El resumen “Estado hoy” de Planificación mostraba `01` fijo para todos los estados y había controles iconográficos sin nombre accesible.
- Se reemplazaron los valores fijos por conteos derivados de los eventos del día y se etiquetaron los controles de vista, filtro, detalle y opciones.
- Se ocultó “Nueva Actividad” para cliente y visita, manteniendo ambos perfiles en modo de solo lectura.

## QA CRUD — clientes y sucursales

Prueba del 25/07/2026:

- La creación local de `QA CLIENTE TEMPORAL 20260725` y su Casa Matriz funciona.
- El cliente aparece inmediatamente en selector y Gestión de Clientes.
- La sucursal quedó pendiente porque el servidor persistía `clientes.id` usando `uuid_sync`, mientras `sucursales.cliente_id` utiliza el identificador funcional del cliente.

Correcciones:

- La sincronización conserva `data.id` como clave funcional del cliente y `uuid_sync` como identificador offline.
- Se agregó eliminación de clientes desde su ficha, incluyendo baja sincronizada de sus sucursales, para poder revertir registros de QA de forma segura.

La persistencia completa y limpieza del registro temporal deben revalidarse después del siguiente despliegue.

Durante la limpieza se detectó que una baja podía convivir con un insert fallido del mismo UUID y que el pull descartaba `deleted_at` al expandir el JSON. Se corrigieron ambos comportamientos: la baja reemplaza operaciones pendientes previas y los tombstones del servidor se conservan localmente.

Al iniciar el QA de equipos se detectó además que el pull perdía columnas estructurales guardadas fuera de `data` (`id`, `cliente_id` y `created_at`). Esto impedía asociar correctamente sucursales y activos al cliente seleccionado. El merge local ahora conserva explícitamente esas columnas.

Los registros ya descargados tenían el mismo `updated_at`, por lo que la reparación no se aplicaba con una comparación estrictamente mayor. El pull ahora repara campos estructurales y tombstones también cuando la versión es la misma, sin sobrescribir cambios locales pendientes.

La revalidación mostró que `triggerSync(true)` ignoraba el cooldown, pero mantenía el timestamp incremental. Ahora una sincronización forzada usa realmente `since=0`, permitiendo reconstruir relaciones antiguas y recuperar tombstones ya existentes.

Los datos creados antes del modelo actual podían no tener `sync_status`, y las operaciones fallidas agotadas seguían inflando el contador después de eliminar su registro. La reparación admite estados no pendientes y purga operaciones agotadas huérfanas o asociadas a tombstones.

Resultado en `86d8f5d`: EECOL quedó con 10 sucursales, Cliente Internacional con 1 y el cliente QA desapareció. El único pendiente restante fue identificado como el insert agotado de la antigua sucursal QA; ahora se elimina automáticamente cuando su cliente padre ya no existe o tiene tombstone.

Resultado posterior al despliegue `9001d87`:

- La creación de un activo, su sincronización, edición y baja funcionaron correctamente en producción.
- El activo temporal cambió de `QA ACTIVO TEMPORAL 20260725` a `QA ACTIVO EDITADO 20260725` y quedó marcado como `baja`.
- Se detectó que “Registrar Mantenimiento” permanecía habilitado en un equipo dado de baja, pese a que la interfaz indicaba que esas operaciones estaban deshabilitadas.
- El botón ahora respeta tanto el permiso `crear_mantenimiento` como el estado del equipo.

## QA operativo — órdenes, tickets e informes

Prueba del 25/07/2026 posterior a `f2b985a`:

- Se confirmó en producción que tanto “Abrir Ticket de Falla” como “Registrar Mantenimiento” quedan deshabilitados en un activo dado de baja.
- El formulario general de mantenimientos rechaza TAG inexistentes, eliminados o dados de baja.
- Órdenes de servicio permitía intentar finalizar sin sucursal ni activo válido. Se agregó validación obligatoria de cliente, sucursal, TAG vigente y pertenencia al cliente activo antes de revisar las firmas y persistir.
- Tickets permitía escribir manualmente un TAG retirado o de otro cliente. Ahora cualquier TAG indicado se valida contra un activo vigente del cliente activo.
- Abrir “Crear Informe” genera un borrador local de inmediato. El borrador utilizado para QA fue eliminado y la baja quedó sincronizada; la cola volvió a cero.
- El selector inicial mostraba tombstones de clientes porque sólo filtraba `activo`, no `deleted_at`. Ahora excluye explícitamente clientes eliminados y deja de mostrar transitoriamente el cliente QA.

## Recuperación entre despliegues

Después del despliegue `b5c9d1c`, una pestaña que conservaba la versión anterior intentó cargar `ClientSelector-CAHqcOVb.js`, un chunk cuyo hash ya no pertenecía al despliegue activo. El límite de error ahora reconoce fallos de imports dinámicos, elimina cachés y registros de service worker y recarga automáticamente una sola vez. La recarga manual del estado crítico realiza la misma limpieza para evitar bucles con recursos obsoletos.

La revalidación mostró además que un chunk antiguo todavía podía existir en el precache y cargar código previo sin producir un 404. El service worker deja de precachear HTML y JavaScript versionado; conserva únicamente recursos visuales estables y cachés externos. El build genera ahora sólo 3 entradas de precache en lugar de almacenar los módulos dinámicos de la aplicación.

## QA de inventario

Después del despliegue `01e9a33` se confirmó desde una sesión nueva que el selector ya no muestra el cliente QA. En inventario funcionaron creación, ajuste de stock y edición, pero el recurso reapareció después de eliminarlo y forzar sincronización. El módulo acumulaba `insert`, múltiples `update` y `delete` para el mismo UUID, permitiendo que una escritura concurrente restaurara el registro. Las operaciones ahora se compactan a una única intención vigente, la baja cancela todas las anteriores y guarda `deleted_at`. También se añadieron nombres accesibles a los controles de aumento y disminución de stock.

Para completar la limpieza de activos de prueba, los administradores disponen ahora de “Eliminar Registro” sobre equipos previamente dados de baja. La acción utiliza el flujo sincronizado de eliminación y requiere confirmación explícita.

La revalidación de `28953ce` confirmó que el inventario quedó vacío, pero el activo QA histórico reaparecía después del pull. Su `cliente_id` pertenece al modelo anterior y el `UPDATE` con tenant moderno afectaba cero filas aunque la sincronización respondía “aplicado”. Los administradores ahora pueden sanear estos activos heredados por UUID; los demás perfiles conservan obligatoriamente el filtro de tenant.

## QA de planificación

La planificación mostraba recursos eliminados, resolvía EECOL como “Cliente General” mediante una lista fija y mantenía las actividades únicamente en memoria. Ahora utiliza clientes reales, excluye inventario con tombstone y persiste actividades en la tabla `events` con cola de sincronización. Las actividades guardadas se restauran al recargar y pueden eliminarse desde su detalle cuando el perfil tiene permisos de edición.

La primera limpieza posterior a `d5aa956` confirmó que algunos activos heredados tampoco comparten el `uuid_sync` actual. Las operaciones de baja incluyen ahora los identificadores completos del registro y, exclusivamente para administradores, el servidor puede localizar el activo heredado por UUID, ID funcional o TAG. Los perfiles restantes siguen limitados por UUID y tenant.

La consulta directa en Neon confirmó que `11-STK.AC.001` ya tiene `deleted_at` y estado `baja`; la persistencia era correcta y la reaparición provenía de la UI. La hidratación global y la lista de Equipos ahora excluyen tombstones sincronizados. Planificación aprobó creación, sincronización y restauración tras recarga de una actividad temporal. Se conectó explícitamente el control “Más opciones” con el detalle para garantizar que la eliminación sea accesible también después de recargar.
