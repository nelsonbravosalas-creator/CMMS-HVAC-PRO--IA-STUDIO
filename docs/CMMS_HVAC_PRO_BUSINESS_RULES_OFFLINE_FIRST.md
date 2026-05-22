# CMMS HVAC PRO — Reglas de negocio offline-first de nivel mundial

**Uso:** Documento Markdown para IA Studio.  
**Regla central:** Cliente -> Sucursal -> Activo -> Mantenimiento/Ticket/Informe/Orden de Servicio.

---

## 1. Regla madre offline-first

```text
UI -> Validación -> Dexie/IndexedDB -> sync_queue -> syncEngine -> POST /api/sync -> Vercel/Express -> Neon PostgreSQL -> serverChanges -> Dexie -> Zustand -> UI
```

| ID | Regla | Descripción |
|---|---|---|
| ARQ-01 | Local primero | Todo cambio se guarda primero en IndexedDB. |
| ARQ-02 | Cola obligatoria | Toda escritura sincronizable crea item en sync_queue. |
| ARQ-03 | No escritura directa | La UI no escribe directo en Neon. |
| ARQ-04 | Baja lógica | No DELETE físico; usar deleted_at. |
| ARQ-05 | Reintento | Error de sync conserva la operación en cola. |
| ARQ-06 | Convergencia | Otras terminales reciben cambios por serverChanges. |
| ARQ-07 | Auditoría | Acciones críticas deben registrar audit_logs. |

---

## 2. Jerarquía obligatoria

```text
Cliente -> Sucursal -> Activo -> Mantenimiento
Cliente -> Sucursal -> Activo -> Ticket
Cliente -> Sucursal -> Activo -> Informe
Cliente -> Sucursal -> Activo -> Orden de Servicio
```

| Entidad | Padre requerido | Campo | Regla |
|---|---|---|---|
| Cliente | Ninguno | clients.id | Puede existir solo. |
| Sucursal | Cliente | branches.cliente_id | No se crea sin cliente activo. |
| Tipo activo | Catálogo | catalog_asset_types.codigo | Requerido para TAG. |
| Activo | Cliente + Sucursal + Tipo | assets.cliente_id/sucursal_id/tipo | No se crea sin los tres. |
| Mantenimiento | Activo | preventive_maintenance.equipo_tag | No se crea sin activo vigente. |
| Ticket | Activo si es falla | work_orders.equipo_tag | Correctivo requiere activo. |
| Informe | Cliente/Activo | reports.data | Finalización requiere contexto. |
| O.S. | Cliente/Activo | ordenes_servicio.data | Finalización requiere contexto. |

---

## 3. Tabla de verdad: creación de activo

| Cliente activo | Sucursal activa | Tipo activo | TAG válido | Crear activo | Resultado |
|---|---|---|---|---|---|
| No | N/A | N/A | N/A | No | Bloquear: crear cliente. |
| Sí | No | N/A | N/A | No | Bloquear: crear sucursal. |
| Sí | Sí | No | N/A | No | Bloquear: crear tipo. |
| Sí | Sí | Sí | No | No | Corregir TAG. |
| Sí | Sí | Sí | Sí | Sí | Guardar assets + sync_queue. |

---

## 4. TAG y QR

**Fórmula:** `TAG = CODIGO_SUCURSAL + "." + CODIGO_TIPO + "." + CORRELATIVO_3_DIGITOS`

Ejemplo: `21-STK.AC.001`

| Segmento | Fuente | Regla |
|---|---|---|
| CODIGO_SUCURSAL | branches.codigo | Debe existir y estar activo. |
| CODIGO_TIPO | catalog_asset_types.codigo | Debe existir y estar activo. |
| CORRELATIVO | Generador TAG | Siempre 3 dígitos. |

```text
Seleccionar cliente -> seleccionar sucursal -> seleccionar tipo -> construir TAG -> validar duplicidad -> guardar activo local -> encolar sync
```

---

## 5. Tablas principales

### clients

| Campo | Regla |
|---|---|
| uuid_sync | Identificador de sincronización. |
| id | Identificador funcional. |
| nombre | Obligatorio. |
| activo | Debe ser true para operar. |
| deleted_at | Baja lógica. |
| sync_status | Estado local. |

### branches

| Campo | Regla |
|---|---|
| uuid_sync | Identificador sync. |
| id | Identificador sucursal. |
| cliente_id | Debe existir en clients. |
| codigo | Segmento TAG obligatorio. |
| activo | Requerido para crear activos. |
| deleted_at | Baja lógica. |

### catalog_asset_types

| Campo | Regla |
|---|---|
| uuid_sync | Identificador sync. |
| codigo | Segmento tipo del TAG. |
| descripcion | Nombre técnico. |
| activo | Debe estar activo para usarse. |

### assets

| Campo | Regla |
|---|---|
| uuid_sync | Identificador sync. |
| tag | Único, identifica activo físico. |
| nombre | Obligatorio. |
| tipo | Debe existir en catálogo. |
| cliente_id | Obligatorio. |
| sucursal_id | Obligatorio. |
| estado | operativo/falla/mantenimiento/baja. |
| updated_at | Control de sincronización. |
| deleted_at | Baja lógica. |
| sync_status | Estado local. |

