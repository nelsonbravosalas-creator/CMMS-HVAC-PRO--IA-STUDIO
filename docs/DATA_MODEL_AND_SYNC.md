# Modelo de datos y sincronizacion

## Tablas locales IndexedDB

| Tabla | Uso | Clave principal | Sincroniza |
|---|---|---|---|
| assets | Activos HVAC | uuid_sync | Si |
| work_orders | Tickets y ordenes de trabajo | uuid_sync | Si |
| preventive_maintenance | Mantenimientos | uuid_sync | Si |
| clients | Clientes | uuid_sync | Si |
| branches | Sucursales | uuid_sync | Si |
| users | Usuarios | uuid_sync | Si |
| reports | Informes tecnicos | uuid_sync | Si |
| events | Eventos | uuid_sync | Si |
| ordenes_servicio | Ordenes de servicio | uuid_sync | Si |
| sync_queue | Cola de sincronizacion | id incremental | Control |
| audit_logs | Auditoria local | id | Pendiente |

## Campos base obligatorios

Toda entidad sincronizable debe incluir:

| Campo | Uso |
|---|---|
| uuid_sync | Identificador universal local y remoto |
| updated_at | Timestamp de ultima modificacion |
| sync_status | Estado de sincronizacion |
| version | Version local del registro |
| retry_count | Numero de reintentos |
| last_synced_at | Ultima sincronizacion correcta |
| deleted_at | Baja logica si aplica |

## Estados de sincronizacion

```txt
synced
pending_insert
pending_update
pending_delete
failed
conflicted
```

## Reglas de escritura

- Crear: guardar local con pending_insert y encolar insert.
- Editar: guardar local con pending_update y encolar update.
- Borrar: marcar deleted_at, pending_delete y encolar delete.
- Sincronizar: enviar cola a API y retirar solo operaciones aceptadas.

## Contrato de API de sincronizacion

Endpoint:

```txt
POST /api/sync
```

Payload:

```txt
inserts
updates
deletes
lastSync
```

Respuesta esperada:

```txt
success
results
serverChanges
serverTime
```

## Politica de reproceso

Si el servidor responde error para una operacion:

1. No retirar de la cola.
2. Marcar registro como failed.
3. Incrementar retry_count.
4. Reintentar en el siguiente ciclo o al reconectar.
