# CMMS HVAC PRO - Reglas de negocio offline-first de nivel mundial

**Version:** 2026-05-22  
**Aplicacion:** CMMS HVAC PRO  
**Destino:** Documento fuente para IA Studio y para el equipo de desarrollo.  
**Arquitectura objetivo:** React + TypeScript + Dexie/IndexedDB + sync_queue + syncEngine + Vercel/Express + Neon PostgreSQL.  

---

## 0. Objetivo general

Definir las reglas de negocio, funcionamiento, operacion, sincronizacion y control de datos para una aplicacion **CMMS offline-first** orientada a mantenimiento HVAC y gestion tecnica de activos.

El documento debe ser usado por IA Studio como fuente de verdad para construir, validar o corregir pantallas, botones, tablas, workflows y reglas de sincronizacion.

La aplicacion debe funcionar en dos modalidades:

| Modalidad | Uso principal | Regla |
|---|---|---|
| Celular / tecnico en terreno | Operacion offline-first, QR, mantenimiento, ticket, informe, fotos y firmas | Siempre guardar primero localmente. |
| Escritorio / supervisor | Administracion, dashboard, reportes, asignaciones y revision de sincronizacion | Tambien usa flujo offline-first, aunque opere online. |

---

## 1. Regla madre offline-first

Toda escritura funcional debe seguir este flujo obligatorio:

```text
UI / Boton / Formulario
    -> Validacion de reglas de negocio
    -> Hook o servicio de dominio
    -> Repositorio local
    -> Dexie / IndexedDB
    -> sync_queue
    -> syncEngine
    -> POST /api/sync
    -> Backend Vercel / Express
    -> Neon PostgreSQL
    -> serverChanges
    -> Dexie local
    -> Zustand hydrate
    -> UI actualizada
```

| ID | Regla | Descripcion | Resultado esperado |
|---|---|---|---|
| ARQ-01 | Local primero | Todo cambio se guarda primero en Dexie/IndexedDB. | La app funciona offline. |
| ARQ-02 | Cola obligatoria | Toda escritura sincronizable crea o actualiza `sync_queue`. | No se pierde informacion. |
| ARQ-03 | Sin escritura directa | La UI no escribe directo en Neon para operaciones normales. | Integridad offline-first. |
| ARQ-04 | Endpoint unico | La sincronizacion oficial usa `POST /api/sync`. | Flujo uniforme. |
| ARQ-05 | Baja logica | No se debe hacer DELETE fisico en tablas sincronizadas. | Se conserva historial. |
| ARQ-06 | Reintentos | Error de sync conserva la operacion en cola. | Reproceso seguro. |
| ARQ-07 | Convergencia | Todas las terminales reciben cambios por `serverChanges`. | Datos consistentes. |
| ARQ-08 | Tiempo servidor | `lastSync` debe basarse en `serverTime`. | Evita desfase de reloj. |
| ARQ-09 | Auditoria | Acciones criticas registran `audit_logs`. | Trazabilidad. |
| ARQ-10 | Botones seguros | Bloquear doble click en acciones criticas. | No duplica registros. |

---

## 2. Regla jerarquica central

La jerarquia obligatoria de datos es:

```text
Cliente -> Sucursal / Almacen / Proyecto -> Activo -> Mantenimiento
Cliente -> Sucursal / Almacen / Proyecto -> Activo -> Ticket / Work Order
Cliente -> Sucursal / Almacen / Proyecto -> Activo -> Informe tecnico
Cliente -> Sucursal / Almacen / Proyecto -> Activo -> Orden de Servicio
```

### Regla critica

**No se puede crear un activo si no existe un cliente activo y una sucursal activa asociada al cliente.**

### Ejemplo funcional

```text
Cliente: Empresa ABC
    -> Sucursal: Planta Norte
        -> Activo: 21-STK.AC.001
            -> Mantenimiento preventivo
            -> Ticket correctivo
            -> Informe tecnico
            -> Orden de servicio
```

