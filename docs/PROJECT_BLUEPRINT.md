# CMMS HVAC PRO - Project Blueprint

## Objetivo del producto

Construir una aplicacion CMMS HVAC PRO offline-first para administrar activos HVAC, tickets, mantenimientos preventivos y correctivos, clientes, sucursales, usuarios, informes tecnicos y ordenes de servicio.

La aplicacion debe permitir trabajo en terreno aun sin conexion. Las operaciones de escritura deben quedar persistidas primero en base local y luego sincronizarse con la base central cuando exista conexion.

## Stack tecnico

| Capa | Tecnologia |
|---|---|
| Frontend | React + TypeScript |
| Build | Vite |
| UI | Tailwind CSS |
| Estado global | Zustand |
| Base local | IndexedDB con Dexie |
| Backend | Vercel Serverless Functions |
| Base remota | Neon PostgreSQL |
| Cliente DB | @neondatabase/serverless |
| QR | @yudiel/react-qr-scanner, html-to-image |
| Exportacion | jsPDF, XLSX |

## Estructura esperada

```txt
src/pages
src/components
src/components/modals
src/hooks
src/repositories
src/sync
src/store
src/db
src/domain
src/context
src/lib
api
docs
```

## Flujo general de escritura

```txt
UI -> Validacion -> Dexie -> Repositorio local -> Cola de sincronizacion -> Motor de sincronizacion -> API Vercel -> Neon
```

## Modulos minimos

1. Dashboard operativo.
2. Activos HVAC.
3. Detalle de equipo.
4. Scanner QR.
5. Tickets.
6. Mantenimientos.
7. Clientes y sucursales.
8. Usuarios y perfiles.
9. Informes tecnicos.
10. Ordenes de servicio.
11. Configuracion.
12. Reportes.

## Criterios de aceptacion

1. La aplicacion compila correctamente.
2. El usuario puede trabajar sin conexion.
3. Las escrituras se guardan primero localmente.
4. La cola de sincronizacion conserva operaciones pendientes.
5. La API remota aplica cambios de forma idempotente.
6. Las bajas son logicas y conservan trazabilidad.
7. No se guardan credenciales reales en el repositorio.
