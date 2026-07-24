# QA Senior - Ejecucion de Tests | 2026-07-02

## Regresion funcional local | 2026-07-24

### Alcance

- Login con el administrador mock `admin@local.test`.
- Smoke test de los 16 modulos navegables desde el menu principal.
- Revision de errores de consola y del limite de errores de React.
- Build de produccion, TypeScript y suite de regresion de seguridad.
- Smoke test de API local y comprobacion responsive a 390 x 844.

### Resumen

| Metrica | Valor |
| --- | ---: |
| Modulos recorridos | 16 |
| Modulos que cargan sin bloqueo | 15 |
| Modulos con error critico de UI | 1 |
| Tests automatizados de seguridad | 5/5 PASS |
| Build y TypeScript | PASS |
| Checks API smoke | 2/2 PASS |
| Paginas comprobadas en movil | 2/2 sin overflow horizontal |

Veredicto: **NO APTO PARA PRODUCCION** mientras la vista de Usuarios pueda derribar el arbol de React al recibir clientes sin `nombre`. El resto de la navegacion principal queda disponible en el ambiente local.

### Resultados

| Caso | Resultado | Evidencia |
| --- | --- | --- |
| Login administrador mock | PASS | `admin@local.test` ingresa y permite seleccionar Vista global. |
| Dashboard | PASS con observaciones | Carga; muestra sucursales `Bodega Central` duplicadas y datos de clientes incompletos. |
| Scanner QR | PASS | Renderiza `Terminal Scanner`. |
| Equipos | PASS | Renderiza `Inventario de Activos HVAC`. |
| Mapa | PASS | Renderiza `AssetTrack`. |
| Clientes | PASS con observaciones | Renderiza, pero el selector inicial contiene tarjetas de cliente sin nombre. |
| Inventario | PASS | Renderiza `Control de Inventario Interno`. |
| Mantenimientos | PASS | Ruta disponible sin error de React. |
| Calendario | PASS | Renderiza `Planificacion HVAC`. |
| Ordenes de Servicio | PASS | Renderiza la vista principal. |
| Informes HVAC | PASS | Renderiza `Gestion de Informes`. |
| Tickets | PASS | Renderiza `Centro de Tickets`. |
| Reportes | PASS | Renderiza `Reportes y Analitica`. |
| Eficiencia Energetica | PASS | Renderiza la vista KPI. |
| Usuarios | **FAIL** | ErrorBoundary: `Cannot read properties of undefined (reading 'localeCompare')` en `UserModal.tsx:63`. |
| Acceso Biometrico | PASS | Renderiza `Acceso y Seguridad`. |
| Consola | PASS | Renderiza `Consola de Eventos`. |
| Configuracion | PASS | Renderiza `Configuracion de Sistema`. |
| `npm test` | PASS | TypeScript sin errores y 5/5 regresiones de seguridad aprobadas. |
| `npm run build` | PASS con warning | Bundle principal de 2,430.64 kB (704.53 kB gzip). |
| `GET /api/health` | PASS | HTTP 200 `{"status":"ok"}`. |
| `GET /api/assets` sin token | PASS | HTTP 401. |
| Responsive Dashboard 390 x 844 | PASS | `scrollWidth=390`, sin overflow horizontal. |
| Responsive Configuracion 390 x 844 | PASS | `scrollWidth=390`, sin overflow horizontal. |

### Riesgos y observaciones

- `UserModal` ordena clientes con `a.nombre.localeCompare(...)` sin normalizar ni filtrar registros cuyo nombre sea `undefined`.
- La consola registra claves React duplicadas para `dev-admin`; puede causar filas duplicadas u omitidas.
- Recharts registra repetidamente contenedores con ancho y alto `-1`.
- El build mantiene imports dinamicos inefectivos y un bundle inicial grande, con impacto probable en la primera carga.
- Esta pasada fue local con base mock. No incluye produccion autenticada, camara/QR real, WebAuthn real, funcionamiento offline prolongado ni firmas/exportaciones completas.

## Objetivo

Primera pasada de QA tecnico sobre CMMS HVAC PRO, cubriendo:

- Build y TypeScript local.
- API local con base mock (`ALLOW_MOCK_DB=true`).
- Smoke test no autenticado contra produccion Vercel.

Produccion autenticada queda pendiente: no se ejecuto login con credenciales inferidas para evitar bloqueo o uso no autorizado de cuentas.

## Ambiente

- Local: `http://localhost:3000`
- Produccion: `https://cmms-hvac-pro-ia-studio.vercel.app`
- Fecha: 2026-07-02
- Backend local: `server.ts`
- Produccion Vercel: funciones bajo `api/`

## Resumen

| Metrica | Valor |
| --- | ---: |
| Checks ejecutados | 19 |
| Pasaron | 10 |
| Fallaron | 6 |
| Bloqueados/Pendientes | 3 |
| Bugs criticos | 1 |
| Bugs altos | 3 |
| Bugs medios | 2 |

Veredicto original: NO APTO PARA PRODUCCION hasta corregir validaciones de escritura y autorizacion multi-tenant.

Actualizacion 2026-07-03: los bugs bloqueantes detectados en esta pasada fueron corregidos y verificados localmente. Queda pendiente repetir QA autenticado contra produccion con credenciales explicitas.

## Segunda Pasada QA | 2026-07-03

### Resumen

| Metrica | Valor |
| --- | ---: |
| Checks ejecutados | 12 |
| Pasaron | 10 |
| Fallaron | 1 |
| Bloqueados/Pendientes | 1 |

Veredicto segunda pasada: APTO localmente para continuar hacia deploy de correcciones, con pendiente bloqueante de verificacion en produccion autenticada. Produccion aun no refleja `/api/health`.

