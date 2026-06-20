# SPEC-CONFIG-FLOWS — Centro de Configuración de Flujos
## CMMS HVAC PRO · Versión 1.0 · 2026-06-13

> **Alineación normativa:** el Administrador es global y es el único rol que crea clientes. Puede cambiar de contexto para configurar cada cliente. El Programador mantiene capacidades técnicas de plataforma, sin crear clientes ni obtener acceso implícito a datos operativos.

---

## 1. Propósito

El sistema no tiene flujos de trabajo fijos. La mayoría de los comportamientos operativos son **configurables por cliente** mediante un panel de administración con toggles (checkboxes). Esto permite que la misma plataforma sirva a un hospital con firma triple obligatoria y a una empresa de mantención de flotas con flujo mínimo.

Este documento define:
- Qué flujos son configurables
- Quién puede cambiar cada uno (Programador de plataforma vs. Administrador global)
- Cómo se persiste la configuración en la base de datos
- Cómo la consultan los módulos del sistema en tiempo de ejecución

---

## 2. Principio de diseño

```
Programador (dueño de la plataforma)
  └── configura: módulos activos, límites del plan, flujos que afectan facturación

Administrador global
  └── crea clientes y configura su comportamiento operativo al seleccionar un contexto
```

**Regla:** el Administrador global es el único creador de clientes. Al operar dentro de un cliente no puede activar módulos fuera del plan técnico habilitado por plataforma.

---

## 3. Tabla maestra de configuraciones

### 3.1 Controladas SOLO por el Programador
> Afectan el plan de suscripción o la arquitectura de datos. El Administrador las ve como lectura.

| Clave | Descripción | Valores posibles | Default |
|---|---|---|---|
| `modulo.inventario` | Activa el módulo de stock y repuestos | `true` / `false` | `false` |
| `modulo.cotizaciones` | Activa flujo de cotización desde hallazgo (v2) | `true` / `false` | `false` |
| `modulo.iot` | Activa telemetría de sensores en tiempo real (v3) | `true` / `false` | `false` |
| `modulo.flota_vehiculos` | Activa gestión de activos móviles (camiones) | `true` / `false` | `false` |
| `plan.max_tecnicos` | Número máximo de técnicos activos permitidos | `integer` | `20` |
| `plan.max_activos` | Número máximo de activos registrados | `integer` | `1000` |
| `plan.max_templates_incluidos` | Templates de checklist incluidos en el plan | `integer` | `5` |
| `plan.idioma_extra` | Idiomas habilitados además de español | `['es']` / `['es','pt','en']` | `['es']` |

---

### 3.2 Controladas por el Administrador global en contexto de cliente
> Comportamiento operativo dentro del plan contratado.

#### 3.2.1 Flujo de Firma de OT

| Clave | Descripción | Valores | Default |
|---|---|---|---|
| `firma.tecnico` | El técnico firma el informe en terreno | `true` / `false` | `true` (obligatorio, no desactivable) |
| `firma.supervisor` | El supervisor debe firmar antes de enviar al cliente | `true` / `false` | `false` |
| `firma.cliente.activa` | El cliente debe dar conformidad firmando | `true` / `false` | `false` |
| `firma.cliente.modo` | Cómo firma el cliente | `'presencial'` / `'remota'` / `'ambas'` | `'remota'` |
| `firma.cliente.canal_remoto` | Canal por donde llega el link de firma al cliente | `'whatsapp'` / `'email'` / `'ambos'` | `'whatsapp'` |
| `firma.cliente.plazo_horas` | Horas máximas para que el cliente firme antes de alerta | `integer` | `48` |

**Flujos resultantes según combinación:**

```
firma.tecnico=true, firma.supervisor=false, firma.cliente.activa=false
→ Técnico firma → PDF generado → Enviado al cliente (sin aprobación)

firma.tecnico=true, firma.supervisor=true, firma.cliente.activa=false
→ Técnico firma → Supervisor revisa y firma → PDF enviado al cliente

firma.tecnico=true, firma.supervisor=false, firma.cliente.activa=true, modo='remota'
→ Técnico firma → Link enviado al cliente por WhatsApp → Cliente firma → OT en estado firmado → Administrador cierra

firma.tecnico=true, firma.supervisor=true, firma.cliente.activa=true, modo='presencial'
→ Técnico firma → Supervisor firma → Técnico pasa celular al encargado → Firma en pantalla → OT firmada → Administrador cierra
```

---

#### 3.2.2 Flujo de Localización GPS

| Clave | Descripción | Valores | Default |
|---|---|---|---|
| `gps.modo` | Cuándo captura la posición del técnico | `'qr_scan'` / `'continuo'` / `'checkin_manual'` / `'desactivado'` | `'qr_scan'` |
| `gps.requiere_en_zona` | Exige que el técnico esté en la ubicación del activo para proceder | `true` / `false` | `false` |
| `gps.radio_metros` | Radio de tolerancia para validación de zona (si `requiere_en_zona=true`) | `integer` | `200` |

