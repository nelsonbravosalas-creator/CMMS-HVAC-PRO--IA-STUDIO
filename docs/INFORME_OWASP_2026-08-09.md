# Informe de seguridad OWASP — CMMS HVAC Pro IA Studio

**Fecha de evaluación:** 9 de agosto de 2026  
**Versión evaluada:** rama `main`, aplicación web/PWA y seis funciones serverless desplegadas en Vercel  
**Clasificación:** Uso interno — contiene información de seguridad  
**Estado inicial (9 de agosto):** **Riesgo alto.**  
**Estado después de remediación (10 de agosto):** **Apto para despliegue de validación**, con activaciones externas detalladas en la sección 11.

## 1. Resumen ejecutivo

La solución incorpora controles valiosos: contraseñas/PIN almacenados con Argon2id, sesión en cookie `HttpOnly`, aislamiento por cliente en las consultas principales, autorización de escritura en servidor, consultas parametrizadas y pruebas automatizadas de regresión. En el cierre, las pruebas del repositorio finalizaron correctamente: tipado, **23/23 pruebas de seguridad** y **8/8 pruebas de reglas entre órdenes e informes**.

Sin embargo, se confirmó un riesgo crítico: el seed y el plan de QA documentan seis cuentas demo con el mismo PIN conocido `1234`, incluida una cuenta administradora. Si estas cuentas permanecen activas en producción, un tercero que conozca el repositorio o el documento podría obtener acceso administrativo.

También se comprobó que la producción en Vercel no entrega varios encabezados de seguridad presentes en el servidor Express local. Las funciones serverless no heredan automáticamente ese middleware. Además, la autenticación de Vercel carece de un límite global por IP, la sincronización y el envío de PDF no tienen límites de volumen o frecuencia a nivel de aplicación, y el análisis de dependencias detectó dos avisos altos y uno moderado.

### Resultado cuantitativo inicial

| Severidad | Cantidad | Estado |
|---|---:|---|
| Crítica | 1 | Abierta |
| Alta | 4 | Abiertas |
| Media | 6 | Abiertas |
| Baja | 2 | Abiertas |

Esta evaluación es una revisión técnica basada en código, configuración, dependencias, pruebas automatizadas y comprobaciones HTTP públicas. No sustituye una prueba de penetración autenticada ejecutada por un tercero independiente.

## 2. Alcance y metodología

### Componentes revisados

- Frontend React 19/Vite y almacenamiento offline Dexie/IndexedDB.
- PWA y service worker generado con `vite-plugin-pwa`.
- API Express para ejecución local.
- Seis funciones serverless Vercel: autenticación, administración, comunicaciones, núcleo, operaciones y sincronización.
- Acceso a Neon PostgreSQL.
- Integraciones Resend, Google Maps, Firebase y Gemini.
- Seed, documentación operativa, configuración de despliegue y dependencias NPM.

### Referencias utilizadas

