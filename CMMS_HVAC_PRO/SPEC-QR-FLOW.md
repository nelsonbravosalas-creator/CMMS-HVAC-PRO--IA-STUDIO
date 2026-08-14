# SPEC-QR-FLOW — Flujo QR de Activos
## CMMS HVAC PRO · Versión 1.0 · 2026-06-13

> **Alineación normativa:** el QR identifica al activo mediante `uuid_sync` dentro de una URL web universal. El TAG se muestra como referencia humana, pero no es la identidad del enlace.

---

## 1. Propósito

Cada activo físico registrado en el sistema tiene un **código QR único** impreso en una etiqueta adhesiva pegada en el equipo. Este QR es el punto de entrada principal para que el técnico interactúe con el activo en terreno — sin buscar nada, sin escribir nada.

Este documento define:
- Qué contiene el QR y qué URL representa
- Cómo se comporta el scan en cada escenario (online / offline / sin sesión)
- Las 4 acciones disponibles al escanear
- El registro de presencia con GPS
- La etiqueta física: generación, impresión y durabilidad
- El comportamiento cuando el activo está retirado

---

## 2. El QR en una oración

> Escanear el QR abre directamente la ficha del activo en la PWA instalada, con las acciones disponibles según el contexto del técnico en ese momento.

---

## 3. Contenido del QR

El QR codifica una **URL universal** con el identificador único del activo:

```
https://app.cmmshvacpro.com/equipos/{uuid_sync}

Ejemplos:
  https://app.cmmshvacpro.com/equipos/550e8400-e29b-41d4-a716-446655440000
```

### Parámetro `uuid_sync`
- Es el identificador técnico e inmutable del activo.
- Se genera como UUID v4 y es seguro para transportar en una URL.
- No contiene información sensible; el servidor aplica autorización antes de devolver datos.
- El TAG continúa visible e imprimible como referencia operativa.

### Por qué URL y no solo un ID
- Cualquier cámara de cualquier celular puede escanear y abrir el enlace
- No requiere una app específica de escaneo
- El navegador redirige automáticamente a la PWA si está instalada (deep link)
- Si la PWA no está instalada, el navegador muestra la landing de instalación

---

## 4. Deep link — Apertura directa en la PWA

La PWA registra el path `/equipos/*` como ruta web del activo:

```json
// manifest.json
{
  "handle_links": "preferred",
  "scope": "https://app.cmmshvacpro.com/",
  "start_url": "https://app.cmmshvacpro.com/"
}
```

**Flujo de apertura:**

```
Técnico apunta cámara al QR
  └─► Sistema operativo lee la URL
        ├─► PWA instalada en el celular
        │     └─► Abre directamente la ficha del activo en la PWA (sin pasar por el navegador)
        └─► PWA NO instalada
              └─► Abre el navegador → landing de instalación con instrucciones
                    └─► Técnico instala PWA → vuelve a escanear → ya funciona directo
```

---

## 5. Estados de sesión al escanear

### 5.1 Sesión activa (técnico ya logueado)

```
Scan QR → PWA abre ficha del activo → Muestra las 4 acciones disponibles
```

Este es el caso normal del día a día. El técnico inicia sesión una vez (biometría después) y la sesión dura 30 días.

### 5.2 Sin sesión (primer uso o sesión expirada)

```
Scan QR → PWA abre → Pantalla de login
  ├─► Primer uso: email + contraseña → configura biometría → ficha del activo
  └─► Sesión expirada: biometría → ficha del activo
```

El URL escaneado se guarda temporalmente. Después de hacer login, el sistema navega automáticamente a la ficha del activo que se estaba intentando abrir.

### 5.3 Sin internet (offline)

```
Scan QR → PWA abre → Busca el activo en Dexie (caché local)
  ├─► Activo encontrado en caché → Muestra ficha + acciones disponibles offline
  └─► Activo NO en caché → Muestra mensaje: "Este activo no está descargado. Sincroniza cuando tengas conexión."
```