| Entidad | Padre requerido | Campo de relacion | Puede existir sin padre | Accion si falta padre |
|---|---|---|---|---|
| Cliente | Ninguno | No aplica | Si | Crear cliente. |
| Sucursal | Cliente | `branches.cliente_id` | No | Bloquear creacion. |
| Tipo de activo | Catalogo | `catalog_asset_types.codigo` | Si | Crear catalogo. |
| Activo | Cliente + Sucursal + Tipo | `assets.cliente_id`, `assets.sucursal_id`, `assets.tipo` | No | Bloquear creacion. |
| Mantenimiento | Activo | `preventive_maintenance.equipo_tag` | No | Bloquear creacion. |
| Ticket | Activo si es falla de equipo | `work_orders.equipo_tag` | Parcial | Permitir solo ticket general si se define. |
| Informe | Cliente o activo | `reports.data` | Parcial | Permitir borrador, no finalizar. |
| Orden de servicio | Cliente y/o activo | `ordenes_servicio.data` | Parcial | Permitir borrador, no finalizar. |

---

## 3. Reglas de datos maestros

Los datos maestros son la base operacional del CMMS. Deben existir antes de registrar la operacion tecnica.

| Maestro | Tabla | Obligatorio para | Regla operacional |
|---|---|---|---|
| Cliente | `clients` | Sucursales, activos, informes, O.S. | Debe estar activo y no tener `deleted_at`. |
| Sucursal | `branches` | Activos | Debe pertenecer a cliente activo. |
| Tipo de activo | `catalog_asset_types` | TAG y activos | Debe tener codigo unico y activo. |
| Usuario | `users` | Auditoria, permisos y asignaciones | Debe tener rol y estar activo. |
| Configuracion | `settings` | Parametros de app | Key unica. |

### Workflow: crear cliente

```text
Ingresar datos cliente
    -> Validar nombre obligatorio
    -> Validar duplicidad local
    -> Guardar en clients local
    -> sync_status = pending_insert
    -> sync_queue insert
    -> Sincronizar con Neon
```

### Workflow: crear sucursal

```text
Seleccionar cliente activo
    -> Ingresar nombre y codigo de sucursal
    -> Validar codigo obligatorio para TAG
    -> Guardar en branches local
    -> sync_queue insert
    -> Sincronizar
```

### Workflow: crear tipo de activo

```text
Ingresar codigo y descripcion
    -> Validar codigo unico
    -> Guardar en catalog_asset_types
    -> sync_queue insert
    -> Sincronizar
```

---

## 4. Reglas de TAG y QR

El TAG es el identificador fisico operacional del activo. El QR debe transportar el TAG o una URL con el TAG.

### Formula oficial

```text
TAG = CODIGO_SUCURSAL + "." + CODIGO_TIPO + "." + CORRELATIVO_3_DIGITOS
```

Ejemplo:

```text
21-STK.AC.001
```

| Segmento | Fuente | Ejemplo | Regla |
|---|---|---|---|
| CODIGO_SUCURSAL | `branches.codigo` | 21-STK | Debe existir, estar activo y pertenecer al cliente. |
| CODIGO_TIPO | `catalog_asset_types.codigo` | AC | Debe existir y estar activo. |
| CORRELATIVO | Generador TAG | 001 | Siempre tres digitos. |

### Reglas TAG

| ID | Regla |
|---|---|
| TAG-01 | `assets.tag` debe ser unico local y remoto. |
| TAG-02 | No crear TAG si no existe cliente. |
| TAG-03 | No crear TAG si no existe sucursal. |
| TAG-04 | No crear TAG si no existe tipo de activo. |
| TAG-05 | El QR no debe guardar todo el activo; solo TAG o URL `?tag=TAG`. |
| TAG-06 | `uuid_sync` no reemplaza al TAG. |
| TAG-07 | El TAG no debe editarse sin auditoria. |
| TAG-08 | Si un TAG escaneado no existe, ofrecer crear activo solo si hay cliente y sucursal. |
| TAG-09 | Si dos terminales crean el mismo TAG offline, el servidor debe generar conflicto. |
| TAG-10 | Un activo dado de baja conserva su TAG como historico. |

### Workflow: generar TAG

```text
Seleccionar cliente
    -> Seleccionar sucursal asociada al cliente
    -> Seleccionar tipo de activo
    -> Ingresar o sugerir correlativo
    -> Construir TAG
    -> Validar formato
    -> Validar duplicidad local
    -> Si hay red, validar duplicidad remota
    -> Previsualizar etiqueta QR
    -> Guardar activo local
    -> Encolar sincronizacion
```

---

## 5. Modelo completo de tablas

