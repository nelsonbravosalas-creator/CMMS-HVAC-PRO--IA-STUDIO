# SPEC-ASSET-UNIVERSAL — Modelo Universal de Activos
## CMMS HVAC PRO · Versión 1.0 · 2026-06-13

---

## 1. Propósito

El sistema no es exclusivamente HVAC. Es una plataforma de gestión de **cualquier tipo de activo físico** que pueda tener un QR pegado y un plan de mantenimiento. Esto incluye:

- Sistemas HVAC (splits, VRF, chillers, torres de enfriamiento, UTAs)
- Energía y eléctrico (UPS, grupos electrógenos, tableros, variadores de frecuencia)
- Mecánico (calderas, compresores, salas de bomba, elevadores)
- Flota (camiones de servicio, vehículos de mantenimiento)
- Infraestructura (extintores, sistemas de supresión de incendios, CCTV)

Este documento define:
- Qué campos tiene **siempre** cualquier activo (schema fijo)
- Qué campos son **variables por tipo** (salen del template, no del schema)
- Cómo se organiza la jerarquía Cliente → Sucursal → Activo
- Cómo funciona la biblioteca de tipos de activo
- Cómo se genera y administra el TAG único
- El ciclo de vida completo de un activo

---

## 2. Principio de diseño central

```
Lo que es IGUAL en un split, un UPS y un camión → campo fijo en el schema
Lo que es DISTINTO entre ellos (BTU, kVA, kilometraje) → campo del template de checklist
```

**Consecuencia:** La tabla `Equipo` (activos) tiene un schema limpio y pequeño. La riqueza técnica específica de cada tipo de equipo vive en los formularios de checklist, no en el perfil del activo.

**Excepción:** Algunos campos técnicos de alta relevancia para KPIs o filtros globales (ej: `capacidad_nominal`, `voltaje`) pueden vivir en `variables_fijas_tipo` — un JSON acotado definido por el tipo de activo. Esto se distingue de `variables_dinamicas` que hoy existe en el código (ver sección 7 — Cambios al schema actual).

---

> **Alineación normativa:** se conserva el concepto `Sucursal`; no se introduce `Zona`. Todo activo tiene `uuid_sync` técnico, `id` funcional, `cliente_id` y `sucursal_id`.

## 3. Campos fijos — presentes en TODO activo

Estos campos existen siempre, sin importar si el activo es un chiller o un camión.

### 3.1 Identidad

| Campo | Tipo | Descripción | Requerido |
|---|---|---|---|
| `tag` | `string` | Identificador único compuesto. Ver sección 5 | ✅ Sí |
| `nombre` | `string` | Nombre descriptivo del activo ("Chiller Sala Máquinas Piso 2") | ✅ Sí |
| `marca` | `string` | Fabricante del equipo ("Carrier", "Volvo", "APC") | ✅ Sí |
| `modelo` | `string` | Modelo comercial del fabricante | ✅ Sí |
| `serie` | `string` | Número de serie del fabricante (único global) | ⚠️ Recomendado |
| `foto_placa_url` | `string` | URL blob de la foto de la placa de fabricante | ⚠️ Recomendado |
| `tiene_placa` | `boolean` | `false` si el activo no tiene placa visible | ✅ Sí |

### 3.2 Ubicación

| Campo | Tipo | Descripción | Requerido |
|---|---|---|---|
| `cliente_id` | `string UUID` | FK → clientes (tenancy) | ✅ Sí |
| `sucursal_id` | `string UUID` | FK → sucursales (ver sección 4) | ✅ Sí |
| `area` | `string` | Texto libre: "Sala de máquinas", "Subterráneo B", "Piso 3" | ⚠️ Recomendado |
| `ubicacion_detalle` | `string` | Descripción fina: "Junto a escalera de emergencia" | No |
| `latitud` | `number` | Coordenada GPS capturada al registrar con QR scan | No |
| `longitud` | `number` | Coordenada GPS capturada al registrar con QR scan | No |

### 3.3 Estado operativo

| Campo | Tipo | Descripción | Requerido |
|---|---|---|---|
| `estado` | `enum` | `operativo` / `en_observacion` / `en_falla` / `mantenimiento` / `retirado` | ✅ Sí |
| `criticidad` | `enum` | `redundante` / `no_critico` / `critico` | ✅ Sí |

### 3.4 Ciclo de vida y mantenimiento