### Resultados Segunda Pasada

| Caso | Resultado | Evidencia |
| --- | --- | --- |
| `npm run lint` | PASS | TypeScript sin errores. |
| `npm run build` | PASS | Build completo generado en `dist/`. |
| Build warning: bundle principal | WARN | `index-CVMHvGzS.js` queda en 2.4 MB, 705 KB gzip; persisten warnings de imports dinamicos inefectivos. |
| Local `/api/health` | PASS | HTTP 200 `{"status":"ok"}`. |
| Local login admin mock | PASS | HTTP 200 con token usando `admin@local.test`. |
| Local `POST /api/v1/clients` body vacio | PASS | HTTP 400 `El campo nombre es obligatorio`. |
| Local `POST /api/v1/clients` datos invalidos | PASS | HTTP 400. |
| Local `POST /api/v1/clients` plan invalido con RUT valido | PASS | HTTP 400 `El plan informado no es valido`. |
| Local `POST /api/assets` body vacio | PASS | HTTP 400 `El campo tag es obligatorio`. |
| Local `POST /api/assets` valido minimo + lectura por tag | PASS | Creacion HTTP 200 y `GET /api/assets?tag=...` devuelve 1 registro. |
| Local tecnico consulta tenant no asignado | PASS | HTTP 403 en `/api/v1/cliente-default-001/branches`. |
| Produccion `/` | PASS | HTTP 200. |
| Produccion `/api/assets` sin token | PASS | HTTP 401. |
| Produccion `/api/health` | FAIL | HTTP 404 `NOT_FOUND`; el archivo local `api/health.ts` existe, pero produccion no lo refleja. |
| Produccion autenticada | PENDIENTE | No se ejecuto sin credenciales explicitas de QA. |

### Observaciones Segunda Pasada

- `vercel.json` no declara rewrite explicito para `/api/health`, mientras si declara rewrites para otros endpoints API. Esto puede explicar que produccion siga respondiendo 404 aunque exista `api/health.ts`.
- La ruta local Express y la funcion Vercel de assets no tienen contrato identico para `GET /api/assets?tag=...`: local devuelve `data` como arreglo; `api/assets.ts` trata `query.tag` como identificador y devuelve un objeto. No se encontro consumidor directo en frontend durante esta pasada, pero conviene normalizarlo para evitar diferencias entre ambientes.
- El arranque local con mock DB registra mensajes `sql.unsafe is not a function` al intentar limpiar tablas obsoletas, pero la inicializacion continua y los casos de regresion pasan.

## Resultados Ejecutados

| Caso | Resultado | Evidencia |
| --- | --- | --- |
| `npm run lint` | PASS | TypeScript sin errores. |
| `npm run build` | PASS | Build completo generado en `dist/`. |
| Build warning: bundle principal | WARN | `index-CVMHvGzS.js` queda en 2.4 MB, 705 KB gzip. |
| Produccion `/` | PASS | HTTP 200, sirve HTML app. |
| Produccion `/api/auth` sin body valido | PASS | HTTP 400 `Correo y PIN requeridos`. |
| Produccion `/api/assets` sin token | PASS | HTTP 401. |
| Produccion `/api/clients` sin token | PASS | HTTP 401. |
| Produccion `/api/health` | FAIL | HTTP 404 `NOT_FOUND`; local existe con 200. |
| Local `/api/health` | PASS | HTTP 200 `{"status":"ok"}`. |
| Local `/api/assets` sin token | PASS | HTTP 401. |
| Local `/api/auth` sin body valido | PASS | HTTP 400. |
| Local login admin mock | PASS | HTTP 200 con token. |
| Local `/api/v1/clients` con admin | PASS | HTTP 200. |
| Local `POST /api/v1/clients` body vacio | FAIL | HTTP 201 crea cliente sin datos. |
| Local `POST /api/v1/clients` datos invalidos | FAIL | HTTP 201 acepta `nombre=''`, `rut='bad'`, `plan='invalid-plan'`. |
| Local `POST /api/assets` body vacio | FAIL | HTTP 200 acepta activo sin `tag` ni `nombre`. |
| Local `POST /api/assets` valido minimo + lectura por tag | FAIL | Crea HTTP 200, pero `GET /api/assets?tag=...` devuelve `data: []`. |
| Local tecnico accede a `/api/v1/clients` | PASS | HTTP 403 como corresponde. |
| Local tecnico consulta tenant no asignado | FAIL | HTTP 200 en `/api/v1/cliente-default-001/branches`; esperado 403. |

## Observaciones Tecnicas

- Existe diferencia de superficie entre `server.ts` local y `api/` en Vercel. Ejemplo: `/api/health` existe localmente pero no en produccion.
- La validacion de `POST /api/v1/clients` en `server.ts` acepta payloads vacios porque genera `id` automaticamente y usa `data || '{}'`.
- La validacion de `POST /api/assets` no exige `tag` ni `nombre` en flujo de creacion.
- `requireCliente` permite acceso a tenants no solicitados en al menos un caso de tecnico; esto afecta aislamiento multi-tenant.
- La base mock local tiene fixtures inconsistentes despues de ejecuciones previas; aun asi, los fallos de validacion/autorizacion no dependen solo del fixture.

## Pendientes Para QA Completo

- Credenciales explicitas de QA para produccion.
- Suite E2E UI con Playwright: login, selector cliente, CRUD activos, ordenes, inventario, modo offline/sync.
- Pruebas autenticadas contra endpoints Vercel `api/` para comparar con `server.ts`.
- Pruebas de regresion anti brute-force con usuario de QA controlado.