### 5.1 `clients`

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `uuid_sync` | string | Si | Identificador universal de sincronizacion. |
| `id` | string | Si | Identificador funcional. |
| `nombre` | string | Si | Nombre cliente. |
| `rut` | string | No | Identificacion tributaria. |
| `empresa` | string | No | Razon social o grupo. |
| `email` | string | No | Contacto. |
| `telefono` | string | No | Contacto. |
| `direccion` | string | No | Direccion. |
| `activo` | boolean | Si | Debe ser true para operar. |
| `updated_at` | number | Si | Control sync. |
| `deleted_at` | number/null | No | Baja logica. |
| `sync_status` | enum | Si | Estado local. |

### 5.2 `branches`

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `uuid_sync` | string | Si | Identificador sync. |
| `id` | string | Si | ID sucursal. |
| `cliente_id` | string | Si | Debe existir en `clients`. |
| `codigo` | string | Si | Segmento TAG. |
| `nombre` | string | Si | Nombre visible. |
| `direccion` | string | No | Ubicacion. |
| `ciudad` | string | No | Ciudad. |
| `region` | string | No | Region. |
| `activo` | boolean | Si | Debe estar activo para crear activos. |
| `updated_at` | number | Si | Control sync. |
| `deleted_at` | number/null | No | Baja logica. |

### 5.3 `catalog_asset_types`

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `uuid_sync` | string | Si | Identificador sync. |
| `codigo` | string | Si | Segmento tipo del TAG. |
| `descripcion` | string | Si | Descripcion tecnica. |
| `activo` | boolean | Si | Debe estar activo para usarse. |
| `updated_at` | number | Si | Control sync. |
| `deleted_at` | number/null | No | Baja logica. |

### 5.4 `assets`

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `uuid_sync` | string | Si | Identificador sync. |
| `tag` | string | Si | Unico, identifica activo fisico. |
| `nombre` | string | Si | Descripcion visible. |
| `tipo` | string | Si | Debe existir en catalogo. |
| `marca` | string | No | Dato tecnico. |
| `modelo` | string | No | Dato tecnico. |
| `serie` | string | No | Dato tecnico. |
| `ubicacion` | string | No | Ubicacion fisica. |
| `area` | string | No | Area interna. |
| `capacidad` | string | No | Capacidad HVAC. |
| `voltaje` | string | No | Dato electrico. |
| `corriente` | string | No | Dato electrico. |
| `refrigerante` | string | No | HVAC. |
| `fecha_instalacion` | string | No | Vida util. |
| `vida_util` | number | No | Años estimados. |
| `estado` | enum | Si | operativo/falla/mantenimiento/baja. |
| `ultimo_mantenimiento` | string | No | Historial. |
| `proximo_mantenimiento` | string | No | Preventivo. |
| `horas_operacion` | number | No | KPI. |
| `tecnicos` | array | No | Responsables. |
| `notas` | string | No | Observaciones. |
| `cliente_id` | string | Si | Cliente padre. |
| `sucursal_id` | string | Si | Sucursal padre. |
| `updated_at` | number | Si | Control sync. |
| `deleted_at` | number/null | No | Baja logica. |
| `sync_status` | enum | Si | Estado local. |

### 5.5 `work_orders`

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `uuid_sync` | string | Si | Identificador sync. |
| `id` | string | Si | Folio ticket/OT. |
| `titulo` | string | Si | Descripcion corta. |
| `descripcion` | string | No | Detalle. |
| `prioridad` | enum | Si | baja/media/alta/critica. |
| `estado` | enum | Si | Flujo ticket. |
| `equipo_tag` | string | Condicional | Obligatorio si es falla de activo. |
| `cliente_id` | string | Si | Cliente afectado. |
| `creado_por` | string | Si | Usuario. |
| `asignado_a` | string | No | Tecnico. |
| `fecha_creacion` | string | Si | Fecha. |
| `updated_at` | number | Si | Control sync. |
| `deleted_at` | number/null | No | Baja logica. |

### 5.6 `preventive_maintenance`

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `uuid_sync` | string | Si | Identificador sync. |
| `id` | string | Si | Folio mantenimiento. |
| `equipo_tag` | string | Si | Debe existir en assets. |
| `tecnico` | string | Si | Responsable. |
| `tipo` | string | Si | Preventivo/correctivo/inspeccion. |
| `fecha` | string | Si | Fecha. |
| `estado` | enum | Si | Workflow mantenimiento. |
| `hallazgos` | string | No | Observaciones. |
| `acciones` | string | No | Trabajo realizado. |
| `repuestos` | string | No | Materiales. |
| `ubicacionGeografica` | object | No | GPS movil. |
| `updated_at` | number | Si | Control sync. |
| `deleted_at` | number/null | No | Baja logica. |

