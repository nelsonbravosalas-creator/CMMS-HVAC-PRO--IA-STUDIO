# Plan de pruebas QA in situ — CMMS HVAC PRO

## 1. Objetivo

Este documento permite que un QA valide presencialmente CMMS HVAC PRO en
producción, usando equipos y redes reales. Complementa los reportes históricos;
no los reemplaza.

El QA debe comprobar:

- flujos funcionales de cada perfil;
- persistencia y sincronización de datos;
- funcionamiento móvil, escritorio y PWA;
- accesibilidad básica;
- generación y envío de documentos;
- recuperación ante pérdida de conexión;
- compatibilidad entre navegadores.

### Alcance de esta versión

El plan cubre todas las rutas funcionales publicadas, sus acciones principales,
variantes por perfil, escenarios negativos de mayor riesgo y las integraciones
activas. “Cobertura completa” no significa probar todas las combinaciones
matemáticamente posibles: cuando un campo admite miles de valores se aplican
particiones equivalentes, valores límite y combinaciones de riesgo.

Cada nueva ruta, botón con efecto, rol, estado de negocio o endpoint debe agregar
o actualizar al menos un caso en este documento.

### Trazabilidad de rutas publicadas

| Ruta | Módulo | Familias de casos |
|---|---|---|
| `/login` | Inicio de sesión | `AUT`, `SEG`, `BIO` |
| `/client-selector` | Selector de cliente | `CLI`, `ROL`, `NAV` |
| `/` | Dashboard | `NAV`, `MOB`, `EFI` |
| `/scanner` | Scanner/generador QR | `QR` |
| `/equipos` | Listado y alta de equipos | `EQP` |
| `/equipos/:assetId` | Detalle del equipo | `EQP`, `QR`, `MAP` |
| `/mapa` | Mapa de activos | `MAP` |
| `/clientes` | Clientes y sucursales | `CLI` |
| `/inventario` | Inventario interno | `INV` |
| `/mantenimientos` | Mantenimientos | `MNT` |
| `/planificacion` | Calendario y planificación | `PLN` |
| `/ordenes-servicio` | Listado de órdenes | `OS` |
| `/ordenes-servicio/:id` | Editor de orden | `OS`, `COM` |
| `/ordenes-servicio/:orderId/informes/:id` | Informe perteneciente a una orden | `OS`, `INF`, `COM` |
| `/informes` y `/informes/:id` | Compatibilidad de enlaces antiguos | Redirige a órdenes; nunca abre informes huérfanos |
| `/tickets` | Tickets | `TCK`, `COM` |
| `/reportes` | Reportes y analítica | `RPT` |
| `/eficiencia` | Eficiencia energética | `EFI` |
| `/administracion` | Usuarios | `USR`, `ROL` |
| `/biometria` | PIN y biometría | `SEG`, `BIO` |
| `/consola` | Eventos técnicos | `CON` |
| `/configuracion` | Configuración y datos | `CFG` |
| Ruta inexistente | Recuperación/404 | `NAV`, `API` |

## 2. Reglas de ejecución

1. No eliminar los registros creados durante estas pruebas.
2. Anteponer `QA-INSITU-AAAAMMDD` a clientes, sucursales, equipos, órdenes,
   informes, tickets e inventario creados.
3. No modificar registros reales, salvo autorización expresa del responsable.
4. No registrar PIN, API keys ni contraseñas en capturas o en este documento.
5. Capturar evidencia de cada fallo y anotar URL, perfil, dispositivo, hora y
   pasos exactos.
6. Si aparece pérdida de datos, cruce de clientes, acceso no autorizado o un
   error que impida continuar, detener la prueba afectada y escalarlo.

## 3. Información que debe completar el responsable

| Dato | Valor |
|---|---|
| URL de producción | `https://cmms-hvac-pro-ia-studio.vercel.app` |
| Fecha de ejecución | |
| Versión/commit desplegado | |
| Nombre del QA | |
| Responsable presente | |
| Correo receptor de pruebas | |
| Cliente real autorizado para lectura | |
| Cliente QA asignado | |

### Usuarios de prueba para iniciar sesión

Estas cuentas corresponden al seed de demostración vigente. Todos los perfiles
usan temporalmente el PIN `1234`.

> **Importante:** estas credenciales son exclusivamente para QA y piloto
> controlado. Antes de incorporar usuarios reales se deben reemplazar los
> correos `@cmms.local`, asignar PIN individuales y retirar este cuadro del
> documento operativo que se distribuya externamente.

| Perfil | Correo de inicio de sesión | PIN | Contexto inicial | Probado |
|---|---|---|---|---|
| Administrador | `admin@cmms.local` | `1234` | Global; puede seleccionar cliente | ☐ |
| Supervisor | `supervisor@cmms.local` | `1234` | EECOL ELECTRIC (`C1`) | ☐ |
| Técnico | `tecnico@cmms.local` | `1234` | EECOL ELECTRIC (`C1`) | ☐ |
| Contratista | `contratista@cmms.local` | `1234` | EECOL ELECTRIC (`C1`) | ☐ |
| Cliente | `cliente@cmms.local` | `1234` | EECOL ELECTRIC (`C1`) | ☐ |
| Visita | `visita@cmms.local` | `1234` | EECOL ELECTRIC (`C1`) | ☐ |

Si alguna cuenta no permite iniciar sesión, el QA debe marcar `AUT-01` como
fallido y solicitar al administrador que confirme que el seed se encuentra
aplicado. No debe crear cuentas sustitutas ni cambiar PIN durante la prueba sin
autorización.

## 4. Equipos mínimos

| Código | Dispositivo | Navegador | Requerido |
|---|---|---|---|
| D1 | PC Windows | Chrome actualizado | Sí |
| D2 | PC Windows | Edge actualizado | Sí |
| D3 | Teléfono Android | Chrome actualizado | Sí |
| D4 | iPhone | Safari actualizado | Sí |
| D5 | Tablet Android o iPad | Chrome o Safari | Recomendado |

Probar al menos una red Wi-Fi y una conexión móvil. Registrar modelo, sistema
operativo y versión del navegador en el informe final.

### Recursos y autorizaciones adicionales

| Recurso | Uso | Condición |
|---|---|---|
| Segundo teléfono o PC | Conflictos y sincronización concurrente | Requerido para QA completo |
| Cámara y QR físico | Scanner y permisos | Requerido |
| Impresora o destino PDF | Impresión y etiquetas | Recomendado |
| Buzón externo a Resend | Entrega real de correos | Requerido |
| Acceso de lectura a Vercel | Logs, versión y errores 5xx | Requerido para observabilidad |
| Acceso de lectura a Neon | Confirmación excepcional de persistencia | Sólo cuando el resultado UI sea ambiguo |
| Acceso de lectura a Resend | Estado de entrega/rechazo | Requerido para correo |
| Archivos QA válidos e inválidos | Importación, logo y adjuntos | Requerido |
| NVDA y VoiceOver | Accesibilidad | Requerido para cobertura completa |
| Ambiente aislado o autorización destructiva | Reset, importación, clonación y borrados | Obligatorio; no ejecutar libremente en producción |
| Autorización de seguridad | Pruebas IDOR, inyección y manipulación API | Obligatoria y acotada al cliente QA |

