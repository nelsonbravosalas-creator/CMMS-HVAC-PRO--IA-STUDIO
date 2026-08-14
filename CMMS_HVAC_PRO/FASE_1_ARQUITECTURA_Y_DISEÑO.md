# FASE 1 — ARQUITECTURA Y DISEÑO
## CMMS HVAC PRO — Sistema de Gestión de Mantenimiento

**Versión:** 1.0  
**Fecha:** 2026-06-12  
**Estado:** En Planificación

> **Alineación normativa:** este documento desarrolla `CMMS_HVAC_PRO_Reglas_de_Negocio_v1.md`. Se mantiene la línea tecnológica existente del repositorio: React 19, Wouter, Zustand, Dexie, Express y PostgreSQL/Neon.

---

## 1. CONTROL DE ACCESO — MATRIZ DE PERMISOS POR ROL

### Roles del Sistema

| Rol | Descripción | Alcance |
|---|---|---|
| **Administrador** | Rol global. Crea clientes, cambia de contexto y puede operar en vista global sin cliente preseleccionado. | Global, todos los clientes |
| **Supervisor** | Supervisa técnicos, crea OT, edita reportes, cierra tickets. | Por cliente |
| **Técnico** | Emite OT, checklist, cierra tickets. | Equipos asignados |
| **Cliente** | Crea tickets, mantenimientos, lee informes, descarga datos. | Su cliente |
| **Proveedor** | Accede a tickets asignados, actualiza estado. | Tickets asignados |

El Administrador global utiliza el selector para entrar a vista global o a un cliente. Supervisor y Técnico eligen al iniciar uno de sus clientes asignados y mantienen ese contexto durante la sesión, con opción de cambiarlo desde el encabezado. Cliente y Proveedor ingresan directamente con su cliente predeterminado. La sucursal nunca se solicita al iniciar sesión y se selecciona únicamente como filtro dentro de los módulos que corresponda.

---

### 1.1 MATRIZ DETALLADA DE PERMISOS

| **Permiso / Acción** | **Sistema** | **Admin** | **Supervisor** | **Técnico** | **Cliente** | **Proveedor** |
|---|---|---|---|---|---|---|
| **ADMINISTRACIÓN & CONFIGURACIÓN** | | | | | | |
| Crear Cliente | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editar Cliente | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Crear Sucursal | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editar Sucursal | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **USUARIOS & PERFILES** | | | | | | |
| Crear Usuario | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editar Perfil (propio) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar Perfil (otros) | ✅ | ✅ (su cliente) | ✅ (técnicos) | ❌ | ❌ | ❌ |
| Ver Logs de Eventos | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **MI COMPAÑÍA — DATOS CORPORATIVOS** | | | | | | |
| Editar Logo & Razón Social | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Editar Carta de Presentación | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Gestionar Documentación | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **TIPO DE EQUIPO & VARIABLES** | | | | | | |
| Crear Tipo de Equipo | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editar Tipo de Equipo | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Crear Variables Personalizadas | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **ACTIVOS & EQUIPOS** | | | | | | |
| Crear Equipo | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Editar Equipo | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Retirar/Archivar Equipo | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver Hoja de Vida | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver Historial de Cambios | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Leer QR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PLANTILLAS & CONFIGURACIÓN** | | | | | | |
| Crear/Editar form_templates | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Crear/Editar Categorías Formularios | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Publicar Template | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **ÓRDENES DE TRABAJO** | | | | | | |
| Crear OT | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editar OT (propio) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Emitir Checklist | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Firmar Informe | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Editar Informe Técnico | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver OT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Descargar Informe (PDF) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **MANTENIMIENTO PREVENTIVO** | | | | | | |
| Crear MP | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Editar MP | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Planificar MP | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **TICKETS & INCIDENCIAS** | | | | | | |
| Crear Ticket | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Editar Ticket | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Cerrar Ticket | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Asignar Responsable | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Asignar Proveedor | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ver Tickets Asignados | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **INVENTARIO** | | | | | | |
| Crear Artículo | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editar Artículo | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ajustar Stock | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver Stock | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver Historial Stock | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **PROVEEDORES** | | | | | | |
| Crear Proveedor | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Editar Proveedor | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Ver Datos Proveedor | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **REPORTES & ANALYTICS** | | | | | | |
| Generar Reportes OT | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Generar Reportes MP | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ver Indicadores (MTBF, MTBM, etc.) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Exportar Reportes (Excel/PDF) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver Dashboards Avanzados | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **CONFIGURACIÓN DE ALERTAS** | | | | | | |
| Crear Reglas Notificación | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editar Reglas Notificación | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **SINCRONIZACIÓN & OFFLINE** | | | | | | |
| Ver Cola de Pendientes | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Resolver Conflictos Sync | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **ELIMINACIÓN & ARCHIVADO** | | | | | | |
| Eliminar Registro | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Archivar Registro | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 2. ESTRUCTURA DE DATOS — JERARQUÍA DE TENANT