| Campo | Tipo | Descripción | Requerido |
|---|---|---|---|
| `fecha_instalacion` | `Date` | Cuándo se instaló o cuando fue registrado por primera vez | ⚠️ Recomendado |
| `vida_util_anos` | `number` | Años de vida útil esperados | No |
| `frecuencia_mantenimiento` | `enum` | `unico` / `mensual` / `bimestral` / `trimestral` / `semestral` / `anual` | ✅ Sí |
| `proximo_mp_fecha` | `Date` | Calculado por el sistema. Fecha del próximo MP programado | Auto |
| `ultimo_mp_fecha` | `Date` | Calculado desde la última OT MP cerrada | Auto |
| `horas_operativas_inicio` | `string HH:MM` | Sobreescribe el default del cliente. Ej: `'00:00'` para 24/7 | No |
| `horas_operativas_fin` | `string HH:MM` | Ej: `'23:59'` para 24/7 | No |
| `dias_operacion` | `number[]` | `[0,1,2,3,4,5,6]` para 7 días. Sobreescribe default del cliente | No |

### 3.5 Garantía

| Campo | Tipo | Descripción | Requerido |
|---|---|---|---|
| `garantia_vence` | `Date` | Fecha de vencimiento de garantía del fabricante | No |
| `proveedor_garantia` | `string` | Nombre del distribuidor o empresa que cubre la garantía | No |

> **Flujo garantía:** Si `garantia_vence > hoy` al crear una OT correctiva, el sistema marca la OT con flag `en_garantia = true` y la distingue visualmente (no cuenta como costo operativo).

### 3.6 Auditoría

| Campo | Tipo | Descripción |
|---|---|---|
| `created_at` | `Date` | Inmutable. Fecha de alta en el sistema |
| `updated_at` | `Date` | Última modificación |
| `created_by_user_id` | `string` | FK → users. Quién registró el activo |
| `qr_asignado_en` | `Date` | Cuándo se pegó el QR físicamente en el equipo |
| `qr_asignado_por` | `string` | FK → users. Quién pegó el QR |

### 3.7 Tipo de activo

| Campo | Tipo | Descripción | Requerido |
|---|---|---|---|
| `tipo_activo_id` | `string UUID` | FK → catalogo_tipos_activo | ✅ Sí |
| `variables_fijas_tipo` | `Record<string, unknown>` | JSON con campos técnicos clave del tipo. Definido por el tipo. Ver sección 6 | No |

---

## 4. Jerarquía de ubicaciones: Cliente → Sucursal → Activo

### 4.1 Alcance flexible de una Sucursal

En este sistema, `Sucursal` es el contenedor operativo de ubicación. Su nombre puede representar una sede, edificio, piso, ala, faena, campamento o base de flota:

- Un hospital puede dividir por edificio ("Edificio A", "Edificio B")
- Un mall puede dividir por piso o ala ("Piso 1", "Ala Norte")
- Una empresa minera puede dividir por faena ("Faena Sur", "Campamento")
- Un cliente con flota puede dividir por base geográfica ("Base RM", "Base V Región")

**Decisión:** se conserva **Sucursal** para mantener una única terminología en datos, API, UI y reglas. El administrador global define libremente su nombre y código dentro de cada cliente.

### 4.2 Tabla `sucursales`

```typescript
export interface Sucursal {
  uuid_sync: string;         // UUID técnico e inmutable
  id: string;                // Identificador funcional
  sucursal_id: string;       // UUID de dominio
  cliente_id: string;        // FK clientes
  nombre: string;            // "Edificio A", "Subterráneo", "Camión 01", "Faena Sur"
  codigo: string;            // Código corto para el TAG: "21-STK", "ED-A", "CAM"
  codigo_num: number;        // Número correlativo para secuencias de TAG
  descripcion?: string;      // Texto libre
  direccion?: string;        // Dirección física (si aplica)
  ciudad?: string;
  region?: string;
  latitud?: number;
  longitud?: number;
  estado: 'activo' | 'cerrado';
  created_at: Date;
  updated_at: Date;
}
```

> **Nota:** `sucursales` es el nombre canónico. No se realizará una migración a `zonas`.

### 4.3 Indices Dexie

```
sucursales: 'uuid_sync, id, sucursal_id, [cliente_id+nombre], [cliente_id+codigo], cliente_id, estado'
```

---

## 5. TAG — Identificador único del activo

### 5.1 Formato universal

```
{codigo_sucursal}.{codigo_tipo}.{correlativo}

Ejemplos:
  21-STK.AC.001     → Sucursal "Santiago" / Tipo "Aire Acondicionado" / Activo #1
  ED-A.CHI.003      → Sucursal "Edificio A" / Tipo "Chiller" / Activo #3
  CAM.VEH.012       → Sucursal "Flota" / Tipo "Vehículo" / Activo #12
  FAE-S.COM.001     → Sucursal "Faena Sur" / Tipo "Compresor" / Activo #1
```

### 5.2 Reglas de generación

1. El TAG lo asigna el **servidor** al crear el activo (nunca el cliente)
2. Usa la secuencia `asset_tag_sequences(sucursal_id, tipo_activo_id)` para garantizar unicidad
3. El técnico ve el TAG generado en pantalla después del alta
4. El TAG es **inmutable** una vez asignado (ya implementado con el hook en Dexie)
5. El correlativo se formatea con ceros a la izquierda: `001`, `010`, `100`

