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