**Pre-condición para offline:** El técnico debe haber sincronizado su turno **antes** de ir a terreno. La sincronización descarga todos los activos de las OTs asignadas para el día. Si el activo está en una OT del técnico, siempre estará en caché.

---

## 6. Las 4 acciones al escanear

Al abrir la ficha del activo, el técnico ve las acciones disponibles según su contexto:

```
┌──────────────────────────────────────┐
│  21-STK.AC.001                       │
│  Split Carrier 12.000 BTU            │
│  📍 Sucursal Santiago · Oficina Piso 3 │
│  🟢 Operativo · Crítico              │
├──────────────────────────────────────┤
│                                      │
│  [📋 Mi OT de hoy]   ← si tiene     │
│                                      │
│  [📖 Ver historial]                  │
│                                      │
│  [🚨 Reportar falla]                 │
│                                      │
│  [✅ Registrar presencia]            │
│                                      │
└──────────────────────────────────────┘
```

### Acción 1: Abrir OT del día

- **Aparece cuando:** el técnico tiene una OT activa que incluye este activo en el turno actual
- **Comportamiento:** Abre directamente el checklist de ese activo dentro de esa OT. Sin buscar, sin navegar
- **Offline:** Disponible si la OT fue sincronizada antes de salir
- **Si no hay OT asignada:** El botón no aparece. Solo se ven las otras 3 acciones

### Acción 2: Ver historial del activo

- **Aparece siempre** (toda ficha tiene historial)
- **Contenido:**
  - Datos técnicos del activo (marca, modelo, serie, variables fijas del tipo)
  - Foto de la placa
  - Lista cronológica de OTs (MP y correctivas) con estado y fecha
  - Lista de tickets abiertos o cerrados
  - Fecha de instalación, próximo MP, última intervención
  - Consumo de refrigerante o insumos acumulado
- **Offline:** Disponible con los datos descargados en la última sincronización
- **Nota para técnico:** "Historial al [fecha última sync]. Puede estar desactualizado si no has sincronizado hoy."

### Acción 3: Reportar falla o hallazgo

- **Aparece siempre**
- **Flujo:**
  1. Técnico selecciona tipo: `Falla operativa` / `Ruido anormal` / `Fuga` / `Otro`
  2. Escribe descripción mínima (20 caracteres)
  3. Toma foto opcional
  4. Confirma
  5. El sistema crea un **ticket correctivo** vinculado a ese activo automáticamente
  6. El estado del activo cambia a `en_observacion` o `en_falla` según el tipo
  7. Push notification al supervisor
- **Offline:** El ticket se guarda en Dexie y se encola en `sync_queue`. Cuando vuelve la conexión, se crea en el servidor

### Acción 4: Registrar presencia

- **Aparece siempre**
- **Propósito:** Evidencia de que el técnico estuvo físicamente en el equipo (para SLA y trazabilidad)
- **Comportamiento:**
  1. Técnico toca "Registrar presencia"
  2. El sistema captura GPS (si el modo GPS es `'qr_scan'` o `'continuo'`)
  3. Registra: técnico_id, activo_uuid_sync, timestamp, coordenadas GPS
  4. Muestra confirmación: "Presencia registrada 14:32"
- **Offline:** El evento se encola en `sync_queue` con timestamp local. Se sube cuando hay conexión

> **Nota:** Si la acción 1 (abrir OT) está disponible y el técnico la usa, el sistema registra presencia automáticamente al iniciar el checklist. No es necesario hacerlo manualmente.

---

## 7. Registro de presencia y GPS

### Tabla `presencia_activos`

