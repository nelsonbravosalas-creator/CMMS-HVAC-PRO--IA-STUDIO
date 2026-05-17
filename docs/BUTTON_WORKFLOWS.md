# Workflows de botones

## Regla general para botones criticos

Todo boton que guarde, cree, edite, finalice, borre o sincronice debe:

1. Bloquearse al primer click.
2. Mostrar estado de carga.
3. Validar datos obligatorios.
4. Guardar localmente si corresponde.
5. Encolar sincronizacion si modifica datos sincronizables.
6. Mostrar resultado al usuario.
7. Evitar doble envio.
8. Registrar auditoria cuando aplique.

## Crear registro

```txt
Click Crear
-> Validar formulario
-> Crear uuid_sync
-> Guardar en Dexie
-> sync_status = pending_insert
-> Encolar insert
-> Disparar syncEngine
-> Si hay conexion, POST /api/sync
-> Si servidor acepta, marcar synced
-> Si falla, marcar failed y mantener cola
```

## Editar registro

```txt
Click Guardar cambios
-> Validar cambios
-> Actualizar updated_at
-> Guardar en Dexie
-> sync_status = pending_update
-> Encolar update
-> Disparar syncEngine
-> Reconciliar respuesta remota
```

## Borrar o anular registro

```txt
Click Borrar
-> Confirmar impacto
-> Set deleted_at
-> sync_status = pending_delete
-> Encolar delete
-> Ocultar de la vista local
-> Sincronizar baja logica
```

## Finalizar informe u orden de servicio

```txt
Click Finalizar
-> Validar datos minimos
-> Generar folio o id
-> Cambiar status a firmado
-> Guardar local
-> Encolar sincronizacion
-> Eliminar borrador local
-> Navegar a listado o mostrar confirmacion
```

## Sincronizar manualmente

```txt
Click Sincronizar
-> Leer sync_queue
-> Agrupar inserts, updates, deletes
-> POST /api/sync
-> Procesar results
-> Retirar operaciones applied/noop
-> Mantener operaciones con error
-> Aplicar serverChanges
-> Hidratar store local
```