### 5.7 `reports`

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `uuid_sync` | string | Si | Identificador sync. |
| `id` | string | Si | Folio informe. |
| `data` | json | Si | Documento completo. |
| `data.status` | enum | Si | borrador/firmado/bloqueado/anulado. |
| `updated_at` | number | Si | Control sync. |
| `deleted_at` | number/null | No | Anulacion/baja logica. |

### 5.8 `ordenes_servicio`

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `uuid_sync` | string | Si | Identificador sync. |
| `id` | string | Si | Folio O.S. |
| `estado` | enum | Si | borrador/firmada/enviada/anulada. |
| `draft_key` | string | Si | Debe ser unico por documento. |
| `data` | json | Si | Documento completo. |
| `updated_at` | number | Si | Control sync. |
| `deleted_at` | number/null | No | Anulacion/baja logica. |

### 5.9 `sync_queue`

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `id` | number | Si | Autoincrement. |
| `table` | string | Si | Tabla destino. |
| `uuid_sync` | string | Si | Registro afectado. |
| `operation` | enum | Si | insert/update/delete. |
| `data` | json | Si | Payload. |
| `timestamp` | number | Si | Orden. |
| `retry_count` | number | No | Reintentos. |
| `last_error` | string | No | Ultimo error. |
| `next_retry_at` | number | No | Backoff. |
| `locked_at` | number | No | Control futuro. |

---

## 6. Estados normalizados

| Modulo | Estados |
|---|---|
| Activos | operativo, falla, mantenimiento, baja |
| Tickets | abierto, asignado, en_proceso, resuelto, cerrado, cancelado |
| Mantenimiento | programado, en_proceso, ejecutado, vencido, cancelado, observado |
| Informes | borrador, firmado, bloqueado, anulado |
| O.S. | borrador, firmada, enviada, anulada |
| Sync | synced, pending_insert, pending_update, pending_delete, failed, conflicted |

### Workflow activos

```text
operativo -> falla -> mantenimiento -> operativo
operativo -> mantenimiento -> operativo
operativo -> baja
falla -> baja
mantenimiento -> baja
```

### Workflow tickets

```text
abierto -> asignado -> en_proceso -> resuelto -> cerrado
abierto -> cancelado
asignado -> cancelado
en_proceso -> cancelado
```

### Workflow mantenimiento

```text
programado -> en_proceso -> ejecutado
programado -> vencido
vencido -> en_proceso -> ejecutado
programado -> cancelado
en_proceso -> observado -> ejecutado
```

---

## 7. Tablas de verdad

### 7.1 Creacion de activo

| Cliente activo | Sucursal activa | Tipo activo | TAG valido | Permite crear | Resultado |
|---|---|---|---|---|---|
| No | N/A | N/A | N/A | No | Bloquear: crear cliente primero. |
| Si | No | N/A | N/A | No | Bloquear: crear sucursal. |
| Si | Si | No | N/A | No | Bloquear: crear tipo. |
| Si | Si | Si | No | No | Corregir TAG. |
| Si | Si | Si | Si | Si | Guardar asset + sync_queue. |

### 7.2 Creacion de mantenimiento

| Activo existe | Activo vigente | Tecnico informado | Fecha valida | Permite crear | Resultado |
|---|---|---|---|---|---|
| No | N/A | N/A | N/A | No | Bloquear. |
| Si | No | N/A | N/A | No | Bloquear activo dado de baja. |
| Si | Si | No | Si | No | Exigir tecnico. |
| Si | Si | Si | No | No | Exigir fecha. |
| Si | Si | Si | Si | Si | Guardar mantenimiento. |

### 7.3 Baja de activo

| Tiene tickets abiertos | Tiene mantenciones pendientes | Usuario autorizado | Permite baja | Accion |
|---|---|---|---|---|
| Si | Si | No | No | Bloquear. |
| Si | Si | Si | Parcial | Solicitar confirmacion fuerte. |
| No | Si | Si | Parcial | Advertir pendientes. |
| No | No | Si | Si | Set `estado=baja`, `deleted_at`. |
| No | No | No | No | Bloquear por permiso. |

### 7.4 Resultado de sincronizacion