---

#### 3.2.3 Flujo de Mantenimiento Preventivo (MP)

| Clave | Descripción | Valores | Default |
|---|---|---|---|
| `mp.modo_generacion` | Cómo se crean las OTs de MP | `'manual'` / `'automatico'` / `'calendario'` / `'hibrido'` | `'manual'` |
| `mp.alerta_vencimiento_dias` | Días antes del vencimiento para alertar al supervisor | `integer` | `7` |
| `mp.logica_vencimiento` | Qué dispara el vencimiento | `'tiempo'` / `'fecha_programada'` / `'ambas'` | `'ambas'` |
| `mp.requiere_supervisor_crear_ot` | Solo el supervisor puede crear OTs de MP | `true` / `false` | `true` |

**Lógica de vencimiento con `'ambas'`:**
```
vencido = (días_desde_ultimo_mp >= frecuencia_equipo_dias)
          OR
          (fecha_programada != null AND fecha_programada < hoy)
```

---

#### 3.2.4 Flujo de Notificaciones

| Clave | Descripción | Valores | Default |
|---|---|---|---|
| `notif.ot_completada.whatsapp` | Envía WhatsApp al contacto del cliente al cerrar OT | `true` / `false` | `true` |
| `notif.ot_completada.email` | Envía email con PDF adjunto al cerrar OT | `true` / `false` | `true` |
| `notif.ot_completada.push` | Push notification en portal del cliente | `true` / `false` | `true` |
| `notif.ticket_critico.supervisor` | Push al supervisor cuando llega ticket de prioridad crítica | `true` / `false` | `true` |
| `notif.ticket_critico.admin` | Push al administrador cuando llega ticket crítico | `true` / `false` | `true` |
| `notif.hallazgo.push_supervisor` | Push al supervisor cuando checklist detecta hallazgo | `true` / `false` | `true` |
| `notif.mp_vencido.frecuencia` | Cada cuántos días se recuerda un MP vencido | `integer` | `3` |

---

#### 3.2.5 Flujo de Reporte Periódico

| Clave | Descripción | Valores | Default |
|---|---|---|---|
| `reporte.mensual.automatico` | Genera y envía reporte mensual automáticamente el día 1 | `true` / `false` | `false` |
| `reporte.mensual.dia` | Día del mes en que se genera el reporte automático | `integer 1-28` | `1` |
| `reporte.mensual.canal` | Canal de entrega del reporte mensual automático | `'email'` / `'whatsapp'` / `'ambos'` | `'email'` |
| `reporte.cliente.puede_generar` | El cliente puede generar reportes propios desde su portal | `true` / `false` | `true` |
| `reporte.supervisor.bajo_demanda` | El supervisor puede generar reportes en cualquier momento | `true` / `false` | `true` |

---

#### 3.2.6 Branding del PDF

| Clave | Descripción | Valores | Default |
|---|---|---|---|
| `pdf.logo_empresa_servicio` | Muestra logo de la empresa de servicio en el informe | `true` / `false` | `true` |
| `pdf.logo_cliente` | Muestra logo del cliente en el informe | `true` / `false` | `false` |
| `pdf.pie_empresa_servicio` | Muestra nombre de la empresa de servicio en pie de página | `true` / `false` | `true` |
| `pdf.white_label` | Oculta completamente la marca de la empresa de servicio | `true` / `false` | `false` |

**Nota:** `pdf.white_label=true` es una capacidad técnica del plan que habilita el Programador; el Administrador global configura su uso por cliente.

---

#### 3.2.7 Seguridad y Autenticación

| Clave | Descripción | Valores | Default |
|---|---|---|---|
| `auth.tecnico.biometrico` | Los técnicos usan huella/Face ID tras el primer login | `true` / `false` | `true` |
| `auth.tecnico.sesion_dias` | Días que dura la sesión antes de pedir login completo | `integer` | `30` |
| `auth.cliente_portal.2fa` | El portal del cliente requiere verificación en dos pasos | `true` / `false` | `false` |

---

#### 3.2.8 Horas Operativas (para KPI de disponibilidad)

| Clave | Descripción | Valores | Default |
|---|---|---|---|
| `kpi.horas_operativas.horario_inicio` | Hora de inicio de operación del cliente | `HH:MM` | `'08:00'` |
| `kpi.horas_operativas.horario_fin` | Hora de fin de operación | `HH:MM` | `'18:00'` |
| `kpi.horas_operativas.dias_semana` | Días de operación | `array [0-6]` (0=Dom) | `[1,2,3,4,5]` |

> Los activos individuales pueden sobreescribir esta configuración. Un chiller de sala de servidores opera `00:00–23:59`, 7 días.