```
Cliente (cliente_id)
├── Sucursal (sucursal_id, cliente_id)
│   ├── Activo / Equipo (tag_id, sucursal_id, cliente_id)
│   │   ├── Historial de Cambios
│   │   ├── Ficha Técnica (personalizable por tipo_de_equipo_id)
│   │   └── Hoja de Vida (OT, MP, Tickets)
│   ├── Orden de Trabajo (OT) (cliente_id, sucursal_id)
│   │   └── N Instancias de Formulario (form_instances) [1 por tag]
│   ├── Mantenimiento Preventivo (MP) (cliente_id, sucursal_id)
│   ├── Ticket (cliente_id, sucursal_id)
│   └── Inventario (cliente_id, sucursal_id)
│
├── Mi Compañía (Logo, Razón Social, Documentación)
├── Proveedores (cliente_id)
└── Usuarios & Roles (cliente_id, roles)
```

Toda entidad sincronizable incluye además `uuid_sync` técnico e inmutable y `id` funcional. Los usuarios se relacionan con uno o más clientes mediante `user_clientes`; el administrador global puede operar sin cliente activo.

---

## 3. MÓDULOS PRINCIPALES — FASE 1

### 3.1 ENTORNO GRÁFICO FRONT

**Plataforma:** PWA (Progressive Web App)  
**Responsivo:** Mobile-first, optimizado para técnicos en terreno  
**Temas:** 3 skin disponibles
- Light (claro)
- Dark (oscuro)
- Cyberpunk (oscuro con neón fosforescente)

**Características UI:**
- Botones grandes (mínimo 44x44px) para touch
- Listas desplegables expandidas
- Teclado numérico automático para campos de número
- Menú lateral personalizable (drag-to-reorder, left/right toggle)
- Menú de módulos diferenciado: PC vs PWA
- Sincronización visual (offline/online badge)
- QR scanner integrado

**Diseño Reference:** `C:\Users\The Pirata\Documents\Google Drive\APPS\IA STUDIO - HVAC PRO\src\index.css`

---

### 3.2 MÓDULOS Y COMPONENTES

#### 3.2.1 Dashboard Principal
- **Vista rápida** de OT activas, MP programadas, Tickets pendientes
- **Indicadores KPI** (MTBF, MTBM, disponibilidad, costo mantenimiento)
- **Gráficos** de tendencias (por mes, trimestre)
- **Notificaciones** in-app (stock bajo, OT crítica, MP vence)

#### 3.2.2 Cliente & Sucursales
- **CRUD Cliente** (solo Administrador global)
- El formulario de alta y edición exige nombre, RUT válido, dirección, región y una sucursal obligatoria de tipo Casa Matriz.
- **CRUD Sucursal** (Administrador global)
- **Datos corporativos** (Logo, razón social, contacto)
- **Carta de presentación** (editable, para reportes)
- **Documentación** (políticas, manuales, normativas)

#### 3.2.3 Mi Compañía
- **Perfil corporativo** (Logo, razón social, descripción)
- **Perfiles de usuario** (Administrador, Supervisor, Técnico, Cliente, Proveedor)
- **Datos del proveedor** (si aplica)
- **Documentación corporativa** (carta presentación, políticas)

#### 3.2.4 Activos & Equipos
- **CRUD Tipo de Equipo** (con variables personalizables)
  - Datos por defecto para HVAC (Capacidad BTU, Voltaje, Frecuencia, Marca, Modelo, etc.)
- **CRUD Equipo** (tag_id, código serial, ubicación)
- **Ficha Técnica** (personalizable según tipo_de_equipo_id)
  - Datos fijos (Marca, Modelo, Serial, Año fabricación)
  - Variables dinámicas (Capacidad, Voltaje, especificaciones)
- **Hoja de Vida** (historial completo del equipo)
  - OT realizadas
  - MP ejecutadas
  - Tickets asociados
  - Cambios de estado
- **QR Reader** → Redirecciona a Hoja de Vida

#### 3.2.5 Formularios Dinámicos
- **form_templates** (plantillas versionadas por tipo_de_equipo_id)
- **form_instances** (instancias de informe por tag dentro de una OT)
- **FieldRenderer dinámico** (texto, número, lista, checkbox, firma digital, foto)
- **Validación** (cliente-side offline, server-side online)

#### 3.2.6 Órdenes de Trabajo (OT)
- **Crear OT** (Supervisor, Técnico, Cliente)
  - Seleccionar sucursal, equipos (N tags)
  - Asignar técnico responsable
  - Tipo de OT: preventivo, correctivo, atencion_falla, puesta_en_marcha, inspeccion_tecnica, instalacion_montaje
- **OT en Progreso** (Dashboard)
  - Estado por tag
  - % completado (N form_instances / N tags)
  - Binding progresivo de campos narrativos
- **Emitir Checklist** (form_instance por tag)
- **Firmar Informe** (Técnico, Supervisor)
- **Folio automático** (Backend: INF-{cod_sucursal}.{cod_tipo}-{tag_correlativo}-{folio_secuencial})
  - Offline: asigna folio temporal; Backend retorna folio único al sincronizar