## 5. Criterios de resultado

- **Aprobado:** resultado esperado obtenido sin pérdida de información.
- **Aprobado con observación:** funciona, pero existe un problema visual o de
  usabilidad menor.
- **Fallido:** no funciona, genera datos incorrectos o bloquea el flujo.
- **No ejecutado:** falta dispositivo, permiso, dato o servicio externo.

### Severidad de defectos

- **Crítica:** pérdida o exposición de datos, cruce entre clientes, acceso no
  autorizado o sistema inutilizable.
- **Alta:** un flujo principal no puede completarse.
- **Media:** existe alternativa, pero el uso queda afectado.
- **Baja:** detalle visual, texto o comodidad sin pérdida funcional.

## 6. Registro de evidencias

Nombrar archivos así:

`QA-INSITU-AAAAMMDD-CASO-DISPOSITIVO-RESULTADO.png`

Ejemplo:

`QA-INSITU-20260728-MOB-04-ANDROID-FALLIDO.png`

Para cada fallo registrar:

| Campo | Detalle |
|---|---|
| Caso | |
| Resultado real | |
| Resultado esperado | |
| Perfil | |
| Dispositivo/navegador | |
| URL | |
| Hora local | |
| Reproducibilidad | Siempre / Intermitente / Una vez |
| Evidencia | |
| Severidad propuesta | |

## 7. Preparación inicial

| ID | Acción | Resultado esperado | Estado |
|---|---|---|---|
| PRE-01 | Abrir producción en ventana privada | Login carga sin error crítico | ☐ |
| PRE-02 | Confirmar commit desplegado con el responsable | Corresponde a la versión programada | ☐ |
| PRE-03 | Confirmar disponibilidad de Neon, Vercel y Resend | Servicios operativos | ☐ |
| PRE-04 | Confirmar usuarios temporales para todos los perfiles | Se dispone de seis perfiles | ☐ |
| PRE-05 | Confirmar permiso para conservar datos QA | Responsable acepta los registros identificados | ☐ |
| PRE-06 | Registrar dispositivos, SO, navegador y red | Matriz de entorno completa | ☐ |

## 8. Autenticación y sesión

Ejecutar en escritorio y Android; repetir los casos principales en Safari.

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| AUT-01 | Ingresar con correo y PIN válidos | Acceso correcto según perfil | ☐ |
| AUT-02 | Ingresar con PIN incorrecto | Rechazo claro, sin iniciar sesión | ☐ |
| AUT-03 | Ingresar con correo inexistente | Rechazo sin revelar datos internos | ☐ |
| AUT-04 | Mostrar y ocultar PIN | Control responde y conserva el valor | ☐ |
| AUT-05 | Recargar con sesión iniciada | Sesión y contexto se conservan correctamente | ☐ |
| AUT-06 | Cerrar sesión | Regresa a login y bloquea rutas privadas | ☐ |
| AUT-07 | Usar Atrás después de cerrar sesión | No recupera información privada | ☐ |
| AUT-08 | Dejar sesión inactiva y retomarla | No queda una pantalla bloqueada | ☐ |
| AUT-09 | Fallar el PIN cinco veces | Activa bloqueo temporal sin revelar si la cuenta existe | ☐ |
| AUT-10 | Usar PIN correcto durante el bloqueo | Rechaza e informa tiempo de espera coherente | ☐ |
| AUT-11 | Ingresar después de finalizar el bloqueo | Permite acceso con credenciales válidas | ☐ |
| AUT-12 | Probar correo con mayúsculas y espacios laterales | Normaliza el correo sin crear otra identidad | ☐ |
| AUT-13 | Probar PIN vacío, 3, 5 dígitos, letras y símbolos | Sólo acepta exactamente cuatro dígitos | ☐ |
| AUT-14 | Cerrar sesión en una pestaña y operar en otra | La otra pestaña deja de acceder al actualizar/solicitar datos | ☐ |
| AUT-15 | Superar 30 minutos de inactividad controlada | Solicita autenticación nuevamente según política | ☐ |
| AUT-16 | Usar sesión expirada | API rechaza y la aplicación vuelve a login | ☐ |
| AUT-17 | Autenticar usuario desactivado | Acceso rechazado con mensaje seguro | ☐ |

## 9. Perfiles, permisos y aislamiento

| ID | Perfil | Prueba | Resultado esperado | Estado |
|---|---|---|---|---|
| ROL-01 | Administrador | Abrir todos los módulos y configuración | Acceso administrativo completo | ☐ |
| ROL-02 | Supervisor | Revisar clientes y operación permitida | Sólo acciones autorizadas | ☐ |
| ROL-03 | Técnico | Crear/editar operación técnica | Puede operar sin administrar usuarios | ☐ |
| ROL-04 | Contratista | Acceder a trabajo asignado | No administra clientes ni usuarios | ☐ |
| ROL-05 | Cliente | Revisar sus activos y órdenes | No ve información de otros clientes | ☐ |
| ROL-06 | Visita | Recorrer opciones disponibles | Acceso restringido y sin escrituras indebidas | ☐ |
| ROL-07 | Todos | Escribir manualmente una URL no autorizada | Acceso denegado, no contenido parcial | ☐ |
| ROL-08 | Administrador | Cambiar entre vista global y cliente | Datos y encabezado corresponden al contexto | ☐ |
| ROL-09 | Dos clientes | Buscar datos con igual texto o etiqueta | Nunca se mezclan registros entre clientes | ☐ |
| ROL-10 | Todos | Invocar directamente una escritura no permitida | API responde 403 y no modifica datos | ☐ |
| ROL-11 | No administrador | Alterar `cliente_id` o encabezado de cliente | No lee ni escribe en otro tenant | ☐ |
| ROL-12 | Cliente | Intentar editar activos, inventario y usuarios | Controles ausentes y API rechaza la operación | ☐ |
| ROL-13 | Visita | Intentar cualquier escritura | Todas las escrituras quedan bloqueadas | ☐ |
| ROL-14 | Técnico/Contratista | Intentar eliminar una orden | Operación rechazada y orden intacta | ☐ |
| ROL-15 | Supervisor | Intentar administrar usuarios o configuración global | Acceso denegado | ☐ |
| ROL-16 | Usuario multicliente autorizado | Cambiar entre clientes asignados | Sólo muestra contextos asignados | ☐ |

