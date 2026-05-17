# Reglas de negocio normalizadas

## Estados normalizados

### Activos

```txt
operativo
falla
mantenimiento
baja
```

### Tickets

```txt
abierto
asignado
en_proceso
resuelto
cerrado
cancelado
```

### Mantenimientos

```txt
programado
en_proceso
ejecutado
vencido
cancelado
observado
```

### Informes

```txt
borrador
firmado
bloqueado
anulado
```

### Ordenes de servicio

```txt
borrador
firmada
enviada
anulada
```

## Reglas por modulo

### Activos

- El TAG debe ser unico.
- Formato recomendado: SUCURSAL.TIPO.CORRELATIVO.
- Todo activo debe tener nombre, estado y uuid_sync.
- La baja debe ser logica, usando estado baja y deleted_at.

### Tickets

- Todo ticket debe tener titulo, prioridad, estado y equipo asociado si corresponde.
- Los cambios de estado se guardan localmente y se sincronizan.
- El cierre del ticket debe registrar fecha y usuario cuando exista auditoria.

### Mantenimientos

- Todo mantenimiento debe tener equipo, tecnico, tipo, fecha y estado.
- Al finalizar mantenimiento se debe evaluar si corresponde actualizar el proximo mantenimiento del activo.
- La cancelacion debe ser logica.

### Clientes y sucursales

- Un cliente puede tener multiples sucursales.
- Toda sucursal debe tener cliente_id.
- Si se crea un cliente con sucursales, ambas entidades deben encolarse para sincronizacion.

### Informes

- El informe puede existir como borrador local.
- Al finalizar debe generar folio y cambiar a firmado.
- El informe firmado no debe editarse sin crear una nueva version.

### Ordenes de servicio

- La orden puede existir como borrador.
- Al finalizar debe cambiar a firmada.
- Debe conservar checklist, hallazgos, galeria y firmas cuando aplique.

## Reglas de seguridad

- No guardar credenciales reales en el repositorio.
- Las variables de entorno se configuran en el proveedor de despliegue.
- Los endpoints de escritura deben validar rol o sesion.

## Reglas de auditoria

Toda accion critica debe registrar:

- usuario,
- modulo,
- accion,
- uuid_sync,
- timestamp,
- resultado.

Acciones criticas:

- crear activo,
- editar activo,
- borrar activo,
- crear ticket,
- cambiar estado de ticket,
- finalizar informe,
- finalizar orden de servicio,
- crear usuario,
- desactivar usuario,
- reset local.