#### 3.2.7 Mantenimiento Preventivo (MP)
- **Crear MP** (Supervisor, Cliente)
  - Equipos, frecuencia (semanal, mensual, trimestral, anual)
  - Plantilla checklist asociada
- **Planificar MP** (Scheduler)
  - Agrupa tags por (cliente, sucursal, frecuencia)
  - Genera 1 OT + N work_order_assets automáticamente
- **Calendario de MP** (visual, por sucursal)

#### 3.2.8 Calendario & Planificación
- **Calendario visual** de OT y MP programadas
- **Alimentado por:**
  - Fechas de OT creadas
  - Informes/Checklist completados
  - MP programadas
- **Filtros:** Cliente, Sucursal, Tipo OT, Estado
- **Exportar** a iCal / Google Calendar

#### 3.2.9 Mapa
- **Geolocalización** de sucursales y equipos
- **Filtros:** Por cliente, sucursal, tipo equipo
- **Popup:** Información rápida del equipo (QR, hoja de vida)
- **Offline:** Fallback a lista si no hay GPS

#### 3.2.10 Ticket & Incidencias
- **Crear Ticket** (Cliente, Supervisor, Técnico)
  - Descripción, prioridad, tipo incidencia
  - Asignar responsable (Técnico, Supervisor)
  - Asignar proveedor (Cliente, Supervisor)
- **Estados Workflow:**
  - Abierto → En Progreso → Resuelto → Cerrado
- **Seguimiento** (comentarios, cambios de estado, auditoría)
- **Resolución** (Técnico/Proveedor cierra; Cliente valida)
- **Historial** (quién hizo qué, cuándo)

#### 3.2.11 Inventario *(Desarrollar en Fase de Integración)*
- **Descripción:** Gestión de repuestos y materiales
- **Campos:** Código, descripción, marca, cantidad, stock mínimo, costo
- **Movimientos:** Entrada, salida, ajuste
- **Alertas:** Stock bajo, caducidad

#### 3.2.12 Reportes & Analytics
- **Reportes OT** (por cliente, sucursal, rango fecha, tipo)
- **Reportes MP** (cumplimiento, efectividad)
- **Reportes Ticket** (resolución, tiempo promedio, SLA)
- **Indicadores KPI:**
  - **MTBF** (Mean Time Between Failures)
  - **MTBM** (Mean Time Between Maintenance)
  - **MTBR** (Mean Time to Repair)
  - **Disponibilidad** (% tiempo operativo)
  - **Costo mantenimiento** (por equipo, cliente, periodo)
- **Exportar** (Excel, PDF, CSV)
- **Gráficos:** Líneas, barras, pie charts

---

## 4. FLUJO DE DATOS OFFLINE → ONLINE

```
Offline (PWA - Técnico en terreno)
│
├─ Crear OT → Asigna folio TEMPORAL (OT-CLI-SYS-[uuid])
├─ Emitir Checklist → form_instance local
├─ Firmar Informe → Signature guardada localmente
├─ Foto/Attachment → Blob en IndexedDB
│
└─ Cola de Sincronización (pending queue)

        ↓ Conexión restaurada
        
Online (Sincronización)
│
├─ Push: OT, form_instances, attachments, signatures
├─ Backend: 
│  ├─ Valida en servidor
│  ├─ Genera folio ÚNICO (INF-[cod_sucursal].[cod_tipo]-[tag_corr]-[folio_seq])
│  ├─ Triggers: binding narrativos, ot_completable
│  └─ Retorna folio + UUID final
│
├─ Pull: Registros de otros dispositivos
├─ Dexie: Actualiza local con LWW (Last-Write-Wins)
│
└─ UI: Notificación "Sincronización exitosa"
```

---

## 5. CONSIDERACIONES DE DISEÑO

### 5.1 Mobile-First
- Botones ≥44x44px
- Menú hamburguesa (mobile) vs sidebar (desktop)
- Scroll vertical prioritario
- Teclado numérico automático en campos de número

### 5.2 Offline-First
- IndexedDB mediante Dexie, evolucionando el schema actual con migraciones incrementales y sin asumir una versión paralela inexistente
- Service Worker para push + sync
- Cola automática de pendientes
- Conflictos LWW (última escritura gana)

### 5.3 Seguridad & Privacidad
- JWT + PIN para desbloqueo offline
- Todos los datos con `cliente_id` (tenant isolation)
- Logs de auditoría (quién, qué, cuándo)
- VAPID para web push (consentimiento del usuario)

### 5.4 Accesibilidad
- Etiquetas ARIA
- Contraste suficiente (WCAG AA)
- Teclado navegable
- Lectores de pantalla compatibles

---

## 6. PRÓXIMOS PASOS

- [ ] Validar matriz de permisos con stakeholders
- [ ] Definir datos personalizables de Ficha Técnica HVAC
- [ ] Definir workflow y estados de Tickets
- [ ] Definir estructura y formatos de Documentación corporativa
- [ ] Wireframes: OTProgressDashboard, Informe HVAC, Dashboard principal
- [ ] Design System (componentes, colores, tipografía)

---

**Documento preparado para Fase 1 Design — CMMS HVAC PRO**