## 10. Navegación y Dashboard

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| NAV-01 | Abrir cada opción del menú principal | Navega sin pantalla blanca ni error crítico | ☐ |
| NAV-02 | Usar Atrás/Adelante del navegador | Ruta, título y contenido quedan coherentes | ☐ |
| NAV-03 | Recargar cada módulo principal | El módulo vuelve a abrir correctamente | ☐ |
| NAV-04 | Cambiar tema claro/oscuro | Todos los textos mantienen contraste | ☐ |
| NAV-05 | Recargar después de cambiar tema | Preferencia visual se conserva | ☐ |
| NAV-06 | Revisar tarjetas y gráficos del Dashboard | Datos legibles, sin desbordes ni avisos de tamaño | ☐ |
| NAV-07 | Cambiar sucursal y estado | Métricas y listados responden al filtro | ☐ |
| NAV-08 | Revisar “Pendientes de firma” | Tarjeta completa y accionable | ☐ |
| NAV-09 | Abrir una URL inexistente | Muestra página controlada y permite volver | ☐ |
| NAV-10 | Abrir enlace profundo en una pestaña nueva | Carga la ruta correcta sin pasar por una pantalla rota | ☐ |
| NAV-11 | Navegar mientras carga un módulo diferido | Indicador visible; nunca pantalla blanca permanente | ☐ |
| NAV-12 | Simular un chunk antiguo después de despliegue | Recupera/recarga de forma controlada | ☐ |
| NAV-13 | Revisar estados vacíos en todos los módulos | Explican qué falta sin mostrar datos ficticios | ☐ |
| NAV-14 | Probar textos, RUT y nombres excepcionalmente largos | No corta acciones ni crea scroll horizontal | ☐ |
| NAV-15 | Usar acceso rápido “Escanear QR” | Abre scanner en modo esperado | ☐ |
| NAV-16 | Usar acciones “Atender”, pendientes y calendario | Cada control abre el registro/listado correcto | ☐ |
| NAV-17 | Abrir notificaciones con y sin fallas | Estado y destino corresponden a los datos reales | ☐ |

## 11. Menú móvil y controles flotantes

Repetir cada caso al menos cinco veces para detectar fallos intermitentes.

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| MOB-01 | Abrir y cerrar con X cinco veces | Siempre cierra y permite seguir tocando | ☐ |
| MOB-02 | Abrir y tocar fuera cinco veces | Cierra sin dejar capa invisible | ☐ |
| MOB-03 | Elegir cinco módulos diferentes | Navega, cierra menú y habilita la nueva pantalla | ☐ |
| MOB-04 | Pulsar “Continuar” cinco veces | Cierra y no bloquea controles posteriores | ☐ |
| MOB-05 | Abrir menú, rotar teléfono y cerrarlo | Se adapta y conserva controles accesibles | ☐ |
| MOB-06 | Cambiar controles entre derecha e izquierda | Posición se guarda al recargar | ☐ |
| MOB-07 | Desplazarse hasta el final de cada módulo | Barra flotante no tapa el último contenido | ☐ |
| MOB-08 | Revisar encabezado con texto largo de cliente | No genera desplazamiento horizontal | ☐ |
| MOB-09 | Abrir Sync Inspector desde el menú | Panel cabe en pantalla y puede cerrarse | ☐ |
| MOB-10 | Abrir y cerrar el menú con navegación lenta | Ninguna capa invisible captura toques | ☐ |
| MOB-11 | Pulsar dos opciones rápidamente | Una sola navegación coherente y menú cerrado | ☐ |
| MOB-12 | Cerrar con Escape usando teclado físico | Cierra menú y devuelve control a la página | ☐ |
| MOB-13 | Abrir/cerrar el cajón de opciones secundarias | No bloquea ni se superpone permanentemente | ☐ |
| MOB-14 | Activar banner de instalación PWA | Texto y botones caben y el cierre funciona | ☐ |

## 12. Clientes y sucursales

Usar el prefijo obligatorio y conservar los datos.

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| CLI-01 | Crear cliente `QA-INSITU-AAAAMMDD CLIENTE` | Se guarda y aparece una sola vez | ☐ |
| CLI-02 | Completar RUT, contacto, correo, dirección y región | Campos se conservan al recargar | ☐ |
| CLI-03 | Crear Casa Matriz | Queda asociada al cliente correcto | ☐ |
| CLI-04 | Crear segunda sucursal | Ambas aparecen sin duplicarse | ☐ |
| CLI-05 | Editar contacto y dirección | Cambio persiste tras sincronizar y recargar | ☐ |
| CLI-06 | Intentar RUT o dato obligatorio inválido | Validación comprensible, sin guardar basura | ☐ |
| CLI-07 | Cambiar al cliente QA desde selector | Todo el sistema adopta ese contexto | ☐ |
| CLI-08 | Intentar crear otro cliente con el mismo RUT | Detecta duplicado y no crea segunda ficha | ☐ |
| CLI-09 | Crear sucursal con nombre/código duplicado | Aplica la regla definida sin duplicación silenciosa | ☐ |
| CLI-10 | Probar correo, teléfono y región inválidos | Marca cada error y conserva lo ya digitado | ☐ |
| CLI-11 | Abrir selector como usuario sin clientes | Informa que requiere asignación, sin acceso global | ☐ |
| CLI-12 | Abrir selector como usuario con varios clientes | Muestra exactamente los clientes asignados | ☐ |
| CLI-13 | Cancelar creación/edición con cambios | No guarda cambios y cierra correctamente | ☐ |
| CLI-14 | **Condicional:** dar de baja cliente QA con relaciones | Solicita confirmación y trata dependencias sin huérfanos | ☐ |
| CLI-15 | **Condicional:** dar de baja una sucursal QA con activo | Impide o resuelve la dependencia explícitamente | ☐ |

## 13. Equipos y activos

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| EQP-01 | Crear equipo `QA-INSITU-AAAAMMDD EQUIPO` | Asociado al cliente y sucursal QA | ☐ |
| EQP-02 | Completar marca, modelo, serie y datos eléctricos | Información persiste completa | ☐ |
| EQP-03 | Editar estado operativo | Dashboard y ficha reflejan el cambio | ☐ |
| EQP-04 | Abrir detalle y recargar | Mismo equipo, sin error de ruta | ☐ |
| EQP-05 | Generar/mostrar QR | QR corresponde al activo | ☐ |
| EQP-06 | Escanear QR desde teléfono | Abre el activo correcto | ☐ |
| EQP-07 | Marcar equipo como baja | No permite mantenimiento operativo indebido | ☐ |
| EQP-08 | Buscar por nombre, etiqueta o serie | Resultado correcto y sin cruce de cliente | ☐ |
| EQP-09 | Crear etiqueta duplicada dentro del mismo cliente | Rechaza duplicado sin sobrescribir el original | ☐ |
| EQP-10 | Usar la misma etiqueta en otro cliente | Mantiene ambos activos aislados por tenant | ☐ |
| EQP-11 | Intentar asociar una sucursal de otro cliente | Rechaza la relación cruzada | ☐ |
| EQP-12 | Guardar sin campos obligatorios o con valores eléctricos inválidos | Valida y no persiste datos corruptos | ☐ |
| EQP-13 | Cancelar alta o edición | No crea operación pendiente | ☐ |
| EQP-14 | Abrir ID inexistente o dado de baja | Estado controlado, sin error crítico | ☐ |
| EQP-15 | **Condicional:** eliminar registro previamente dado de baja | Desaparece y no reaparece después de sincronizar | ☐ |
| EQP-16 | Descargar plantilla de importación | Archivo contiene columnas y ejemplo válidos | ☐ |
| EQP-17 | Importar CSV válido | Crea una sola vez cada fila y muestra resumen | ☐ |
| EQP-18 | Importar TAG repetido, estado inválido o sucursal inexistente | Informa error por fila sin alta indebida | ☐ |
| EQP-19 | Importar archivo incorrecto o mayor al límite | Rechaza antes de procesar | ☐ |
| EQP-20 | Repetir el mismo archivo | No duplica activos | ☐ |
| EQP-21 | Probar filtros guardados y orden ascendente/descendente | Resultados y preferencia se conservan | ☐ |
| EQP-22 | Alternar grilla, lista e iconos | Mismos activos y acciones en todas las vistas | ☐ |
| EQP-23 | Probar captura/OCR y corregir resultado antes de guardar | Sólo persiste el valor confirmado por el QA | ☐ |