### 5.3 v1: activos con sucursal fija

En v1, todos los activos (incluidos camiones y flota) tienen una sucursal asignada. La sucursal de un vehículo es su base de operaciones habitual (ej: "Bodega Central").

---

## 6. Biblioteca de tipos de activo

### 6.1 Estructura

```typescript
export interface CatalogoTipoActivo {
  tipo_activo_id: string;       // UUID (PK)
  nombre: string;               // "Split", "Chiller", "UPS", "Vehículo", "Caldera"
  codigo: string;               // Código corto para TAG: "AC", "CHI", "UPS", "VEH", "CAL"
  codigo_num: number;           // Número correlativo
  categoria: string;            // "HVAC", "Energía", "Mecánico", "Flota", "Seguridad"
  descripcion?: string;
  icono?: string;               // Nombre del ícono SVG en la librería del sistema
  
  // Campos técnicos clave para este tipo (no todos los campos — solo los relevantes para filtros y KPIs)
  esquema_variables_fijas: FormFieldDefSchema[];  // JSON que define qué campos técnicos tiene

  // Visibilidad
  es_publico: boolean;          // true = visible para todos los clientes de la plataforma
  cliente_id?: string;          // null si es_publico=true / UUID del cliente si es privado

  estado: 'activo' | 'archivado';
  created_at: Date;
  updated_at: Date;
}
```

### 6.2 Tipos públicos predefinidos (mantenidos por el Programador)

| Tipo | Código | Categoría | Variables fijas clave |
|---|---|---|---|
| Split / Minisplit | `AC` | HVAC | `capacidad_btu`, `voltaje`, `refrigerante_id` |
| VRF / VRV | `VRF` | HVAC | `capacidad_btu`, `n_unidades_internas`, `refrigerante_id` |
| Chiller Agua Helada | `CHI` | HVAC | `capacidad_tr`, `refrigerante_id`, `n_circuitos` |
| Torre de Enfriamiento | `TOR` | HVAC | `capacidad_tr`, `n_celdas` |
| Manejadora de Aire (UTA) | `UTA` | HVAC | `caudal_m3h`, `voltaje` |
| Fancoil | `FCU` | HVAC | `capacidad_btu`, `voltaje` |
| Extractor / Ventilador | `VEN` | Ventilación | `caudal_m3h`, `potencia_kw` |
| UPS | `UPS` | Energía | `capacidad_kva`, `voltaje`, `autonomia_min` |
| Grupo Electrógeno | `GEN` | Energía | `potencia_kva`, `combustible` |
| Caldera | `CAL` | Mecánico | `capacidad_kcalh`, `combustible`, `presion_bar` |
| Compresor de Aire | `COM` | Mecánico | `capacidad_cfm`, `presion_psi` |
| Bomba Hidráulica | `BOM` | Mecánico | `caudal_lpm`, `presion_bar`, `potencia_kw` |
| Vehículo / Camión | `VEH` | Flota | `patente`, `ano_fabricacion`, `combustible` |
| Extintor | `EXT` | Seguridad | `capacidad_kg`, `tipo_agente` |
| Tablero Eléctrico | `TAB` | Eléctrico | `voltaje`, `amperaje_max` |

### 6.3 Tipos privados por cliente

El Administrador global puede solicitar un tipo privado dentro del contexto de un cliente. El Programador revisa su consistencia técnica y lo publica. El tipo privado:
- Solo aparece en la biblioteca del cliente que lo solicitó
- No es visible para otros clientes
- Sigue el mismo esquema de `variables_fijas` que los tipos públicos

**Flujo de solicitud:**
```
Admin cliente → "Solicitar tipo personalizado" → Formulario (nombre, código, variables fijas)
→ Programador recibe notificación → Aprueba y crea → Cliente recibe notificación → Disponible
```

---

## 7. Impacto en el schema actual — Cambios requeridos

### 7.1 Cambios en `src/db/types.ts`

#### Campos a ELIMINAR de `Equipo`
Los siguientes campos son HVAC-específicos y contradicen el modelo universal. Se eliminan del schema fijo:

```typescript
// ❌ ELIMINAR — son campos de tipo HVAC, no universales:
refrigerante_id?: string;
capacidad_valor?: number;
capacidad_unidad: 'BTU' | 'kW' | 'TR';
voltaje?: string;
corriente_nominal?: number;
potencia_kw?: number;
```

#### Campos a AGREGAR a `Equipo`