```typescript
export interface PresenciaActivo {
  uuid_sync: string;          // UUID técnico del evento
  id: string;                 // Identificador funcional
  presencia_id: string;        // UUID (PK)
  cliente_id: string;          // FK clientes (tenancy)
  activo_uuid_sync: string;    // FK estable hacia assets.uuid_sync
  user_id: string;             // FK users (técnico)
  work_order_id?: string;      // FK work_orders (si es por OT)
  
  timestamp: Date;             // Hora local del dispositivo
  timestamp_utc: Date;         // Hora UTC (calculada por el servidor al sync)
  
  // GPS
  latitud?: number;
  longitud?: number;
  precision_metros?: number;   // Precisión del GPS en ese momento
  gps_capturado: boolean;      // false si el modo GPS está desactivado
  
  // Origen del registro
  origen: 'qr_scan' | 'manual' | 'ot_inicio' | 'ot_checklist';
  
  // Sync
  sync_status: 'pending' | 'synced';
  created_at: Date;
}
```

### Modos de GPS (definidos en SPEC-CONFIG-FLOWS)

| Modo | Cuándo captura | Caso de uso |
|---|---|---|
| `qr_scan` | Solo al escanear el QR | Default. Bajo consumo de batería |
| `continuo` | Cada 5 minutos mientras la PWA está abierta | Clientes que exigen trazabilidad continua |
| `checkin_manual` | Solo cuando el técnico toca "Registrar presencia" | Para técnicos que prefieren control explícito |
| `desactivado` | Nunca | Instalaciones con política de no geolocalización |

---

## 8. Comportamiento cuando el activo está retirado

Si el técnico escanea el QR de un equipo que fue dado de baja:

```
┌──────────────────────────────────────┐
│  ⚫ ACTIVO RETIRADO                  │
│                                      │
│  21-STK.AC.001                       │
│  Split Carrier 12.000 BTU            │
│                                      │
│  Retirado el 15 de marzo de 2026     │
│  Motivo: Obsolescencia               │
│  Retirado por: Carlos Mendoza        │
│                                      │
│  [📖 Ver historial de vida]          │
│                                      │
│  ¿Ves este QR en un equipo activo?   │
│  [🔗 Reportar QR en equipo incorrecto]│
└──────────────────────────────────────┘
```

- No se ofrecen acciones operativas (no se puede crear OT ni ticket en un activo retirado)
- El historial sigue siendo visible para auditoría
- La opción "Reportar QR en equipo incorrecto" permite notificar que el QR fue movido a un equipo diferente sin actualizar el sistema

---

## 9. La etiqueta física QR

### 9.1 Generación

El sistema genera un PDF con los QR cuando el administrador lo solicita:

**Menú:** `Activos → Exportar QRs → Seleccionar sucursal / todos`

**Contenido del PDF por QR:**
```
┌─────────────────────────┐
│  [QR CODE — 3cm x 3cm]  │
│  21-STK.AC.001          │
│  Split 12.000 BTU       │
│  [LOGO DE LA EMPRESA]   │
└─────────────────────────┘
```

El PDF genera una grilla de etiquetas en tamaño estándar `38mm x 25mm` (Avery L7871 o similar), lista para imprimir en hoja adhesiva.

### 9.2 Especificaciones físicas recomendadas

| Propiedad | Especificación |
|---|---|
| Material | Poliéster plateado o vinyl resistente |
| Temperatura | Soporta -40°C a 150°C (salas de máquinas, equipos industriales) |
| Humedad | Resistente a humedad y condensación |
| UV | Resistente a luz solar directa (equipos en exterior) |
| Adhesivo | Permanente, superficie lisa o rugosa |
| Tamaño mínimo | 30mm x 30mm para que el QR sea escaneable a 15cm |

> **Servicio de valor agregado:** La empresa de servicio puede ofrecer etiquetas premium (poliéster metalizado, placa acrílica grabada con láser) como parte del contrato de implementación. Esto diferencia el servicio y es un ingreso adicional.

### 9.3 Quién imprime y cuándo

**Flujo estándar:**
```
1. Administrador genera PDF de QRs desde el sistema
2. Imprime en impresora de etiquetas (Dymo, Brother, Zebra) o en hoja adhesiva estándar
3. El técnico lleva las etiquetas a la primera visita de levantamiento
4. Al registrar cada activo, pega el QR y toma foto como evidencia de instalación
5. El sistema registra fecha y usuario que pegó el QR
```