## 14. Scanner y generación QR

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| QR-01 | Autorizar cámara e iniciar scanner | Vista de cámara inicia y puede detenerse | ☐ |
| QR-02 | Denegar permiso de cámara | Mensaje recuperable y opción para reintentar | ☐ |
| QR-03 | Probar dispositivo sin cámara o cámara ocupada | No bloquea la pantalla y explica el problema | ☐ |
| QR-04 | Escanear QR de activo vigente | Abre exactamente la ficha correspondiente | ☐ |
| QR-05 | Escanear QR de otro cliente no autorizado | No expone la ficha ni sus datos | ☐ |
| QR-06 | Escanear texto, QR malformado o activo inexistente | Informa código inválido sin navegar incorrectamente | ☐ |
| QR-07 | Abrir enlace QR legado `?tag=...` antes de iniciar sesión | Conserva destino y lo abre después de autenticar | ☐ |
| QR-08 | Alternar scanner y generador repetidamente | Cámara se libera y la interfaz sigue respondiendo | ☐ |
| QR-09 | Generar etiqueta eligiendo sucursal, tipo y correlativo | TAG y contenido QR coinciden con la selección | ☐ |
| QR-10 | Exportar etiqueta como imagen | Archivo descargado es legible y contiene el TAG | ☐ |
| QR-11 | Imprimir etiqueta | Vista de impresión no incluye controles de la aplicación | ☐ |
| QR-12 | Registrar activo desde el generador | Crea un único activo vinculado al cliente/sucursal | ☐ |
| QR-13 | Repetir un TAG ya registrado | Rechaza duplicado sin alterar el activo existente | ☐ |

## 15. Mapa y ubicación

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| MAP-01 | Abrir mapa con activos geolocalizados | Marcadores, lista y total coinciden | ☐ |
| MAP-02 | Filtrar por texto | Marcadores y lista muestran los mismos resultados | ☐ |
| MAP-03 | Filtrar operativo, falla y mantenimiento | Conteos y activos coinciden con cada estado | ☐ |
| MAP-04 | Limpiar filtros | Recupera todos los activos del contexto | ☐ |
| MAP-05 | Abrir activo desde marcador | Presenta la ficha del activo correcto | ☐ |
| MAP-06 | Abrir activo desde lista | Presenta la misma información que el marcador | ☐ |
| MAP-07 | Probar activo sin coordenadas o coordenadas inválidas | Estado vacío comprensible, sin romper el mapa | ☐ |
| MAP-08 | Probar cliente sin activos | Explica que no existen ubicaciones | ☐ |
| MAP-09 | Usar mapa en móvil, rotar y volver | Conserva filtros y controles utilizables | ☐ |
| MAP-10 | Probar acciones “Inspeccionar” y “Reportes” | Navegan al destino correcto o informan si no están disponibles | ☐ |

## 16. Inventario interno

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| INV-01 | Crear recurso `QA-INSITU-AAAAMMDD REPUESTO` | Recurso visible una sola vez | ☐ |
| INV-02 | Aumentar stock | Cantidad y movimiento se conservan | ☐ |
| INV-03 | Disminuir stock | No permite cantidad negativa | ☐ |
| INV-04 | Editar nombre, unidad y mínimo | Cambios persistentes | ☐ |
| INV-05 | Usar inventario desde móvil | Controles accesibles y sin desborde | ☐ |
| INV-06 | Forzar sincronización y recargar | No reaparece versión anterior ni duplicado | ☐ |
| INV-07 | Probar todas las categorías y estados | Filtros y ficha coinciden con selección | ☐ |
| INV-08 | Buscar por nombre/código | Resultado correcto, sin recursos de otro cliente | ☐ |
| INV-09 | Asignar recurso a personal | Responsable persiste y queda visible | ☐ |
| INV-10 | Ajustar con decimal, texto, cero y valor extremo | Sólo admite cantidades válidas | ☐ |
| INV-11 | Ajustar simultáneamente desde dos dispositivos | Resultado atómico, nunca negativo ni `NaN` | ☐ |
| INV-12 | Pulsar ajuste dos veces rápidamente | No duplica el movimiento accidentalmente | ☐ |
| INV-13 | **Condicional:** eliminar recurso QA | No reaparece tras sincronizar ni afecta otro tenant | ☐ |

## 17. Mantenimientos y planificación

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| MNT-01 | Crear mantenimiento para equipo QA | Se guarda con fecha y frecuencia correctas | ☐ |
| MNT-02 | Verlo en calendario | Aparece en la fecha esperada | ☐ |
| MNT-03 | Editar programación | Calendario refleja el cambio | ☐ |
| MNT-04 | Marcar como ejecutado | Estado y próxima fecha son coherentes | ☐ |
| MNT-05 | Intentar programar equipo dado de baja | Operación bloqueada con mensaje claro | ☐ |
| MNT-06 | Revisar calendario en móvil y tablet | Eventos y controles son utilizables | ☐ |
| MNT-07 | Crear preventivo, correctivo y emergencia | Tipo y estado permitidos persisten | ☐ |
| MNT-08 | Probar cada frecuencia disponible | Próxima fecha se calcula correctamente | ☐ |
| MNT-09 | Guardar técnico, duración, costos, GPS y hallazgos | Todos los campos persisten al recargar | ☐ |
| MNT-10 | Guardar recomendaciones y repuestos | Detalle conserva listas y cantidades | ☐ |
| MNT-11 | Cerrar formulario con cambios sin guardar | Advierte; permite continuar o descartar | ☐ |
| MNT-12 | Cerrar formulario sin cambios | Cierra sin advertencia innecesaria | ☐ |
| MNT-13 | Abrir, editar y volver a abrir mantenimiento | Lista, detalle y calendario reflejan cambios | ☐ |
| MNT-14 | **Condicional:** eliminar mantenimiento QA | Desaparece de listado y calendario tras sincronizar | ☐ |
| PLN-01 | Alternar calendario y lista | Ambas vistas muestran las mismas actividades | ☐ |
| PLN-02 | Crear y abrir actividad manual | Persiste con fecha, hora, técnico y relación correctas | ☐ |
| PLN-03 | **Condicional:** eliminar actividad QA | Se elimina de ambas vistas sin afectar mantenimiento | ☐ |
| PLN-04 | Conectar/desconectar Google Calendar | Estado y autorización se reflejan correctamente | ☐ |
| PLN-05 | Importar eventos y repetir importación | No duplica eventos | ☐ |
| PLN-06 | Simular error o cancelación OAuth | Conserva actividades locales y muestra error accionable | ☐ |
| PLN-07 | Abrir como cliente y visita | Modo sólo lectura; no ofrece crear/eliminar | ☐ |

