# Reglas de negocio CMMS HVAC PRO

> Versión: `2026.05-offline-first-v3`
> Método estándar: `LOCAL_FIRST_SYNC_VERIFICATION`

Este documento estandariza el método de operación de CMMS HVAC PRO. Todo módulo que cree, edite, elimine, cierre o finalice datos operativos debe trabajar **offline-first**: guardar primero en IndexedDB/Dexie, encolar en `sync_queue`, sincronizar por `/api/sync` en Vercel y converger hacia Neon PostgreSQL.

## Regla de oro

```text
UI → Repositorio local → IndexedDB/Dexie → sync_queue → syncEngine → POST /api/sync → Vercel → Neon → serverChanges → IndexedDB/Zustand
```

Ningún botón sincronizable escribe directo a Neon desde el cliente. La única excepción son endpoints de soporte no CRUD, como OCR o autenticación.

## Pantallas y tablas canónicas

| Pantalla | Módulo | Tabla Neon | Regla aplicada |
| --- | --- | --- | --- |
| Equipos / Crear activo / Detalle equipo | Activos HVAC | `assets` | Crear/editar/borrar usa repositorio local, `sync_queue` y `/api/sync`. |
| Mantenimientos | Preventivos/correctivos | `preventive_maintenance` | Crear/editar/borrar usa JSONB, tombstone `deleted_at` y confirmación para bajas. |
| Tickets | Órdenes de trabajo | `work_orders` | Crear/cambiar estado/borrar dispara sincronización inmediata tras encolar. |
| Informes HVAC | Informes técnicos | `reports` | Borrador local; al finalizar se encola en `reports` y se sincroniza por `syncEngine`. |
| Órdenes de servicio | O.S. firmadas | `ordenes_servicio` | Borrador local; al finalizar se encola en `ordenes_servicio`. |
| Administración usuarios | Usuarios | `users` | Alta/baja se hace por repositorio local y sync offline-first. |
| Administración clientes | Clientes y sucursales | `clients`, `branches` | Alta de cliente y SUBs se guarda localmente y se encola. |
| Mapa | Georreferencia activos | `assets` | Lee activos locales; `lat`/`lng` deben venir de `assets`. |
| Planificación | Actividades | `events` | Debe leer/escribir eventos locales sincronizables. |
| Reportes | Analítica | lectura de `assets`, `work_orders`, `preventive_maintenance`, `reports` | No usa mocks para KPI productivo. |

## Workflow obligatorio por botón

1. Validar formulario, permiso y estado.
2. Deshabilitar botón con `isSaving`/`isSyncing` para evitar doble clic.
3. Crear o conservar `uuid_sync`.
4. Persistir localmente en la tabla Dexie del módulo.
5. Asignar `sync_status`: `pending_insert`, `pending_update` o `pending_delete`.
6. Encolar operación en `sync_queue` con `table`, `operation`, `uuid_sync`, `data` y `timestamp`.
7. Disparar `syncEngine.triggerSync()` si hay intención explícita del usuario.
8. Vercel ejecuta `ensureDatabaseSchema()` y `applySyncOperations()`.
9. Neon aplica upsert/tombstone idempotente.
10. El cliente procesa `results`, limpia solo `applied`/`noop`, aplica `serverChanges` y guarda `serverTime`.

## Reglas de bajas

- No usar `DELETE` físico en módulos sincronizados.
- Marcar `deleted_at` y `sync_status=pending_delete`.
- Ocultar de UI operativa, salvo auditoría.
- Pedir confirmación en botones destructivos.

## Checklist Vercel/Neon después del deploy

1. Confirmar variables en Vercel: `DATABASE_URL`, `JWT_SECRET`, y `GEMINI_API_KEY` si se usa OCR/IA.
2. Hacer redeploy del proyecto.
3. Ejecutar `POST /api/health/db` para crear/migrar tablas.
4. Ejecutar `GET /api/health/db` y verificar `missingTables: []`.
5. Confirmar en Neon que existan: `assets`, `users`, `preventive_maintenance`, `work_orders`, `reports`, `events`, `clients`, `branches`, `ordenes_servicio`.
6. Validar columnas nuevas en `assets`: `lat`, `lng`.
7. Probar flujo offline: crear activo, ticket, mantenimiento, informe y orden de servicio; reconectar; verificar filas en Neon.