| Backend result | Frontend status | Cola | Accion |
|---|---|---|---|
| applied | synced | eliminar | OK. |
| noop | synced | eliminar | OK. |
| error | failed | mantener | Retry. |
| conflict | conflicted | mantener | Resolver. |
| sin red | pending_* | mantener | Esperar conexion. |

---

## 8. Reglas operativas por pantalla

| Pantalla | Objetivo | Tablas/Fuentes | Reglas criticas |
|---|---|---|---|
| Login | Acceso controlado | users, AuthContext | Usuario activo y rol valido. |
| ClientSelector | Seleccionar cliente operacional | clients, settings/localStorage | Requerido antes de activos. |
| Dashboard | KPIs y estado operativo | assets, work_orders, preventive_maintenance, sync_queue | Excluir `deleted_at`. |
| Equipos | Inventario tecnico | assets, clients, branches, catalog_asset_types | No crear activo sin cliente/sucursal/tipo. |
| DetalleEquipo | Ficha e historial | assets, work_orders, preventive_maintenance, reports | Acciones solo si activo vigente. |
| ScannerQR | Leer TAG/QR | assets | Buscar local primero. |
| Mantenimientos | Registrar servicios | preventive_maintenance, assets | No crear sin activo vigente. |
| Tickets | Gestionar fallas/OT | work_orders, assets | Correctivo requiere `equipo_tag`. |
| Informes | Documentos tecnicos | reports, assets | Finalizar requiere contexto. |
| OrdenesServicio | Documento operacional | ordenes_servicio | Finalizar requiere cliente y trabajo. |
| Administracion | Maestros y usuarios | users, clients, branches, catalog_asset_types | Solo roles autorizados. |
| Configuracion/Consola | Diagnostico y parametros | settings, API, sync_queue | No exponer secretos. |

---

## 9. Botones criticos

| Boton | Regla | Flujo esperado | Resultado |
|---|---|---|---|
| Crear | Bloquear doble click | validar -> Dexie -> sync_queue | pending_insert. |
| Guardar | Validar cambios | update local -> sync_queue | pending_update. |
| Borrar/Dar baja | Confirmar | deleted_at -> pending_delete -> sync_queue | Oculto en UI. |
| Finalizar | Validar documento | estado final -> sync_queue | Documento cerrado. |
| Sincronizar | No duplicar sync | fullSync -> /api/sync | Cola procesada. |
| Exportar | No modifica BD | render -> archivo | PDF/XLSX/PNG. |
| Imprimir | No modifica BD | print | Impresion. |
| Escanear | No escribe | camara -> TAG -> busqueda local | Ficha o creacion. |
| Health DB | Solo admin | GET /api/health/db | Diagnostico. |

---

## 10. Operacion movil offline-first

```text
Tecnico abre app
    -> App hidrata Dexie
    -> Usuario escanea QR
    -> Trabaja offline
    -> Guarda mantenimiento/ticket/informe
    -> sync_queue pending
    -> Vuelve conexion
    -> syncEngine reintenta
    -> Neon recibe cambios
    -> Supervisor ve cambios en desktop
```

| Operacion | Offline | Online |
|---|---|---|
| Ver activos descargados | Si | Si |
| Escanear QR local | Si | Si |
| Crear activo | Si, si hay cliente/sucursal local | Si |
| Crear mantenimiento | Si | Si |
| Crear ticket | Si | Si |
| Agregar fotos | Si | Si |
| Firmar informe | Si | Si |
| Exportar PDF | Si | Si |
| Sincronizar | No | Si |

---

## 11. Operacion escritorio online

```text
Supervisor abre app
    -> App hidrata Dexie
    -> syncEngine trae serverChanges
    -> Dashboard actualizado
    -> Revisa pendientes
    -> Asigna trabajos
    -> Exporta reportes
```

| Operacion | Regla |
|---|---|
| Crear clientes | Segun rol. |
| Crear sucursales | Requiere cliente. |
| Revisar dashboards | Datos hidratados y sincronizados. |
| Exportar reportes | No modifica BD. |
| Resolver conflictos | Requiere rol autorizado. |
| Health DB | Solo admin. |
| Validar cola sync | Admin o tecnico lider. |

---

## 12. KPIs CMMS de clase mundial