## 18. Órdenes de servicio

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| OS-01 | Crear orden `QA-INSITU-AAAAMMDD OS` | Borrador asociado al cliente y a una sucursal | ☐ |
| OS-02 | Guardar cliente, sucursal, fecha, técnico y motivo | Datos se conservan al recargar | ☐ |
| OS-03 | Crear una orden sin seleccionar equipo | Se guarda; los equipos se seleccionan en los informes | ☐ |
| OS-04 | Agregar firma cliente | Firma visible y persistente | ☐ |
| OS-05 | Agregar firma técnico/contratista | Firma vinculada al rol correcto | ☐ |
| OS-06 | Guardar desde móvil | No se pierden campos ni firmas | ☐ |
| OS-07 | Descargar PDF en Edge | Contiene solamente portada y resumen de informes | ☐ |
| OS-08 | Descargar PDF en Chrome Android | Portada y resumen abren completos y legibles | ☐ |
| OS-09 | Enviar PDF por correo | Correo recibido, remitente y adjunto correctos | ☐ |
| OS-10 | Buscar y filtrar por cada estado | Tarjetas y contadores coinciden | ☐ |
| OS-11 | Crear informes para dos equipos distintos de la misma sucursal | Ambos aparecen en el resumen de una sola orden | ☐ |
| OS-12 | Intentar usar en un informe un equipo de otra sucursal/cliente o dado de baja | Bloquea la relación inválida | ☐ |
| OS-13 | Cerrar una orden sin informes | Permite cerrar como visita sin inspección si tiene las firmas requeridas | ☐ |
| OS-14 | Intentar cerrar con uno o más informes en borrador | Bloquea el cierre y enumera el motivo | ☐ |
| OS-15 | Finalizar sin firma técnica | Indica firma faltante y conserva borrador | ☐ |
| OS-16 | Finalizar sin firma cliente cuando es obligatoria | Indica firma faltante sin cambiar estado | ☐ |
| OS-17 | Retirar y repetir firma antes de cerrar | Sólo la firma vigente queda guardada | ☐ |
| OS-18 | Finalizar todos los informes y cerrar la orden | Cierre permitido; la firma de la orden prevalece | ☐ |
| OS-19 | Intentar eliminar una orden con informes | Operación rechazada y datos intactos | ☐ |
| OS-20 | Abrir orden cerrada y cada informe hijo | Todo queda en sólo lectura y conserva firmas | ☐ |
| OS-21 | Abrir `/informes` o una URL antigua | Redirige al listado de órdenes | ☐ |
| OS-22 | Ver resumen con fecha, TAG, tipo, técnico, estado, fallas y firmas | Valores coinciden con cada informe | ☐ |
| OS-23 | Enviar correo dos veces rápidamente | Evita duplicado o informa claramente cada envío | ☐ |
| OS-24 | Reabrir una orden cerrada y entrar en Firmas | Ambas firmas guardadas se muestran y los lienzos no aceptan edición | ☐ |
| OS-25 | Descargar nuevamente el PDF de una orden cerrada | Portada, resumen y firmas principales coinciden con la orden guardada | ☐ |
| OS-26 | Administrador elimina una orden abierta sin informes | La orden desaparece y la eliminación se sincroniza | ☐ |
| OS-27 | Técnico intenta eliminar una orden vacía o administrador intenta eliminar una con informes/cerrada | No aparece la acción o el servidor rechaza la operación; los datos permanecen intactos | ☐ |

## 19. Tickets e informes

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| DOC-01 | Crear ticket QA | Visible con cliente, prioridad y estado correctos | ☐ |
| DOC-02 | Editar y cerrar ticket | Historial y estado persisten | ☐ |
| DOC-03 | Abrir una orden y crear un informe HVAC QA | Borrador queda enlazado exclusivamente a esa orden | ☐ |
| DOC-04 | Adjuntar evidencia permitida | Archivo/imagen visible tras recargar | ☐ |
| DOC-05 | Firmar informe | Firma corresponde al firmante | ☐ |
| DOC-06 | Exportar informe | Documento abre sin cortes ni texto ilegible | ☐ |
| DOC-07 | Revisar conteos de pendientes | Dashboard coincide con documentos pendientes | ☐ |
| TCK-01 | Crear cada tipo y prioridad de ticket | Tipo, prioridad y estado persisten | ☐ |
| TCK-02 | Crear “Falla Técnica” sin activo o con activo inválido | Exige activo válido | ☐ |
| TCK-03 | Probar borrador automático y cerrar con cambios | Permite continuar o descartar sin residuos | ☐ |
| TCK-04 | Capturar GPS y adjuntar varias fotos | Evidencias persisten al reabrir | ☐ |
| TCK-05 | Eliminar una evidencia | Sólo desaparece la seleccionada | ☐ |
| TCK-06 | Recorrer abierto → en proceso → resuelto → cerrado | Sólo permite transiciones válidas | ☐ |
| TCK-07 | **Condicional:** eliminar ticket según cada rol | Sólo perfiles autorizados pueden eliminar | ☐ |
| TCK-08 | Exportar listado CSV | Archivo coincide con filtros y datos visibles | ☐ |
| TCK-09 | Sincronizar con Google Tasks | Crea una tarea correspondiente sin duplicarla | ☐ |
| TCK-10 | Cerrar con envío de PDF | Estado, PDF y correo corresponden al ticket | ☐ |
| INF-01 | Intentar crear un informe sin abrir/guardar una orden | No crea registros huérfanos y redirige a órdenes | ☐ |
| INF-02 | Crear varios informes dentro de una orden | Resumen y contadores coinciden | ☐ |
| INF-03 | Abrir un informe con el ID de otra orden en la URL | Acceso rechazado y ninguna modificación | ☐ |
| INF-04 | Guardar borrador, salir y continuar desde la orden | Recupera exactamente la información guardada | ☐ |
| INF-05 | Capturar GPS, cámara y asistencia IA | Resultado queda revisable antes de guardar | ☐ |
| INF-06 | Seleccionar activo desde informe | Sólo ofrece equipos activos de la sucursal de la orden | ☐ |
| INF-07 | Guardar mediciones, circuitos y refrigerante | Valores persisten y cálculos son coherentes | ☐ |
| INF-08 | Exportar PDF antes y después de finalizar | Contenido refleja el estado correcto | ☐ |
| INF-09 | Reabrir informe finalizado | Sólo lectura; conserva datos y firmas | ☐ |
| INF-10 | Eliminar borrador como creador y como administrador | Se elimina; otro usuario no autorizado es rechazado | ☐ |
| INF-11 | Administrador devuelve informe finalizado a borrador | Recupera edición sólo si la orden sigue abierta | ☐ |
| INF-12 | Administrador traslada informe entre órdenes abiertas de la misma sucursal | Cambia de resumen sin duplicarse | ☐ |
| INF-13 | Trasladar entre clientes, sucursales o desde/hacia orden cerrada | Operación rechazada | ☐ |
| INF-14 | Crear OS e informe sin conexión y luego sincronizar | Se sincroniza primero la OS y luego el informe, sin error FK | ☐ |

