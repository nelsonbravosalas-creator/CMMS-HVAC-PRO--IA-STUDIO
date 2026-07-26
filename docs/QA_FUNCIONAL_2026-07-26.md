# QA funcional de producción — 26 de julio de 2026

## Alcance

Despliegue probado: `https://cmms-hvac-pro-ia-studio.vercel.app`.

Se utilizaron los seis perfiles iniciales y operaciones no destructivas. No se eliminaron registros ni se ejecutó el bootstrap administrativo.

## Resultados aprobados

- `/api/health`: HTTP 200.
- Acceso anónimo a usuarios: HTTP 401.
- Inicio de sesión correcto para administrador, supervisor, técnico, contratista, cliente y visita.
- Estado de sincronización: HTTP 200 para los seis perfiles.
- Administrador: lectura de clientes y usuarios autorizada.
- Supervisor: eliminación de clientes rechazada.
- Técnico y contratista: eliminación de órdenes y lectura de usuarios rechazadas.
- Cliente: creación de activos y eliminación de órdenes rechazadas.
- Visita: creación de activos y escritura de sincronización rechazadas.
- EECOL: una ficha activa y diez sucursales.
- Cliente con RUT inválido: HTTP 400 sin crear registros.
- Activo sin campos obligatorios: HTTP 400 sin crear registros.
- Envío de correo incompleto: HTTP 400 sin contactar al proveedor.
- Navegación del perfil cliente por Dashboard, equipos, inventario, órdenes, informes, tickets, reportes y eficiencia sin error crítico.
- Acceso directo de cliente y visita a administración muestra “Acceso Restringido”.

## Hallazgos corregidos

### Función administrativa

`/api/import-data` fallaba al inicializar con `ERR_MODULE_NOT_FOUND` porque los imports internos del bootstrap no incluían extensión ESM. Se añadieron las extensiones `.js` y una prueba de regresión.

### Inventario para perfiles de consulta

Cliente y visita veían controles para registrar, editar, eliminar o ajustar stock aunque el servidor rechazaba esas escrituras. Los controles ahora solo se muestran a administrador, supervisor, técnico y contratista.

### Consola y configuración

Cliente y visita podían abrir directamente la consola de eventos y la configuración. Ambas rutas y el acceso del menú quedaron restringidos al administrador.

## Automatización incorporada

La prueba se ejecuta con:

```powershell
$env:QA_DEMO_PIN='<PIN temporal>'
npm run test:functional:production
Remove-Item Env:QA_DEMO_PIN
```

La prueba no guarda el PIN ni modifica datos válidos. Las verificaciones destructivas usan identificadores inexistentes y deben responder antes de acceder a persistencia.

## Pendiente después del despliegue

Comprobado en el despliegue `2b8e864`:

- `npm run test:functional:production` aprobó la matriz completa.
- La importación administrativa devuelve 403 para los perfiles no autorizados.
- Visita no ve controles de edición de inventario y recibe acceso restringido al abrir la Consola.

Permanece pendiente:

- Completar PWA y Safari en dispositivos físicos.
- Probar conflicto real editando el mismo registro desde dos dispositivos.
- Ejecutar una prueba de volumen con el tamaño de datos esperado para el piloto.