| KPI | Formula recomendada | Fuente |
|---|---|---|
| Disponibilidad | `(horas_operacion - horas_fuera_servicio) / horas_operacion` | assets + work_orders |
| MTTR | Promedio tiempo resolucion correctivos | work_orders |
| MTBF | Promedio tiempo entre fallas por activo | work_orders + assets |
| Cumplimiento PM | PM ejecutados / PM programados | preventive_maintenance |
| Backlog | Trabajos abiertos o vencidos | work_orders |
| Activos criticos | Activos por criticidad y falla | assets |
| Reincidencia | Fallas repetidas por activo | work_orders |
| Tiempo de respuesta | asignacion - creacion | work_orders |
| Tiempo de cierre | cierre - creacion | work_orders |

| ID | Regla KPI |
|---|---|
| KPI-01 | Excluir registros con `deleted_at`, salvo reportes historicos. |
| KPI-02 | MTTR solo considera tickets cerrados/resueltos. |
| KPI-03 | MTBF solo considera fallas reales asociadas a activo. |
| KPI-04 | Backlog excluye cerrados y cancelados. |
| KPI-05 | Cumplimiento PM requiere fecha programada y fecha ejecucion. |

---

## 13. Auditoria y trazabilidad

| Accion | Tabla | Nivel |
|---|---|---|
| Crear cliente | clients | Alto |
| Crear sucursal | branches | Alto |
| Crear activo | assets | Alto |
| Editar activo | assets | Alto |
| Dar baja activo | assets | Critico |
| Crear ticket | work_orders | Medio |
| Cambiar estado ticket | work_orders | Alto |
| Cerrar ticket | work_orders | Alto |
| Crear mantenimiento | preventive_maintenance | Medio |
| Finalizar mantenimiento | preventive_maintenance | Alto |
| Finalizar informe | reports | Alto |
| Finalizar O.S. | ordenes_servicio | Alto |
| Reset local | IndexedDB | Critico |
| Migracion DB | backend | Critico |

---

## 14. Contrato esperado de `/api/sync`

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

### Resultado por operacion

```json
{
  "uuid_sync": "xxx",
  "table": "assets",
  "operation": "insert",
  "success": true,
  "status": "applied",
  "error": null
}
```

---

## 15. Criterios de aceptacion funcional

| ID | Criterio |
|---|---|
| CA-01 | No se puede crear activo sin cliente. |
| CA-02 | No se puede crear activo sin sucursal. |
| CA-03 | No se puede crear mantenimiento sin activo. |
| CA-04 | Un activo creado offline aparece localmente. |
| CA-05 | Al reconectar, el activo llega a Neon. |
| CA-06 | Otra terminal recibe el activo. |
| CA-07 | Una baja se propaga como `deleted_at`. |
| CA-08 | Un error de sync conserva la operacion en cola. |
| CA-09 | No existen borrados fisicos en tablas sincronizadas. |
| CA-10 | Los botones criticos bloquean doble click. |
| CA-11 | KPIs excluyen bajas. |
| CA-12 | Documentos firmados no se editan directamente. |

---

## 16. Pruebas minimas obligatorias

### Prueba de jerarquia

```text
Intentar crear activo sin cliente -> bloquear
Crear cliente -> crear sucursal -> crear tipo -> crear activo -> permitir
```

### Prueba offline movil

```text
Desconectar red
    -> crear mantenimiento
    -> verificar sync_queue
    -> reconectar
    -> verificar Neon
```

### Prueba dos terminales

```text
Terminal A crea activo -> sync
Terminal B sincroniza -> recibe activo
Terminal B edita -> sync
Terminal A sincroniza -> recibe edicion
Terminal A da baja -> sync
Terminal B sincroniza -> oculta activo
```

### Prueba conflicto TAG

```text
Terminal A crea TAG X offline
Terminal B crea TAG X offline
Ambas sincronizan -> una aplicada y otra conflict
```

---

## 17. Reglas de rechazo automatico para IA Studio

IA Studio debe marcar como defecto cualquier codigo que:

- cree activo sin cliente;
- cree activo sin sucursal;
- cree mantenimiento sin activo;
- escriba directo a Neon desde UI;
- borre fisicamente registros sincronizados;
- elimine operaciones fallidas de sync_queue;
- ignore `deleted_at`;
- permita doble click en finalizacion;
- edite informes firmados sin versionado;
- use credenciales hardcodeadas.

---

## 18. Definicion de CMMS offline-first correcto

```text
Cliente existe
    -> Sucursal existe
        -> Activo existe con TAG unico
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
            -> La auditoria conserva trazabilidad
```

# Fin del documento