## 20. Reportes y Eficiencia Energética

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| RPT-01 | Abrir Reportes sin datos | Estado vacío explícito; no muestra KPIs ficticios | ☐ |
| RPT-02 | Abrir Reportes con datos QA | KPIs coinciden con registros fuente | ☐ |
| RPT-03 | Recorrer pestañas de operación, costos, activos y actividad | Cada pestaña muestra el conjunto correcto | ☐ |
| RPT-04 | Aplicar período y filtros disponibles | Gráficos, tablas y totales usan el mismo filtro | ☐ |
| RPT-05 | Abrir/cerrar vista previa | Presenta exactamente lo que se exportará | ☐ |
| RPT-06 | Exportar CSV | Columnas, acentos, fechas y números abren correctamente | ☐ |
| RPT-07 | Exportar PDF | Documento respeta período, filtros y saltos de página | ☐ |
| RPT-08 | Probar nombres y datos muy extensos | No corta contenido esencial | ☐ |
| EFI-01 | Abrir Eficiencia sin telemetría | Explica ausencia de datos sin advertencias de gráfico | ☐ |
| EFI-02 | Abrir con datos de potencia/consumo | KPIs indican origen y equipos incluidos | ☐ |
| EFI-03 | Cambiar período y sucursal | Cálculos se actualizan al mismo contexto | ☐ |
| EFI-04 | Cambiar tarifa de energía | Costo calculado y preferencia persisten | ☐ |
| EFI-05 | Abrir detalle/QR de un equipo desde energía | Navega al activo correcto | ☐ |
| EFI-06 | Exportar resultado | Archivo coincide con indicadores visibles | ☐ |
| EFI-07 | Probar valores cero, nulos y extremos | No muestra `NaN`, infinito ni divisiones inválidas | ☐ |

## 21. Administración de usuarios

Todos los casos se ejecutan como administrador, salvo las comprobaciones de
acceso denegado.

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| USR-01 | Crear usuario de cada perfil | Perfil, correo, estado y contexto persisten | ☐ |
| USR-02 | Crear rol que requiere cliente sin asignarlo | Bloquea guardado y explica el requisito | ☐ |
| USR-03 | Asignar un cliente a técnico/contratista/cliente/visita | Sólo accede al cliente asignado | ☐ |
| USR-04 | Asignar múltiples clientes a un perfil permitido | Selector presenta exactamente esas asignaciones | ☐ |
| USR-05 | Crear correo duplicado con mayúsculas/espacios | Detecta duplicado normalizado | ☐ |
| USR-06 | Probar perfil desconocido y PIN inválido | Rechaza antes de persistir | ☐ |
| USR-07 | Editar nombre, rol y asignaciones | Cambio se refleja al iniciar nueva sesión | ☐ |
| USR-08 | Desactivar usuario QA | Usuario deja de autenticarse | ☐ |
| USR-09 | Reactivar usuario QA | Recupera acceso con permisos actuales | ☐ |
| USR-10 | Recargar lista desde servidor | No duplica usuarios ni pierde asignaciones | ☐ |
| USR-11 | Ejecutar re-mapeo de base autorizado | Resultado visible y sin duplicados | ☐ |
| USR-12 | Intentar abrir Administración con otro perfil | Ruta y API responden acceso denegado | ☐ |
| USR-13 | Ver respuesta/listado como no administrador | No expone PIN ni `pin_hash` | ☐ |

## 22. Seguridad, PIN y biometría

> El registro biométrico depende de hardware y navegador compatibles. Si la
> función continúa deshabilitada por diseño, se aprueba cuando comunica ese
> estado claramente y no simula un registro exitoso.

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| SEG-01 | Cambiar PIN usando PIN actual correcto | Confirma cambio sin revelar valores | ☐ |
| SEG-02 | Cerrar sesión y usar PIN antiguo/nuevo | Antiguo falla; nuevo inicia sesión | ☐ |
| SEG-03 | Usar PIN actual incorrecto | No modifica credencial | ☐ |
| SEG-04 | Usar confirmación distinta | Marca diferencia y no modifica credencial | ☐ |
| SEG-05 | Probar PIN vacío, corto, largo, letras y símbolos | Sólo acepta exactamente cuatro dígitos | ☐ |
| SEG-06 | Intentar cambio de PIN sin conexión | No informa éxito falso ni deja estados divergentes | ☐ |
| SEG-07 | Cancelar cambio | Conserva PIN anterior | ☐ |
| BIO-01 | Abrir biometría en equipo compatible | Informa capacidad real del dispositivo | ☐ |
| BIO-02 | Cancelar el diálogo del sistema | Vuelve a estado estable sin registrar huella | ☐ |
| BIO-03 | Completar registro biométrico autorizado | Refleja estado registrado sin guardar biometría cruda | ☐ |
| BIO-04 | Repetir registro existente | Maneja duplicado de manera controlada | ☐ |
| BIO-05 | Eliminar registro biométrico | Solicita confirmación y actualiza el estado | ☐ |
| BIO-06 | Probar equipo/navegador no compatible | Mensaje comprensible y alternativa con PIN | ☐ |
| BIO-07 | Intentar acceso biométrico desde Login | Funciona realmente o informa que está deshabilitado | ☐ |

## 23. Configuración, respaldo y consola

