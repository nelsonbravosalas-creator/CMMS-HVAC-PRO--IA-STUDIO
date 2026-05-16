# Reglas de negocio CMMS HVAC PRO

> Versión: `2026.05-offline-first-v2`  
> Método estándar: `LOCAL_FIRST_SYNC_VERIFICATION`

Este documento estandariza el método de operación de la aplicación CMMS HVAC PRO para que cualquier módulo, botón, formulario o workflow nuevo respete el modelo **offline-first** y la comunicación controlada entre **cliente local**, **Vercel** y **Neon PostgreSQL**.

## 1. Objetivo

Garantizar que la aplicación pueda operar sin conexión, registrar trabajo en terreno y converger posteriormente con Neon sin pérdida de datos, duplicidad funcional ni escrituras directas desde el cliente a la base de datos.

## 2. Alcance

Aplica a:

- Activos HVAC.
- Órdenes de trabajo.
- Mantenimiento preventivo.
- Clientes.
- Sucursales.
- Usuarios.
- Informes.
- Eventos.
- Nuevos módulos que se agreguen a futuro.

## 3. Método estándar

Todo flujo funcional debe seguir la secuencia:

1. **Capturar intención**: identificar si la acción es crear, editar, eliminar, sincronizar o consultar.
2. **Validar reglas de negocio**: campos requeridos, permisos, estado actual y consistencia del formulario.
3. **Persistir local primero**: guardar en IndexedDB/Dexie con `uuid_sync`, `updated_at` y `sync_status`.
4. **Encolar operación**: insertar o actualizar una entrada en `sync_queue` con `table`, `operation`, `data` y `uuid_sync`.
5. **Enviar a Vercel**: ejecutar `POST /api/sync` cuando exista conexión o al presionar sincronizar.
6. **Aplicar en Neon**: Vercel valida entorno, asegura schema y aplica operación idempotente.
7. **Traer cambios remotos**: Vercel devuelve `serverChanges` por tabla y `serverTime`.
8. **Reconciliar estado local**: aplicar cambios remotos, resolver tombstones y limpiar cola solo si la operación fue aceptada.
9. **Auditar/notificar**: mostrar estado pendiente, sincronizado o fallido.

## 4. Regla de oro offline-first

Ningún botón o formulario sincronizable debe escribir directo a Neon desde el cliente.

La ruta obligatoria es:

```text
UI → Repositorio local → IndexedDB → sync_queue → /api/sync en Vercel → Neon → serverChanges → IndexedDB/Zustand
```

## 5. Recursos implicados

| Recurso | Responsabilidad |
| --- | --- |
| IndexedDB / Dexie | Persistencia local, lectura offline, cola de cambios. |
| Zustand | Estado visible para la UI, hidratado desde repositorios locales. |
| `syncQueue` | Dedupe y orden de operaciones pendientes. |
| `syncEngine` | Push/pull, retry, reconciliación y actualización de `last_sync_timestamp`. |
| Vercel Functions | Validación de entorno, schema, endpoints `/api/sync` y `/api/health/db`. |
| Neon PostgreSQL | Persistencia central con `uuid_sync`, `updated_at`, `created_at`, `deleted_at`. |

## 6. Flujo Vercel ⇄ Neon

```text
Cliente
  ├─ lee/escribe IndexedDB
  ├─ encola operación
  └─ POST /api/sync
        └─ Vercel
            ├─ valida DATABASE_URL/JWT_SECRET
            ├─ ensureDatabaseSchema()
            ├─ applySyncOperations()
            ├─ INSERT/UPDATE/tombstone en Neon
            └─ retorna results + serverChanges + serverTime
```

## 7. Contrato de sincronización

### Request

```json
{
  "inserts": [],
  "updates": [],
  "deletes": [],
  "lastSync": 0
}
```

Cada operación debe incluir:

- `table`
- `uuid_sync`
- `operation`
- `data`
- `updated_at`

### Response

```json
{
  "success": true,
  "results": {
    "inserts": [],
    "updates": [],
    "deletes": []
  },
  "serverChanges": {},
  "serverTime": 0
}
```

Solo resultados `applied` o `noop` permiten retirar una operación de `sync_queue`.

## 8. Reglas por botón

| Botón | Workflow estándar | Condición UI |
| --- | --- | --- |
| Crear | Validar → crear `uuid_sync` → guardar `pending_insert` → encolar `insert` → sync | Opera offline y muestra guardado local. |
| Editar | Validar → actualizar `updated_at` → guardar `pending_update` → encolar `update` → sync | Opera offline; conflicto por mayor `updated_at`. |
| Eliminar / Dar de baja | Confirmar → set `deleted_at` → guardar `pending_delete` → encolar `delete` → sync | Requiere confirmación y usa tombstone. |
| Sincronizar | Leer cola → POST `/api/sync` → procesar resultados → aplicar cambios → guardar checkpoint | Deshabilitado mientras `syncing=true`. |
| Ver | Leer store local/IndexedDB → mostrar estado sync | No depende de Neon en tiempo real. |

## 9. Reglas por módulo

| Módulo | Tabla | Identificador negocio | Campos mínimos |
| --- | --- | --- | --- |
| Activos HVAC | `assets` | `tag` | `tag`, `nombre`, `estado` |
| Órdenes de trabajo | `work_orders` | `id` | `titulo`, `prioridad`, `estado`, `equipo_tag` |
| Mantenimiento preventivo | `preventive_maintenance` | `id` | `equipo_tag`, `tecnico`, `tipo`, `fecha`, `estado` |
| Clientes | `clients` | `id` | `nombre` |
| Sucursales | `branches` | `id` | `nombre`, `cliente_id` |
| Usuarios | `users` | `id` | `nombre`, `perfil`, `pin`, `activo` |
| Informes | `reports` | `id` | `id`, `data` |
| Eventos | `events` | `id` | `id`, `data` |

## 10. Reglas de bajas

- No usar borrado físico en módulos sincronizados.
- Usar `deleted_at` como tombstone.
- La UI debe ocultar o marcar registros con tombstone según el contexto.
- La cola local solo se limpia cuando Vercel responde `applied` o `noop`.

## 11. Reglas de despliegue Vercel

Antes de redeploy:

- Configurar `DATABASE_URL`.
- Configurar `JWT_SECRET`.
- Configurar `GEMINI_API_KEY` si se usa OCR/IA.

Después del redeploy:

1. Ejecutar `POST /api/health/db`.
2. Validar `GET /api/health/db`.
3. Verificar que `missingTables` esté vacío.
4. Probar crear/editar/baja offline y sincronizar.

## 12. Checklist para nuevos módulos

- [ ] Declarar módulo en `MODULE_RULES`.
- [ ] Definir campos requeridos.
- [ ] Definir botones desde `BUTTON_WORKFLOW_RULES`.
- [ ] Usar repositorio local para escritura.
- [ ] Encolar operación con `syncQueue`.
- [ ] Integrar con `/api/sync`.
- [ ] Respetar `deleted_at` para bajas.
- [ ] Mostrar `sync_status` en UI.
- [ ] Documentar permisos en `ROLE_RULES`.