```typescript
// ✅ AGREGAR — reemplaza los anteriores:
  sucursal_id: string;                        // FK sucursales
variables_fijas_tipo: Record<string, unknown>; // Campos técnicos del tipo (BTU, kVA, etc.)

// ✅ AGREGAR — ciclo de vida y garantía:
proximo_mp_fecha?: Date;
ultimo_mp_fecha?: Date;
horas_operativas_inicio?: string;
horas_operativas_fin?: string;
dias_operacion?: number[];
garantia_vence?: Date;
proveedor_garantia?: string;
qr_asignado_en?: Date;
qr_asignado_por?: string;
```

#### Campos a RENOMBRAR

```typescript
// Se mantiene sucursal_id como FK canónica
// tipo_de_equipo_id → tipo_activo_id (consistencia de nomenclatura)
// variables_dinamicas → variables_fijas_tipo (más descriptivo)
```

### 7.2 Tabla canónica `sucursales`

Ver schema completo en sección 4.2.

La tabla `sucursales` se conserva. Cualquier borrador previo que use `zonas` o `zona_id` debe mapearse a `sucursales` y `sucursal_id`.

### 7.3 Nueva tabla `catalogo_tipos_activo` (renombra `catalog_asset_types`)

```
catalog_asset_types → catalogo_tipos_activo
tipo_de_equipo_id   → tipo_activo_id
campos_dinamicos    → esquema_variables_fijas
```

---

## 8. Ciclo de vida completo de un activo

```
ALTA (levantamiento en terreno)
  ├── Técnico llega a la instalación
  ├── Abre la app → "Nuevo activo"
├── Selecciona Sucursal y Tipo de activo
  ├── Ingresa campos fijos: nombre, marca, modelo, serie
  ├── Fotografia la placa del fabricante
  ├── Ingresa variables_fijas_tipo (BTU, kVA, etc. según el tipo)
  ├── El sistema genera el TAG automáticamente (servidor)
  ├── El sistema genera el QR
  ├── Técnico imprime el QR (o lo genera como PDF) y lo pega en el equipo físico
  └── Estado inicial: 'operativo'

OPERACIÓN (acumulación de historial)
  ├── OTs de MP se asignan periódicamente → checklist completado → informe generado
  ├── OTs correctivas cuando hay fallas → ticket → OT → resolución
  └── Cada OT cerrada queda en el historial del activo para siempre

OBSERVACIÓN (señal de alerta)
  ├── Se abre un ticket correctivo o el técnico marca hallazgo en el checklist
  ├── Estado cambia a: 'en_observacion' o 'en_falla'
  ├── El activo se resalta visualmente en el dashboard (color rojo/amarillo)
  ├── El supervisor ve el activo en la lista de "requieren atención"
  └── Al cerrar el correctivo → estado vuelve a 'operativo'

MANTENIMIENTO PROGRAMADO
  ├── Estado puede cambiarse a 'mantenimiento' para indicar que está fuera de operación temporalmente
  └── Al completar → vuelve a 'operativo'

RETIRO (baja definitiva)
  ├── Supervisor o Administrador marca el activo como 'retirado'
  ├── Se registra: causa ('obsolescencia' / 'daño_total' / 'reemplazo' / 'venta')
  ├── Se registra: fecha_retiro y usuario que lo retiró
  ├── El activo NO se borra de la base de datos
  ├── El historial queda accesible para consulta y auditoría
  └── El QR del equipo queda inactivo (al escanearlo muestra "Activo retirado en [fecha]")
```

### Tabla de estados del activo

| Estado | Color | Descripción |
|---|---|---|
| `operativo` | 🟢 Verde | Funcionando normalmente |
| `en_observacion` | 🟡 Amarillo | Con anomalía registrada pero funcional |
| `en_falla` | 🔴 Rojo | Fuera de servicio por falla |
| `mantenimiento` | 🔵 Azul | En intervención programada |
| `retirado` | ⚫ Gris | Dado de baja. Solo lectura |

---

## 9. Decisiones selladas

| # | Decisión | Razón |
|---|---|---|
| D-01 | Los campos técnicos específicos van en `variables_fijas_tipo`, no en columnas del schema | Permite agregar tipos de activo sin migraciones de base de datos |
| D-02 | Se conserva `sucursales` | Evita duplicar conceptos y mantiene alineados datos, API, UI y reglas |
| D-03 | El TAG lo genera siempre el servidor | Garantiza unicidad global. El offline usa un TAG temporal `PEND-{uuid}` hasta sincronizar |
| D-04 | Los activos retirados nunca se borran | ISO 55000 requiere trazabilidad de ciclo de vida completo |
| D-05 | En v1 todos los activos tienen sucursal fija | Simplifica el modelo de datos. Los camiones van en su sucursal base |
| D-06 | Tipos públicos los mantiene el Programador | Control de calidad y consistencia de la biblioteca |
| D-07 | Los campos HVAC-específicos se eliminan del schema fijo | El modelo debe ser agnóstico. Los campos técnicos viven en el template |