Los casos marcados **aislado** no se ejecutan directamente en producción sin
respaldo, ventana autorizada y responsable presente.

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| CFG-01 | Subir logo válido | Vista previa y logo persisten al recargar | ☐ |
| CFG-02 | Subir formato/tamaño no permitido | Rechaza con mensaje claro | ☐ |
| CFG-03 | Quitar logo | Recupera identidad predeterminada | ☐ |
| CFG-04 | Cambiar moneda entre opciones | Preferencia y formatos se actualizan | ☐ |
| CFG-05 | Ejecutar sincronización manual | Muestra avance/resultado y no duplica datos | ☐ |
| CFG-06 | Exportar XML | Archivo contiene estructura válida y UUID esperados | ☐ |
| CFG-07 | Importar XML válido en ambiente aislado | Restaura datos respetando relaciones y UUID | ☐ |
| CFG-08 | Importar XML corrupto/incompatible | Rechaza sin importación parcial silenciosa | ☐ |
| CFG-09 | **Aislado:** clonar producción en modo merge | Conserva datos locales y agrega/actualiza según política | ☐ |
| CFG-10 | **Aislado:** clonar producción en overwrite | Advierte alcance y reemplaza únicamente lo autorizado | ☐ |
| CFG-11 | **Aislado:** reset total | Exige confirmación, limpia datos previstos y vuelve a login | ☐ |
| CFG-12 | Intentar configuración como no administrador | Controles y endpoint quedan bloqueados | ☐ |
| CON-01 | Abrir consola con/sin eventos | Estado y conteos son coherentes | ☐ |
| CON-02 | Buscar y filtrar eventos | Sólo muestra coincidencias correctas | ☐ |
| CON-03 | Refrescar eventos | Incorpora eventos nuevos sin duplicar | ☐ |
| CON-04 | Exportar eventos XML | Archivo abre y contiene eventos visibles | ☐ |
| CON-05 | **Condicional:** limpiar eventos | Solicita confirmación y actualiza lista | ☐ |

## 24. API, seguridad negativa y aislamiento

Estas pruebas requieren autorización de seguridad y deben limitarse a cuentas,
IDs y datos `QA-INSITU`.

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| API-01 | Consultar `/api/health` | Respuesta controlada y sin secretos | ☐ |
| API-02 | Llamar endpoint protegido sin sesión | Responde 401, nunca HTML con datos | ☐ |
| API-03 | Usar perfil sin permiso en POST/PUT/DELETE | Responde 403 y no modifica persistencia | ☐ |
| API-04 | Usar método HTTP no permitido | Responde 405 con formato controlado | ☐ |
| API-05 | Consultar ID inexistente | Responde 404 sin detalles internos | ☐ |
| API-06 | Enviar JSON malformado o campos obligatorios ausentes | Responde 400 y no guarda parcialmente | ☐ |
| API-07 | Manipular `cliente_id`, query y encabezado hacia otro tenant | Rechaza y no expone existencia/datos | ☐ |
| API-08 | Probar IDOR con activo, orden, informe y usuario de otro cliente | Lectura, edición, exportación y borrado bloqueados | ☐ |
| API-09 | Probar texto con HTML/script en campos QA | Se almacena/muestra escapado; nunca ejecuta script | ☐ |
| API-10 | Probar caracteres SQL y Unicode extremos | No altera consulta ni rompe codificación | ☐ |
| API-11 | Inspeccionar respuestas sync como no administrador | No incluye `pin`, `pin_hash` ni otros tenants | ☐ |
| API-12 | Exportar/enviar documento inexistente o de otro cliente | Rechaza antes de enviar correo | ☐ |
| API-13 | Enviar Base64 inválido o excesivo a exportación | Error controlado, sin caída 5xx sostenida | ☐ |
| API-14 | Repetir una escritura con mismo identificador | Operación idempotente o conflicto explícito, no duplicado | ☐ |
| API-15 | Provocar 429/5xx controlado | Interfaz conserva datos y permite reintento seguro | ☐ |
| API-16 | Revisar errores del servidor | No revelan URL de BD, tokens, hashes o stack sensible | ☐ |

## 25. Correo, PDF y archivos

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| COM-01 | Enviar a destinatario externo válido | Resend confirma entrega y receptor abre el mensaje | ☐ |
| COM-02 | Cliente sin correo de contacto | Bloquea envío e indica qué dato falta | ☐ |
| COM-03 | Correo de destinatario inválido | Valida antes de invocar proveedor | ☐ |
| COM-04 | Remitente/dominio no verificado | Error accionable, sin indicar envío exitoso | ☐ |
| COM-05 | API key ausente, revocada o proveedor rechazando | Conserva documento y permite reintentar | ☐ |
| COM-06 | Doble pulsación en Enviar | No genera correos duplicados silenciosos | ☐ |
| COM-07 | PDF con acentos, ñ y símbolos | Texto correcto en navegador, descarga y correo | ☐ |
| COM-08 | PDF con textos largos y varias páginas | Sin solapamientos, cortes ni páginas vacías indebidas | ☐ |
| COM-09 | PDF con fotos y firmas grandes | Conserva proporción y no omite evidencias | ☐ |
| COM-10 | PDF de orden, informe y ticket | Tipo, ID, cliente y contenido corresponden | ☐ |
| COM-11 | Descargar y abrir archivo en Android/iPhone/Edge | Archivo físico válido y legible | ☐ |
| COM-12 | Adjuntar formato/tamaño no permitido | Rechaza antes de guardar/subir | ☐ |
| COM-13 | Interrumpir red durante carga de evidencia | No informa éxito falso ni deja referencia rota | ☐ |

## 26. PWA, conexión y sincronización

Ejecutar con un registro QA nuevo; no usar datos reales.

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| PWA-01 | Instalar desde Chrome Android | Icono y aplicación instalados | ☐ |
| PWA-02 | Abrir desde icono | Inicia en modo aplicación | ☐ |
| PWA-03 | Cerrar completamente y reabrir | Recupera sesión/estado según diseño | ☐ |
| PWA-04 | Activar modo avión en pantalla ya cargada | Interfaz sigue operativa donde corresponda | ☐ |
| PWA-05 | Crear o editar registro QA sin conexión | Se informa operación pendiente | ☐ |
| PWA-06 | Cerrar y reabrir todavía sin conexión | Cambio local continúa disponible | ☐ |
| PWA-07 | Recuperar conexión | Sincroniza una sola vez, sin duplicar | ☐ |
| PWA-08 | Verificar el dato desde otro dispositivo | Cambio llegó al servidor | ☐ |
| PWA-09 | Desplegar versión de control y reabrir PWA | Notifica/aplica actualización sin chunks obsoletos | ☐ |
| PWA-10 | Pasar varias veces online/offline | No bloquea botones ni pierde cola | ☐ |
| PWA-11 | Rechazar instalación y volver a intentarla | Aplicación sigue usable y permite intento posterior | ☐ |
| PWA-12 | Abrir una ruta previamente visitada desde arranque frío offline | Carga shell/ruta o explica limitación, sin pantalla del navegador | ☐ |
| PWA-13 | Abrir ruta nunca visitada sin conexión | Estado offline controlado | ☐ |
| PWA-14 | Actualizar con dos pestañas/PWA abiertas | Todas convergen a una versión coherente | ☐ |
| PWA-15 | Comprobar cachés después de actualizar | No solicita chunks eliminados de despliegues anteriores | ☐ |
| SYN-01 | Mezclar operaciones válidas, prohibidas y malformadas | Cada resultado queda marcado correctamente | ☐ |
| SYN-02 | Cerrar aplicación con cola pendiente y reabrir | Cola continúa disponible | ☐ |
| SYN-03 | Provocar tres fallos y luego sincronizar manualmente | Backoff/estado visibles y recuperación completa | ☐ |
| SYN-04 | Editar el mismo registro en dos dispositivos | Política de conflicto determinista, sin pérdida silenciosa | ☐ |
| SYN-05 | Enviar timestamp anterior, igual y futuro controlado | No sobrescribe datos nuevos de forma indebida | ☐ |
| SYN-06 | Crear offline y eliminar antes de sincronizar | No crea brevemente ni restaura el registro | ☐ |
| SYN-07 | Encadenar insert, varios update y delete | Cola compacta la intención final correctamente | ☐ |
| SYN-08 | Sincronizar una baja y forzar pull | Registro no reaparece | ☐ |
| SYN-09 | Cambiar cliente con cola pendiente | Operaciones mantienen tenant original | ☐ |
| SYN-10 | Forzar sync sin sesión o sesión expirada | No pierde cola; solicita autenticación | ☐ |