### work_orders

| Campo | Regla |
|---|---|
| uuid_sync | Identificador sync. |
| id | Folio. |
| titulo | Obligatorio. |
| prioridad | Obligatoria. |
| estado | abierto/asignado/en_proceso/resuelto/cerrado/cancelado. |
| equipo_tag | Obligatorio si es falla de equipo. |
| cliente_id | Cliente afectado. |

### preventive_maintenance

| Campo | Regla |
|---|---|
| uuid_sync | Identificador sync. |
| id | Folio. |
| equipo_tag | Debe existir en assets. |
| tecnico | Obligatorio. |
| fecha | Obligatoria. |
| estado | programado/en_proceso/ejecutado/vencido/cancelado/observado. |
| hallazgos | Recomendado. |
| acciones | Obligatorio al finalizar. |

### reports

| Campo | Regla |
|---|---|
| uuid_sync | Identificador sync. |
| id | Folio. |
| data | Documento completo. |
| data.status | borrador/firmado/bloqueado/anulado. |

### ordenes_servicio

| Campo | Regla |
|---|---|
| uuid_sync | Identificador sync. |
| id | Folio. |
| estado | borrador/firmada/enviada/anulada. |
| draft_key | Debe ser por documento. |
| data | Documento completo. |

### sync_queue

| Campo | Regla |
|---|---|
| id | Autoincrement. |
| table | Tabla destino. |
| uuid_sync | Registro afectado. |
| operation | insert/update/delete. |
| data | Payload. |
| retry_count | Reintentos. |
| last_error | Último error. |
| next_retry_at | Backoff. |

---

## 6. Estados normalizados

| Módulo | Estados |
|---|---|
| Activos | operativo, falla, mantenimiento, baja |
| Tickets | abierto, asignado, en_proceso, resuelto, cerrado, cancelado |
| Mantenimiento | programado, en_proceso, ejecutado, vencido, cancelado, observado |
| Informes | borrador, firmado, bloqueado, anulado |
| O.S. | borrador, firmada, enviada, anulada |
| Sync | synced, pending_insert, pending_update, pending_delete, failed, conflicted |

---

## 7. Workflows

### Crear cliente
```text
Validar datos -> guardar clients local -> sync_status pending_insert -> sync_queue insert -> syncEngine -> Neon -> serverChanges
```

### Crear sucursal
```text
Validar cliente activo -> validar código -> guardar branches -> sync_queue insert -> sincronizar
```

### Crear activo
```text
Validar cliente -> validar sucursal -> validar tipo -> generar TAG -> validar duplicidad -> guardar assets -> sync_queue insert -> sincronizar
```

### Crear mantenimiento
```text
Validar activo vigente -> capturar técnico/fecha/hallazgos/acciones -> guardar preventive_maintenance -> sync_queue insert -> sincronizar
```

### Dar baja activo
```text
Validar permisos -> advertir dependencias -> confirmar -> estado=baja -> deleted_at -> sync_queue delete -> serverChanges tombstone
```

### Sincronizar
```text
Leer sync_queue -> filtrar retry -> agrupar operaciones -> POST /api/sync -> procesar results -> aplicar serverChanges -> hydrate
```

---

## 8. Reglas por pantalla

| Pantalla | Objetivo | Tablas | Reglas |
|---|---|---|---|
| Login | Acceso | users | Usuario activo y rol válido. |
| ClientSelector | Seleccionar cliente | clients | Requerido antes de operaciones con activos. |
| Dashboard | KPIs | assets/work_orders/preventive_maintenance/sync_queue | Excluir deleted_at. |
| Equipos | Inventario | assets/clients/branches/catalog_asset_types | No crear activo sin cliente/sucursal/tipo. |
| DetalleEquipo | Ficha técnica | assets/work_orders/preventive_maintenance/reports | Acciones solo si activo vigente. |
| ScannerQR | Leer TAG | assets | Buscar local primero. |
| Mantenimientos | Servicios | preventive_maintenance/assets | No crear sin activo. |
| Tickets | Falla/OT | work_orders/assets | Correctivo requiere equipo_tag. |
| Informes | Documentos | reports/assets | Finalizar requiere contexto. |
| O.S. | Servicio | ordenes_servicio | Finalizar requiere cliente y trabajo. |
| Administración | Maestros | users/clients/branches/catalog_asset_types | Solo roles autorizados. |
| Configuración | Sistema | settings/API | No exponer secretos. |

---

## 9. Botones críticos

| Botón | Flujo | Resultado |
|---|---|---|
| Crear | validar -> Dexie -> sync_queue | pending_insert |
| Guardar | validar -> update local -> sync_queue | pending_update |
| Borrar | confirmar -> deleted_at -> sync_queue | pending_delete |
| Finalizar | validar -> estado final -> sync_queue | documento cerrado |
| Sincronizar | fullSync -> /api/sync | cola procesada |
| Exportar | render -> archivo | no modifica BD |
| Imprimir | print | no modifica BD |
| Escanear | cámara -> TAG -> búsqueda local | ficha o creación |