---

## 4. Modelo de datos

### Tabla: `configuracion_cliente`

```sql
CREATE TABLE configuracion_cliente (
  config_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL REFERENCES clientes(cliente_id),
  clave           TEXT NOT NULL,        -- 'firma.supervisor', 'mp.modo_generacion', etc.
  valor           JSONB NOT NULL,       -- true, false, "automatico", 42, ["es","pt"]
  nivel           TEXT NOT NULL CHECK (nivel IN ('programador', 'admin')),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES users(user_id),
  UNIQUE (cliente_id, clave)
);

CREATE INDEX idx_config_cliente ON configuracion_cliente(cliente_id);
```

### Tabla Dexie equivalente (frontend offline)

```typescript
// src/db/types.ts — agregar:
export interface ConfiguracionCliente {
  config_id: string;
  cliente_id: string;
  clave: string;
  valor: boolean | string | number | string[];
  nivel: 'programador' | 'admin';
  updated_at: Date;
}

// src/db/database.ts — agregar tabla en la próxima migración:
configuracion_cliente: 'config_id, cliente_id, clave, [cliente_id+clave]'
```

---

## 5. Cómo consultan los módulos la configuración

### Helper en frontend

```typescript
// src/lib/config.ts
import { db } from '@/db/database';

export async function getConfig<T = boolean>(
  clienteId: string,
  clave: string,
  defaultValue: T
): Promise<T> {
  const row = await db.configuracion_cliente
    .where('[cliente_id+clave]')
    .equals([clienteId, clave])
    .first();
  return row ? (row.valor as T) : defaultValue;
}

// Uso en un componente o servicio:
const firmaCliente = await getConfig(clienteId, 'firma.cliente.activa', false);
if (firmaCliente) {
  // mostrar flujo de solicitud de firma al cliente
}
```

### Principio de fallback

```
1. Busca en configuracion_cliente (Dexie local, ya sincronizado)
2. Si no existe la clave → usa el default definido en este documento
3. Nunca bloquea el flujo por falta de configuración — siempre hay un default seguro
```

---

## 6. Panel de UI — Secciones del menú de configuración

```
Configuración del Cliente
├── 📋 Plan y módulos        ← Programador: capacidad técnica; Administrador: lectura por cliente
│   ├── Módulos activos (inventario, cotizaciones, IoT, flota)
│   └── Límites del plan (técnicos, activos, templates)
│
├── ✍️  Firma y aprobación   ← Administrador global en contexto de cliente
│   ├── Flujo de firma (técnico / supervisor / cliente)
│   ├── Modo de firma del cliente (presencial / remota)
│   └── Canal de firma remota y plazo
│
├── 📡  Notificaciones       ← Administrador global en contexto de cliente
│   ├── OT completada (WhatsApp / email / push)
│   ├── Tickets críticos
│   └── MP vencidos
│
├── 🗓️  Mantenimiento Prev.  ← Administrador global en contexto de cliente
│   ├── Modo de generación de OTs
│   ├── Días de alerta previa
│   └── Lógica de vencimiento
│
├── 📊  Reportes             ← Administrador global en contexto de cliente
│   ├── Reporte mensual automático
│   └── Permisos de generación del cliente
│
├── 📄  PDF e Informes       ← Administrador global (capacidad white label habilitada por Programador)
│   └── Logos y branding del informe
│
├── 📍  GPS y Presencia      ← Administrador global en contexto de cliente
│   └── Modo de captura de ubicación
│
└── 🔒  Seguridad            ← Administrador global (capacidad 2FA habilitada por Programador)
    ├── Biométrico para técnicos
    └── Duración de sesión
```

---

## 7. Sincronización de configuración

La tabla `configuracion_cliente` se sincroniza en **pull-only** hacia el frontend (dirección `↓`). Solo el servidor puede modificarla. El cliente nunca pushea cambios de configuración — los hace a través del portal web con conexión activa.

Agregar a `shared/contracts/sync.ts`:
```typescript
// En SyncEntityEnum agregar:
'configuracion_cliente'

// En PULL_ONLY_ENTITIES agregar:
'configuracion_cliente'
```

---

## 8. Decisiones selladas

| # | Decisión | Razón |
|---|---|---|
| D-01 | Configuración en tabla de clave-valor (no columnas) | Permite agregar nuevas configuraciones sin migración de schema |
| D-02 | Valor en JSONB (no TEXT) | Soporta boolean, número, array de strings sin conversión |
| D-03 | Nivel `programador` vs `admin` en la misma tabla | El Programador habilita capacidades técnicas; el Administrador global configura cada cliente |
| D-04 | Siempre hay default definido en código | El sistema funciona aunque nunca se haya tocado la configuración |
| D-05 | Configuración es pull-only (solo el servidor la escribe) | Evita conflictos de sync; la configuración es autoridad del servidor |