## 27. Compatibilidad y presentación

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| CMP-01 | Chrome Windows | Flujos principales aprobados | ☐ |
| CMP-02 | Edge Windows | Flujos principales aprobados | ☐ |
| CMP-03 | Chrome Android vertical/horizontal | Sin cortes ni desplazamiento lateral | ☐ |
| CMP-04 | Safari iPhone vertical/horizontal | Sin controles bloqueados | ☐ |
| CMP-05 | Tablet | Diseño aprovecha espacio y sigue táctil | ☐ |
| CMP-06 | Tema oscuro en todos los módulos | Texto, formularios y gráficos legibles | ☐ |
| CMP-07 | Aumentar zoom de escritorio a 200 % | Contenido usable sin pérdida funcional | ☐ |
| CMP-08 | Tamaño de texto grande en teléfono | Acciones principales siguen visibles | ☐ |

## 28. Accesibilidad básica

Para detalle adicional, consultar [QA_ACCESIBILIDAD.md](./QA_ACCESIBILIDAD.md).

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| ACC-01 | Recorrer login y módulos con Tab/Shift+Tab | Foco visible y orden lógico | ☐ |
| ACC-02 | Activar botones con Enter/Espacio | Misma acción que con puntero | ☐ |
| ACC-03 | Cerrar menú/modal con Escape | Cierra sin atrapar el foco | ☐ |
| ACC-04 | Usar NVDA con Chrome/Edge | Controles anuncian nombre y función | ☐ |
| ACC-05 | Usar VoiceOver con Safari | Navegación y formularios comprensibles | ☐ |
| ACC-06 | Provocar error de validación | Error se anuncia y señala el campo | ☐ |
| ACC-07 | Revisar contraste claro/oscuro | Información legible sin depender sólo del color | ☐ |

## 29. Resiliencia y rendimiento

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| RES-01 | Recargar mientras guarda un registro QA | No duplica ni corrompe el registro | ☐ |
| RES-02 | Pulsar Guardar dos veces rápidamente | Una sola operación efectiva | ☐ |
| RES-03 | Cambiar de pantalla durante sincronización | No queda interfaz bloqueada | ☐ |
| RES-04 | Abrir sesión en dos dispositivos | Cambios convergen sin sobrescribir datos nuevos | ☐ |
| RES-05 | Simular red lenta desde herramientas del navegador | Indicadores claros y controles estables | ☐ |
| RES-06 | Probar 5 usuarios concurrentes durante 15 minutos | Sin 5xx ni degradación funcional grave | ☐ |
| RES-07 | Revisar logs durante la prueba | Sin errores 5xx o fallos repetitivos ocultos | ☐ |
| RES-08 | Probar volumen esperado del piloto | Listas, búsquedas y filtros siguen utilizables | ☐ |
| RES-09 | Repetir guardados durante latencia alta | Indicador visible y sin duplicados | ☐ |
| RES-10 | Interrumpir una petición y reintentar | Estado final único y comprensible | ☐ |
| RES-11 | Mantener dos usuarios editando datos relacionados | No crea relaciones huérfanas | ☐ |
| RES-12 | Revisar consumo y temperatura en móvil durante 30 minutos | Sin degradación anormal atribuible a bucles de la app | ☐ |

## 30. Comprobación final de persistencia

Realizar desde un dispositivo distinto al utilizado para crear los datos.

| ID | Comprobación | Resultado esperado | Estado |
|---|---|---|---|
| FIN-01 | Buscar cliente y sucursales QA | Existen una sola vez | ☐ |
| FIN-02 | Buscar equipo QA | Conserva relaciones y campos | ☐ |
| FIN-03 | Buscar inventario QA | Stock final correcto | ☐ |
| FIN-04 | Buscar mantenimiento QA | Programación correcta | ☐ |
| FIN-05 | Buscar orden, ticket e informe QA | Documentos y firmas disponibles | ☐ |
| FIN-06 | Forzar sincronización y recargar | No aparecen duplicados ni datos antiguos | ☐ |
| FIN-07 | Confirmar recepción del correo QA | Mensaje y adjunto correctos | ☐ |

## 31. Criterio de aceptación del piloto

El sistema queda **aprobado para piloto controlado** cuando:

- no existen defectos críticos ni altos abiertos;
- autenticación, permisos y aislamiento están aprobados;
- los CRUD principales persisten después de sincronizar y recargar;
- PDF y correo funcionan en dispositivos reales;
- PWA supera instalación, offline y recuperación;
- menú móvil, último contenido y tema oscuro funcionan sin bloqueos;
- Safari iPhone y Chrome Android completan los flujos principales;
- los registros QA quedan disponibles para revisión del responsable.

Si existe un defecto medio, el responsable debe documentar su impacto, solución
temporal y fecha comprometida antes de aprobar el piloto.

## 32. Resumen de cierre

| Métrica | Total |
|---|---|
| Casos aprobados | |
| Aprobados con observación | |
| Fallidos | |
| No ejecutados | |
| Defectos críticos | |
| Defectos altos | |
| Defectos medios | |
| Defectos bajos | |

### Decisión

- ☐ Aprobado para piloto controlado
- ☐ Aprobado con observaciones
- ☐ Rechazado hasta corregir defectos

### Firmas

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| QA ejecutor | | | |
| Responsable del sistema | | | |
| Representante usuario | | | |

## 33. Documentos relacionados

- [Reporte QA de producción](./QA_PRODUCCION_2026-07-24.md)
- [Reporte QA funcional](./QA_FUNCIONAL_2026-07-26.md)
- [QA de accesibilidad](./QA_ACCESIBILIDAD.md)
- [Manual de usuarios](./MANUAL_USUARIOS.md)
- [Operación, respaldos y alertas](./OPERACION_RESPALDOS_Y_ALERTAS.md)