---

## 10. Operación móvil offline-first

```text
Técnico abre app -> hydrate Dexie -> escanea QR -> trabaja offline -> guarda registros -> sync_queue pending -> reconecta -> syncEngine -> Neon -> supervisor ve cambios
```

| Operación | Offline | Online |
|---|---|---|
| Ver activos descargados | Sí | Sí |
| Escanear QR local | Sí | Sí |
| Crear activo | Sí, si hay cliente/sucursal local | Sí |
| Crear mantenimiento | Sí | Sí |
| Crear ticket | Sí | Sí |
| Finalizar informe | Sí | Sí |
| Sincronizar | No | Sí |

---

## 11. Operación escritorio online

```text
Supervisor abre app -> hydrate Dexie -> syncEngine trae serverChanges -> revisa dashboard -> asigna trabajos -> exporta reportes
```

---

## 12. KPI CMMS

| KPI | Fórmula | Fuente |
|---|---|---|
| Disponibilidad | (horas_operacion - horas_fuera_servicio) / horas_operacion | assets + work_orders |
| MTTR | promedio cierre - creación de correctivos | work_orders |
| MTBF | promedio entre fallas por activo | work_orders |
| Cumplimiento PM | PM ejecutados / PM programados | preventive_maintenance |
| Backlog | trabajos abiertos/vencidos | work_orders |
| Reincidencia | fallas repetidas por activo | work_orders |

---

## 13. Auditoría

| Acción | Nivel |
|---|---|
| Crear cliente | Alto |
| Crear sucursal | Alto |
| Crear activo | Alto |
| Editar activo | Alto |
| Dar baja activo | Crítico |
| Cambiar estado ticket | Alto |
| Finalizar mantenimiento | Alto |
| Finalizar informe | Alto |
| Finalizar O.S. | Alto |
| Reset local | Crítico |

---

## 14. Contrato esperado de /api/sync

### Request
```json
{
  "clientId": "terminal-uuid",
  "lastSync": 1779410000000,
  "inserts": [],
  "updates": [],
  "deletes": []
}
```

### Response
```json
{
  "success": true,
  "serverTime": 1779410005000,
  "results": {
    "inserts": [],
    "updates": [],
    "deletes": []
  },
  "serverChanges": {}
}
```

---

## 15. Criterios de aceptación

| ID | Criterio |
|---|---|
| CA-01 | No se puede crear activo sin cliente. |
| CA-02 | No se puede crear activo sin sucursal. |
| CA-03 | No se puede crear mantenimiento sin activo. |
| CA-04 | Todo cambio se guarda localmente primero. |
| CA-05 | Todo cambio sincronizable crea sync_queue. |
| CA-06 | Las bajas usan deleted_at. |
| CA-07 | Las otras terminales reciben serverChanges. |
| CA-08 | Los errores de sync no se pierden. |
| CA-09 | Los documentos firmados no se editan directamente. |
| CA-10 | Los KPIs excluyen deleted_at salvo historial. |

---

## 16. Pruebas obligatorias

### Jerarquía
```text
Intentar crear activo sin cliente -> bloquear
Crear cliente -> crear sucursal -> crear tipo -> crear activo -> permitir
```

### Offline móvil
```text
Desconectar red -> crear mantenimiento -> verificar sync_queue -> reconectar -> verificar Neon
```

### Dos terminales
```text
Terminal A crea activo -> sync
Terminal B sincroniza -> recibe activo
Terminal B edita -> sync
Terminal A sincroniza -> recibe edición
Terminal A da baja -> sync
Terminal B sincroniza -> oculta activo
```

### Conflicto TAG
```text
Terminal A crea TAG X offline
Terminal B crea TAG X offline
Ambas sincronizan -> una aplicada y otra conflict
```

---

## 17. Reglas de rechazo automático para IA Studio

IA Studio debe marcar como defecto cualquier código que:

- cree activo sin cliente;
- cree activo sin sucursal;
- cree mantenimiento sin activo;
- escriba directo a Neon desde UI;
- borre físicamente registros sincronizados;
- elimine operaciones fallidas de sync_queue;
- ignore deleted_at;
- permita doble click en finalización;
- edite informes firmados sin versionado;
- use credenciales hardcodeadas.

---

## 18. Definición de CMMS offline-first correcto

```text
Cliente existe
    -> Sucursal existe
        -> Activo existe con TAG único
            -> Se puede escanear QR
            -> Se puede crear ticket
            -> Se puede crear mantenimiento
            -> Se puede crear informe
            -> Se puede crear orden de servicio
            -> Todo funciona offline
            -> Todo se sincroniza a Neon
            -> Otras terminales reciben cambios
            -> Las bajas se propagan como tombstones
            -> Los errores se reintentan
            -> La auditoría conserva trazabilidad
```

# Fin del documento
