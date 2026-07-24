# QA Bugs | 2026-07-02

## ALTO - La vista Usuarios derriba el arbol de React

- ID: `QA-HIGH-004`
- Estado: Abierto 2026-07-24
- Ambiente: Local mock
- Ruta: `/administracion`
- Evidencia: ErrorBoundary muestra `Cannot read properties of undefined (reading 'localeCompare')`.
- Traza: `src/components/modals/UserModal.tsx:63`, ordenamiento de `clients` por `a.nombre`.
- Reproduccion: iniciar sesion como administrador, seleccionar Vista global y abrir Usuarios.
- Esperado: la vista debe renderizar y los registros incompletos deben filtrarse o mostrarse con un nombre seguro.
- Actual: el componente `UserModal` recibe al menos un cliente sin `nombre` y derriba toda la vista.
- Impacto: un administrador no puede gestionar usuarios.

## MEDIO - Registros de clientes incompletos y sucursales duplicadas en UI

- ID: `QA-MED-003`
- Estado: Abierto 2026-07-24
- Ambiente: Local mock
- Rutas: selector de cliente y `/`
- Evidencia: el selector muestra varias tarjetas sin encabezado; Dashboard repite `Bodega Central` en el filtro y grafico.
- Esperado: cada cliente y sucursal debe tener identidad visible unica, o los datos invalidos deben ser rechazados/ignorados.
- Impacto: seleccion ambigua, datos operativos duplicados y detonacion indirecta de `QA-HIGH-004`.

## MEDIO - Clave React duplicada para usuario administrador

- ID: `QA-MED-004`
- Estado: Abierto 2026-07-24
- Ambiente: Local mock
- Ruta: `/administracion`
- Evidencia de consola: `Encountered two children with the same key, dev-admin`.
- Esperado: cada fila renderizada debe tener una clave unica y cada usuario debe aparecer una sola vez.
- Impacto: React puede duplicar u omitir usuarios durante actualizaciones.

## BAJO - Graficos se inicializan con dimensiones negativas

- ID: `QA-LOW-001`
- Estado: Abierto 2026-07-24
- Ambiente: Local mock
- Ruta: Dashboard
- Evidencia de consola: Recharts informa repetidamente `width(-1) and height(-1)`.
- Esperado: los contenedores de graficos deben tener dimensiones validas al renderizar.
- Impacto: parpadeos, graficos vacios o comportamiento inconsistente segun viewport.

## BAJO - Bundle principal excede 2.4 MB

- ID: `QA-LOW-002`
- Estado: Abierto 2026-07-24
- Ambiente: Build de produccion
- Evidencia: `dist/assets/index-Be9VEbOC.js` = 2,430.64 kB, 704.53 kB gzip.
- Esperado: dividir funciones pesadas en chunks cargados bajo demanda.
- Impacto: primera carga mas lenta, especialmente en dispositivos moviles o redes de terreno.

## CRITICO - Aislamiento multi-tenant incompleto

- ID: `QA-CRIT-001`
- Estado: Corregido 2026-07-03
- Ambiente: Local mock
- Endpoint: `GET /api/v1/:cliente_id/branches`
- Evidencia: usuario `tecnico` asignado a `cliente-eecol-default-001` recibio HTTP 200 consultando `/api/v1/cliente-default-001/branches`.
- Esperado: HTTP 403 si el usuario no esta asignado al tenant solicitado.
- Impacto: posible lectura/escritura cross-tenant si se replica en endpoints con datos reales.
- Referencia tecnica: `server.ts`, middleware `requireCliente`.
- Verificacion: tecnico asignado a `cliente-eecol-default-001` recibe HTTP 403 al consultar `/api/v1/cliente-default-001/branches`.

## ALTO - API clientes acepta payload vacio

- ID: `QA-HIGH-001`
- Estado: Corregido 2026-07-03
- Ambiente: Local mock
- Endpoint: `POST /api/v1/clients`
- Evidencia: body `{}` responde HTTP 201 y crea `client-<timestamp>`.
- Esperado: HTTP 400 con campos obligatorios, por ejemplo nombre/RUT/estado segun regla de negocio.
- Impacto: datos maestros corruptos y clientes inutilizables.
- Referencia tecnica: `server.ts`, `POST /api/v1/clients`.
- Verificacion: body `{}` responde HTTP 400.

## ALTO - API clientes acepta datos invalidos

- ID: `QA-HIGH-002`
- Estado: Corregido 2026-07-03
- Ambiente: Local mock
- Endpoint: `POST /api/v1/clients`
- Evidencia: body con `nombre=''`, `rut='bad'`, `plan='invalid-plan'` responde HTTP 201.
- Esperado: HTTP 400 con detalle de validacion.
- Impacto: rompe integridad de parametrizacion comercial/tenant.
- Referencia tecnica: `server.ts`, `POST /api/v1/clients`.
- Verificacion: `plan='invalid-plan'` responde HTTP 400.

## ALTO - API activos acepta creacion sin campos requeridos

- ID: `QA-HIGH-003`
- Estado: Corregido 2026-07-03
- Ambiente: Local mock
- Endpoint: `POST /api/assets`
- Evidencia: body `{}` responde HTTP 200.
- Esperado: HTTP 400 exigiendo al menos `tag` y `nombre`.
- Impacto: activos huerfanos o incompletos en inventario tecnico.
- Referencia tecnica: `server.ts`, `POST /api/assets`.
- Verificacion: body `{}` responde HTTP 400.

## MEDIO - Activo creado no se recupera por tag en mock local

- ID: `QA-MED-001`
- Estado: Corregido 2026-07-03
- Ambiente: Local mock
- Endpoint: `POST /api/assets` + `GET /api/assets?tag=QA-ACT-LOCAL-001`
- Evidencia: creacion responde HTTP 200, lectura posterior devuelve `{"success":true,"data":[]}`.
- Esperado: lectura debe devolver el registro creado o 404 si no existe.
- Impacto: flujo CRUD no verificable y riesgo de inconsistencia entre escritura/lectura.
- Nota: requiere confirmar contra PostgreSQL real.
- Verificacion local: `POST /api/assets` seguido de `GET /api/assets?tag=...` devuelve el registro creado.

## MEDIO - Health endpoint inconsistente entre local y produccion

- ID: `QA-MED-002`
- Estado: Parcialmente corregido 2026-07-03; local PASS, produccion sigue FAIL.
- Ambiente: Produccion Vercel
- Endpoint: `GET /api/health`
- Evidencia: local responde HTTP 200; produccion responde HTTP 404 `NOT_FOUND`.
- Esperado: endpoint de health disponible en ambos ambientes o documentacion explicita de diferencia.
- Impacto: monitoreo/deploy checks no confiables.
- Correccion: agregado `api/health.ts` para Vercel.
- Verificacion segunda pasada: local `GET /api/health` responde HTTP 200; produccion `https://cmms-hvac-pro-ia-studio.vercel.app/api/health` responde HTTP 404 al 2026-07-03.