- [OWASP Top 10:2025](https://owasp.org/Top10/2025/).
- [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x03-introduction/).
- [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/).

### Actividades ejecutadas

1. Revisión estática de autenticación, autorización, aislamiento multiempresa, sincronización, exportación y configuración.
2. Ejecución de `npm test`.
3. Ejecución de `npm audit --omit=dev` y trazado de dependencias afectadas.
4. Inspección pública de encabezados de `/login`, `/api/health` y respuesta inválida de `/api/auth` en producción.
5. Búsqueda de secretos, credenciales iniciales, puntos de inyección, llamadas externas y uso de HTML dinámico.

No se realizaron ataques destructivos, fuerza bruta, pruebas de denegación de servicio ni modificación de datos de producción.

## 3. Hallazgos priorizados

### OWASP-01 — Credenciales demo predecibles en datos iniciales

**Severidad:** Crítica  
**Mapeo:** OWASP A07 Authentication Failures; A06 Insecure Design; API2 Broken Authentication  
**Estado:** Confirmado

**Evidencia**

- `scripts/db/parametric-data.ts:166-283` define seis perfiles demo con un único hash correspondiente al PIN conocido `1234`.
- `docs/PLAN_QA_INSITU.md:86-100` publica los correos y el PIN de administrador, supervisor, técnico, contratista, cliente y visita.
- El proceso de bootstrap puede insertar o actualizar estos registros en la base de datos desplegada.

**Impacto**

Si las cuentas están activas en producción, una persona con acceso al repositorio, al documento de QA o al historial del proyecto puede autenticarse. La cuenta `admin@cmms.local` amplía el impacto a todos los clientes y funciones administrativas.

**Remediación obligatoria**

1. Deshabilitar o eliminar las seis cuentas demo en producción, después de confirmar que no poseen trazabilidad que deba preservarse.
2. Separar el seed paramétrico del seed demo: producción no debe crear usuarios con claves conocidas.
3. Crear cuentas nominales con identidad real y un secreto inicial aleatorio de un solo uso.
4. Forzar cambio de credencial en el primer acceso y registrar el evento.
5. Retirar las claves del documento versionado; mantener credenciales de QA en un gestor de secretos.
6. Añadir una prueba de despliegue que falle si un usuario `@cmms.local` está activo en producción.

**Criterio de cierre:** consulta de producción sin cuentas demo activas, bootstrap productivo sin creación de usuarios demo y prueba automatizada preventiva.

---

### OWASP-02 — Encabezados de seguridad ausentes en el despliegue Vercel

**Severidad:** Alta  
**Mapeo:** OWASP A02 Security Misconfiguration; API8 Security Misconfiguration  
**Estado:** Confirmado en producción

**Evidencia**

- `server.ts:165-175` configura encabezados para Express local.
- `vercel.json:1-43` define rewrites, pero no una sección `headers`.
- La respuesta pública de Vercel incluyó HSTS, pero no se observaron `Content-Security-Policy`, `X-Content-Type-Options`, protección contra framing, `Referrer-Policy` ni `Permissions-Policy`.

**Impacto**

Se debilitan las defensas del navegador contra inyección de contenido, clickjacking, interpretación incorrecta de MIME, filtración del referente y acceso innecesario a capacidades del dispositivo.

**Remediación**

- Declarar los encabezados en `vercel.json`, tanto para la aplicación como para `/api/*`.
- Crear una CSP adaptada a Firebase, Google Maps y fuentes realmente utilizadas; evitar comodines.
- Usar al menos `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y una `Permissions-Policy` mínima.
- Validar primero con `Content-Security-Policy-Report-Only` y luego hacerla obligatoria.

**Criterio de cierre:** escaneo de la URL estable confirma todos los encabezados sin romper login, mapa, PWA, PDF ni escáner QR.

---

### OWASP-03 — Dependencias con vulnerabilidades conocidas

**Severidad:** Alta  
**Mapeo:** OWASP A03 Software Supply Chain Failures  
**Estado:** Confirmado

**Evidencia de `npm audit --omit=dev`**

| Paquete | Severidad | Riesgo informado | Ruta observada |
|---|---|---|---|
| `brace-expansion` | Alta | consumo no acotado de recursos/DoS | herramientas de lint/build |
| `nanoid` | Alta | bucle infinito con tamaño cero | cadena de PostCSS/autoprefixer |
| `dompurify` | Moderada | evasión XSS en subárbol separado | dependencia de `jspdf@4.2.1` |

Los tres avisos disponen de corrección según el auditor. Aunque dos rutas son principalmente de desarrollo, siguen afectando la cadena de suministro y el proceso de compilación. `dompurify` se encuentra en una ruta funcional vinculada a generación de PDF.

**Remediación**

1. Actualizar dependencias directas y lockfile hasta eliminar o justificar cada aviso.
2. Repetir generación y descarga de todos los PDF después de actualizar jsPDF/DOMPurify.
3. Añadir `npm audit`, revisión de dependencias y detección de secretos al CI.
4. Generar SBOM por versión y automatizar avisos con Dependabot o Renovate.

**Criterio de cierre:** auditoría sin vulnerabilidades altas/críticas y aceptación documentada de cualquier aviso residual.

---

### OWASP-04 — Protección insuficiente contra abuso de autenticación

**Severidad:** Alta  
**Mapeo:** OWASP A07 Authentication Failures; API2 Broken Authentication  
**Estado:** Confirmado por código

**Evidencia**

- `api/auth.ts:31-50` bloquea después de cinco fallos por correo durante 30 minutos.
- El límite por IP de `server.ts:679` sólo protege Express local y no la función `api/auth.ts` desplegada en Vercel.
- `api/auth.ts:55-75` devuelve respuestas distintas para usuario inexistente, inactivo y PIN inválido.
- El PIN de cuatro dígitos ofrece sólo 10.000 combinaciones si no se acompaña de controles fuertes.

**Impacto**

Un atacante distribuido puede probar varias cuentas; también puede provocar bloqueos deliberados de usuarios conocidos. Las respuestas permiten inferir si una cuenta existe y está activa.

**Remediación**

- Implementar rate limiting compartido y durable por IP, cuenta y huella de cliente, no memoria local de una función.
- Devolver un mensaje externo uniforme y registrar internamente la causa real.
- Responder con `Retry-After` al limitar.
- Elevar el secreto a una contraseña o PIN más largo y habilitar MFA para administradores.
- Alertar ante credential stuffing, barridos de cuentas y bloqueos anómalos.

---

### OWASP-05 — Operaciones costosas sin límites de tamaño, frecuencia ni idempotencia

**Severidad:** Alta  
**Mapeo:** API4 Unrestricted Resource Consumption; API6 Unrestricted Access to Sensitive Business Flows; OWASP A10 Mishandling of Exceptional Conditions  
**Estado:** Confirmado por código

**Evidencia**

- `api/communications.ts:28-87` acepta un PDF Base64 y llama a Resend sin límite explícito de tamaño, cuota por usuario/cliente, idempotency key ni timeout de aplicación.
- `server/vercel/handlers/sync.ts:338-359` puede devolver hasta 1.000 filas por cada tabla de sincronización.
- Los lotes push se procesan desde arreglos de operaciones sin un máximo global documentado.

**Impacto**

Un usuario autenticado o un cliente defectuoso puede elevar costos de correo, CPU, memoria, tiempo de función y tráfico de Neon. Los reintentos pueden duplicar correos o escrituras.

**Remediación**

- Limitar cuerpo HTTP y PDF decodificado; verificar tipo, firma `%PDF` y cantidad de páginas razonable.
- Aplicar cuotas por usuario/cliente para correo y sincronización.
- Incorporar claves de idempotencia para exportaciones y mutaciones.
- Paginar la sincronización con cursor, máximo de operaciones por lote y backpressure.
- Usar `AbortController`/timeout en Resend y demás proveedores; clasificar errores reintentables.

---

### OWASP-06 — Sesiones JWT no revocables antes de su expiración

**Severidad:** Media  
**Mapeo:** OWASP A07 Authentication Failures; A04 Cryptographic Failures  
**Estado:** Confirmado por diseño

**Evidencia**

- `server/vercel/auth.ts:79-85` firma JWT con vigencia de 12 horas y lo guarda en cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción.
- `api/auth.ts:145-151` cierra sesión eliminando la cookie, sin invalidar el token en servidor.

**Impacto**

Una copia previa del JWT continúa válida hasta doce horas, incluso después de logout, baja de usuario o cambio urgente de permisos.

**Remediación**

- Añadir `jti` y registro de sesiones, o un `token_version` por usuario comprobado en servidor.
- Revocar sesiones al cambiar PIN, rol, cliente, estado o al ejecutar logout global.
- Reducir la sesión privilegiada y exigir reautenticación para acciones administrativas.

**Control positivo:** no se detectó almacenamiento del JWT en `localStorage`; la cookie reduce la exposición directa a XSS.

---

### OWASP-07 — Datos offline sensibles sin cifrado de aplicación

**Severidad:** Media  
**Mapeo:** OWASP A04 Cryptographic Failures  
**Estado:** Riesgo de diseño confirmado

La PWA replica en IndexedDB datos operativos, clientes, usuarios sanitizados y elementos como firmas. El navegador protege el origen, pero IndexedDB no constituye cifrado frente a compromiso del dispositivo, perfil del navegador, respaldo local o sesión del sistema operativo.

**Remediación**

- Clasificar qué campos necesitan estar disponibles offline y minimizar la réplica.
- Borrar datos locales al cerrar sesión, cambiar de usuario/cliente o dar de baja el dispositivo.
- Definir política de bloqueo del teléfono, cifrado del dispositivo y reporte de pérdida.
- Evaluar cifrado por campo para firmas y datos personales, con claves no persistidas junto a los datos.
- Documentar el riesgo residual si la continuidad offline prevalece sobre el cifrado de aplicación.

---

### OWASP-08 — Auditoría y alertas de seguridad incompletas

**Severidad:** Media  
**Mapeo:** OWASP A09 Security Logging and Alerting Failures; API9 Improper Inventory Management  
**Estado:** Parcial

Existe una tabla `audit_logs` y se registran algunos eventos en consola, pero no se evidenció una cobertura central y obligatoria para: cambios de rol, altas/bajas, acceso administrativo, bootstrap, envíos de correo, eliminación/restauración, cambio de cliente, revocación de sesión y denegaciones de autorización. Tampoco hay evidencia en el repositorio de alertas operativas probadas de extremo a extremo.

**Remediación**

- Generar auditoría desde el servidor, no confiar en eventos enviados por el cliente.
- Registrar actor, cliente, acción, recurso, resultado, timestamp, correlación y origen; nunca PIN, JWT o API keys.
- Hacer los registros resistentes a modificación y definir retención.
- Alertar por 5xx, fuerza bruta, denegaciones anómalas, fallos repetidos de sync y rebotes/rechazos de Resend.
- Mantener inventario de endpoints y permisos por versión, idealmente OpenAPI.

---

### OWASP-09 — Configuración de build puede exponer secretos del servidor al cliente

**Severidad:** Media  
**Mapeo:** OWASP A02 Security Misconfiguration; A04 Cryptographic Failures  
**Estado:** Riesgo latente

`vite.config.ts:84-86` define `process.env.GEMINI_API_KEY` y `process.env.GOOGLE_MAPS_PLATFORM_KEY` dentro del contexto compilable del frontend. No se encontró una clave Gemini materializada en el bundle revisado, pero cualquier referencia futura desde el cliente podría incrustarla en JavaScript público.

**Remediación**

- Eliminar la definición de `GEMINI_API_KEY` del build web y usar exclusivamente una función serverless.
- Tratar la clave de Google Maps como identificador público restringido: limitarla por dominio HTTP, API permitida y cuota.
- La clave de configuración Firebase visible en cliente normalmente identifica el proyecto y no es un secreto por sí sola; asegurar reglas, dominios autorizados y App Check donde corresponda.
- Ejecutar escaneo de secretos sobre código, historial y artefactos `dist`.

---

### OWASP-10 — Fallback de permisos de interfaz contrario al mínimo privilegio

**Severidad:** Media  
**Mapeo:** OWASP A01 Broken Access Control; API5 Broken Function Level Authorization  
**Estado:** Confirmado, defensa en profundidad

`src/context/AuthContext.tsx:150-151` asigna permisos de administrador cuando el perfil local no coincide con un perfil conocido. Las API revisadas vuelven a autorizar en servidor, por lo que no se confirmó una escalada efectiva; aun así, un estado antiguo o manipulado puede mostrar funciones administrativas y aumenta el riesgo de futuras rutas que confíen en la UI.

**Remediación:** cambiar el fallback a `visita` o a cero permisos, registrar perfiles desconocidos y añadir una prueba de regresión.

---

### OWASP-11 — Actualizaciones de seguridad PWA pueden quedar diferidas

**Severidad:** Media  
**Mapeo:** OWASP A08 Software or Data Integrity Failures; A10 Mishandling of Exceptional Conditions  
**Estado:** Observado durante QA previo

El service worker conserva coherencia de recursos, pero una instalación existente puede continuar con una versión anterior hasta activar la actualización. Esto es funcionalmente útil, aunque puede retrasar parches urgentes.

**Remediación**

- Mostrar una notificación persistente de nueva versión y permitir “Actualizar ahora”.
- Forzar actualización controlada para versiones marcadas como críticas.
- Registrar versión de aplicación/service worker en telemetría y soporte.
- Probar instalación, actualización, modo avión y recuperación en Chrome Android y Safari iPhone.

---

### OWASP-12 — Valores inseguros disponibles para ejecución fuera de desarrollo

**Severidad:** Baja  
**Mapeo:** OWASP A02 Security Misconfiguration  
**Estado:** Confirmado

`docker-compose.yml:23-24` permite un secreto JWT local predecible mediante valor por defecto. Esto es aceptable sólo en desarrollo aislado; reutilizar la composición en un entorno compartido expondría sesiones falsificables.

**Remediación:** eliminar defaults de secretos, usar un archivo `.env.example` sin valores reales y hacer que el arranque falle fuera de `development`.

---

### OWASP-13 — Política de credenciales y mensajes de autenticación inconsistente

**Severidad:** Baja  
**Mapeo:** OWASP A07 Authentication Failures  
**Estado:** Confirmado

`api/auth.ts:162-165` acepta cualquier PIN nuevo de cuatro o más caracteres, mientras la interfaz y documentación describen cuatro dígitos. Asimismo, las respuestas de autenticación revelan estados diferentes de la cuenta.

**Remediación:** definir una política única y validarla igual en frontend, API, seed y documentación. Para un producto comercial se recomienda una contraseña más robusta y MFA administrativo, no depender exclusivamente de cuatro dígitos.

## 4. Matriz OWASP Top 10:2025

| Categoría | Evaluación | Observación principal |
|---|---|---|
| A01 Broken Access Control | Parcial | Buen aislamiento por cliente y roles en servidor; fallback administrativo en UI y falta ampliar pruebas BOLA por cada objeto. |
| A02 Security Misconfiguration | Deficiente | Encabezados ausentes en Vercel y defaults de desarrollo reutilizables. |
| A03 Software Supply Chain Failures | Deficiente | Dos avisos altos, uno moderado y sin gate de seguridad demostrado en CI. |
| A04 Cryptographic Failures | Parcial | Argon2id, HTTPS y cookie segura; JWT no revocable y datos offline sin cifrado de aplicación. |
| A05 Injection | Parcial/positivo | Consultas Neon parametrizadas y escape de datos en correo; falta DAST/fuzzing y CSP. |
| A06 Insecure Design | Deficiente | Usuarios demo de producción y flujos costosos sin controles antiabuso suficientes. |
| A07 Authentication Failures | Crítico | PIN demo conocido; bloqueo por cuenta existente, pero sin límite durable por IP en Vercel. |
| A08 Software or Data Integrity Failures | Parcial | Build/PWA controlados, pero actualización de parches puede quedar diferida. |
| A09 Security Logging and Alerting Failures | Deficiente | Auditoría y alertas no cubren sistemáticamente eventos sensibles. |
| A10 Mishandling of Exceptional Conditions | Parcial | Errores externos se encapsulan, pero faltan timeouts, límites e idempotencia. |

## 5. Matriz OWASP API Security Top 10:2023

| Riesgo API | Evaluación |
|---|---|
| API1 BOLA | Mitigación parcial: consultas principales se acotan por `cliente_id`; falta prueba sistemática por ID de todos los recursos. |
| API2 Broken Authentication | Alto/crítico por cuentas demo, PIN corto y rate limiting incompleto. |
| API3 Broken Object Property Level Authorization | Parcial: usuarios sincronizados se sanitizan; falta esquema allowlist por campo para todas las mutaciones. |
| API4 Unrestricted Resource Consumption | Alto por PDF, correo y lotes de sincronización sin límites de aplicación suficientes. |
| API5 Broken Function Level Authorization | Mitigación parcial con roles del servidor; debe corregirse el fallback de UI y probar cada endpoint. |
| API6 Sensitive Business Flows | Alto en envío de correo y bootstrap si se automatizan o abusan sin cuota/aprobación. |
| API7 SSRF | No se confirmó un vector: los destinos externos revisados son fijos. Mantener allowlist y no aceptar URLs arbitrarias. |
| API8 Security Misconfiguration | Confirmado por encabezados ausentes y configuración de build riesgosa. |
| API9 Improper Inventory Management | No hay contrato OpenAPI ni matriz versionada completa de endpoints/roles. |
| API10 Unsafe Consumption of APIs | Faltan timeout, validación estricta de respuestas y estrategia de reintentos para proveedores externos. |

## 6. Controles positivos comprobados

- Argon2id para PIN y migración de hashes bcrypt heredados (`server/passwords.ts:1-36`).
- JWT firmado con secreto obligatorio en producción y expiración de 12 horas.
- Cookie de sesión `HttpOnly`, `SameSite=Strict` y `Secure` en producción.
- Consultas SQL mediante tagged templates de Neon, evitando concatenación directa en los flujos revisados.
- Aislamiento por cliente y autorización server-side en handlers de recursos y sincronización.
- Eliminación de `pin` y `pin_hash` de las respuestas de sincronización de usuarios.
- Endpoints administrativos de inicialización/importación restringidos a administrador.
- Funcionalidad biométrica incompleta responde 501 en lugar de simular autenticación.
- La URL de base de datos productiva no se acepta desde el cuerpo de las solicitudes.
- HSTS activo en el dominio de producción.
- Pruebas automatizadas actuales aprobadas.

## 7. Plan de remediación

### Inmediato — antes de nuevos usuarios reales (0–7 días)

1. Deshabilitar las cuentas demo y retirar sus credenciales de la documentación versionada.
2. Separar seed productivo de datos QA y bloquear cuentas `@cmms.local` en producción.
3. Aplicar encabezados de seguridad en `vercel.json`.
4. Añadir limitación durable a login, correo y sincronización.
5. Actualizar las tres dependencias señaladas y repetir QA de PDF/PWA.
6. Corregir el fallback de permisos a mínimo privilegio.

### Corto plazo (8–30 días)

1. Implementar revocación de sesiones y MFA administrativo.
2. Añadir límites de payload, paginación, idempotencia y timeouts.
3. Centralizar auditoría server-side y configurar alertas reales.
4. Eliminar secretos del contexto de build web y restringir claves públicas.
5. Incorporar SAST, auditoría de dependencias, secret scanning y SBOM en CI.

### Medio plazo (31–90 días)

1. Formalizar un contrato OpenAPI y una matriz endpoint–rol–cliente–operación.
2. Ejecutar DAST autenticado y pruebas BOLA/BFLA con todos los perfiles.
3. Realizar pentest independiente antes del lanzamiento comercial.
4. Definir política MDM/dispositivos y protección de información offline.
5. Probar recuperación ante incidentes, respaldo de Neon y rotación de secretos.

## 8. Pruebas de cierre recomendadas

- Intentar acceso a cada recurso de otro cliente con los seis perfiles y con IDs alterados.
- Probar endpoints directos sin depender de la visibilidad de botones.
- Simular fuerza bruta distribuida de forma controlada y verificar límites por IP/cuenta.
- Repetir una solicitud de correo con la misma idempotency key y comprobar un solo envío.
- Enviar lotes y PDF justo por debajo y por encima de los límites definidos.
- Revocar una sesión y confirmar rechazo inmediato del JWT anterior.
- Comprobar CSP en modo reporte y revisar violaciones reales antes de exigirla.
- Escanear dependencias, secretos y artefactos compilados en cada build.
- Ejecutar pruebas PWA de actualización de versión, offline y recuperación.
- Verificar que logs y alertas se generen sin exponer PIN, JWT, API keys ni datos personales innecesarios.

## 9. Limitaciones y riesgo residual

- No se probaron ataques autenticados contra producción ni explotación de vulnerabilidades.
- No se revisó la configuración interna de Neon, Resend, Firebase, DNS o el panel de Vercel más allá de evidencia visible en código y respuestas HTTP.
- No se verificaron reglas Firebase/App Check, rotación efectiva de secretos, restauración de backups o retención de logs.
- La ausencia de un hallazgo no demuestra ausencia de vulnerabilidades. Se requiere repetir la evaluación tras los cambios y realizar un pentest independiente.

## 10. Dictamen

La evaluación inicial identificó una condición de bloqueo por credenciales demo conocidas. La remediación retiró esa condición, cerró los hallazgos técnicos altos y agregó controles de sesión, abuso, auditoría, PWA y dependencias. El código puede pasar a despliegue de validación; la habilitación comercial requiere cumplir las condiciones externas de la sección siguiente y efectuar una prueba de penetración independiente.

## 11. Seguimiento de remediación — 10 de agosto de 2026

La revisión de cierre incorporó controles técnicos y operativos para los trece hallazgos. El estado del código pasa de **riesgo alto** a **apto para despliegue de validación**, sujeto a activar secretos, alertas y políticas en el entorno productivo.

| Hallazgo | Estado de cierre | Control aplicado |
|---|---|---|
| OWASP-01 | Cerrado en código | Usuarios demo sólo con habilitación local explícita; administrador productivo de un solo uso, PIN de seis dígitos y cambio obligatorio. |
| OWASP-02 | Cerrado en código | CSP y encabezados contra MIME sniffing, framing, fuga de referencia, permisos y cacheo de API/service worker. |
| OWASP-03 | Cerrado | Dependencias actualizadas; `npm audit` informa cero vulnerabilidades. |
| OWASP-04 | Cerrado en código | Límites durables por IP/cuenta, mensajes uniformes, comparación costosa aun para cuentas inexistentes y auditoría. |
| OWASP-05 | Cerrado en código | Cuotas, límites de carga/lote, validación, tiempos máximos e idempotencia de correo. |
| OWASP-06 | Cerrado en código | Sesiones persistentes revocables, expiración de ocho horas, revocación en logout/cambio de PIN/baja y rol vigente desde BD. |
| OWASP-07 | Mitigado | Purga local al cerrar/invalidar sesión o cambiar cliente, bloqueo ante pendientes y política obligatoria de dispositivos. Riesgo residual: IndexedDB depende del cifrado del sistema operativo. |
| OWASP-08 | Cerrado en código; activación externa pendiente | Auditoría sólo del servidor, alertas estructuradas y webhook opcional documentado. |
| OWASP-09 | Cerrado | Secretos retirados de las definiciones de Vite y escaneo automatizado de seguridad del build. |
| OWASP-10 | Cerrado | Fallback de permisos reducido a visita y autorización efectiva en servidor. |
| OWASP-11 | Cerrado en código | Aviso de actualización PWA y service worker sin caché. |
| OWASP-12 | Cerrado | Docker y mock local requieren habilitación/secretos explícitos; no hay credenciales productivas por defecto. |
| OWASP-13 | Cerrado en código | PIN uniforme de seis dígitos, validaciones consistentes y cambio inicial obligatorio. |

### Condiciones de despliegue

- Definir `JWT_SECRET` y `SECURITY_HASH_PEPPER` aleatorios y distintos en Vercel.
- Usar `CMMS_BOOTSTRAP_ADMIN_EMAIL` y `CMMS_BOOTSTRAP_ADMIN_PIN` sólo para la primera alta; retirarlos después de cambiar el PIN. El seed no sobrescribe una cuenta ya creada.
- Activar y probar el webhook de alertas o reglas equivalentes del proveedor de observabilidad.
- Restringir las claves públicas de Firebase/Google por dominio y API en Google Cloud; su presencia en el cliente es necesaria y no las convierte en secretos.
- Aplicar [POLITICA_SEGURIDAD_DISPOSITIVOS.md](POLITICA_SEGURIDAD_DISPOSITIVOS.md) a los dispositivos que operarán offline.
- Ejecutar las pruebas de cierre de la sección 8 en Preview y posteriormente en Producción.