**Flujo premium (futuro):**
```
1. El sistema genera el pedido de etiquetas
2. Proveedor de impresión las produce y las envía
3. El técnico solo las pega — vienen con el nombre del equipo pre-impreso
```

---

## 10. Flujo completo end-to-end: primer scan del día

```
07:45 — Técnico sincroniza la app antes de salir (WiFi de la empresa)
         → Se descargan las OTs del día con todos los activos incluidos

08:30 — Técnico llega al Mall A, Subterráneo, Sala de Máquinas

08:31 — Apunta cámara al QR del Chiller #1 (21-STK.CHI.001)
         → PWA se abre directamente (deep link)
         → Sesión activa con biometría

08:31 — Pantalla muestra:
         ✅ "OT del día disponible: OT-2026-06-13-001"
         📖 Historial | 🚨 Reportar falla | ✅ Registrar presencia

08:31 — Técnico toca "Mi OT de hoy"
         → El sistema registra presencia automáticamente con GPS
         → Abre el checklist del Chiller #1

08:45 — Técnico detecta que el presostato de alta presión marca 420 PSI (fuera de rango)
         → El campo está configurado como "hallazgo si valor > 400"
         → El sistema resalta el campo en rojo automáticamente
         → Muestra aviso: "Este valor generará un hallazgo en el informe"

08:47 — Técnico toma foto del manómetro
         → La foto se guarda en IndexedDB (aún sin conexión en el sótano)

08:50 — Técnico completa el resto del checklist

08:51 — Técnico firma en pantalla con el dedo

08:51 — El sistema:
         → Genera el informe con el campo de presostato resaltado en rojo
         → Crea automáticamente un ticket correctivo vinculado al chiller
         → Encola todo en sync_queue (offline)

09:15 — Técnico sube al parking, recupera señal de datos

09:15 — La app sincroniza automáticamente en background:
         → Sube el informe firmado
         → Sube la foto del manómetro
         → Crea el ticket en el servidor
         → Envía push al supervisor: "Hallazgo crítico en 21-STK.CHI.001"
         → El estado del chiller cambia a 'en_observacion' en el dashboard
```

---

## 11. Datos del QR en Dexie

Los eventos de scan y presencia se almacenan localmente antes de sincronizar:

```typescript
// Agregar a src/db/database.ts en la próxima migración:
presencia_activos: 'uuid_sync, id, presencia_id, [cliente_id+activo_uuid_sync], [cliente_id+user_id], activo_uuid_sync, user_id, timestamp, sync_status'
```

Y su sync en `shared/contracts/sync.ts`:
```typescript
// Agregar a SyncEntityEnum:
'presencia_activos'  // ↑ solo push (append-only, nunca se edita)

// Agregar a SyncItemBaseSchema (campos adicionales):
// presencia_activos es append-only: el cliente siempre pushea, nunca hay conflicto
```

---

## 12. Decisiones selladas

| # | Decisión | Razón |
|---|---|---|
| D-01 | El QR codifica la URL completa (no solo el ID) | Funciona con cualquier escáner. No requiere app propietaria para leer el QR |
| D-02 | Deep link abre la PWA instalada directamente | Evita fricción del navegador. Experiencia nativa sin App Store |
| D-03 | El `uuid_sync` va en la URL; el TAG se imprime como texto | El UUID mantiene identidad estable aunque el TAG sea corregido |
| D-04 | Offline: abre desde caché + encola eventos | El técnico trabaja sin interrupciones. La sincronización es transparente |
| D-05 | Presencia se registra automáticamente al iniciar OT | Elimina el paso manual cuando el técnico ya escaneó para trabajar |
| D-06 | Activo retirado muestra historial pero bloquea acciones | Los QRs viejos siguen siendo válidos para consulta sin crear confusión operativa |
| D-07 | GPS captura solo al escanear QR (default) | Balance entre trazabilidad y consumo de batería del celular del técnico |
