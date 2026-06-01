# Documentación Técnica - Sistema CMMS NBYB

## 1. Introducción
Este sistema es una aplicación de gestión de mantenimiento asistido por computadora (CMMS) diseñada específicamente para operaciones HVAC y activos industriales. Utiliza una arquitectura moderna basada en React, Vite y Neon PostgreSQL.

## 2. Pila Tecnológica (Tech Stack)
- **Frontend**: React 18 (TypeScript)
- **Ruteo**: Wouter (ligero y eficiente)
- **Estilos**: Tailwind CSS con sistema de diseño personalizado.
- **Iconografía**: Lucide React.
- **Gráficos**: Recharts.
- **Base de Datos**: Neon PostgreSQL.
- **Autenticación**: Vercel/Neon Auth.
- **Utilidades**: 
  - `html2canvas`: Generación de imágenes de etiquetas QR.
  - `motion`: Animaciones fluidas de interfaz.

## 3. Arquitectura de Datos (Neon PostgreSQL)
La base de datos se organiza en tablas relacionales principales:

### 3.1 `activos`
Almacena la hoja de vida de cada activo.
- **Identificador**: TAG único (ej: 21-STK.AC.001)
- **Propiedades clave**: `estado`, `ubicacion`, `ultimo_mantenimiento`, `proximo_mantenimiento`.

### 3.2 `tickets` / `informes`
Gestión de incidencias, fallas reportadas y mantenimiento.
- **Relatividad**: Vinculado a un TAG de equipo.

### 3.3 `usuarios`
Perfiles extendidos de usuarios.
- **Roles**: `tecnico`, `supervisor`, `administrador`, `cliente`.

## 5. Módulos Críticos

### 5.1 Terminal Scanner (`/src/pages/ScannerQR.tsx`)
Gestiona la interfaz entre el mundo físico y digital. Incluye un motor de renderizado de etiquetas que cumple con los estándares de impresión industrial (100x50mm).

### 5.2 Salud Operativa (`/src/pages/Dashboard.tsx`)
Calcula en tiempo real métricas de confiabilidad:
- **MTBF**: Tiempo medio entre fallas.
- **MTTR**: Tiempo medio de reparación.
- **Disponibilidad**: Ratio de operatividad del parque.

## 6. Convenciones de Desarrollo
- **Tipado**: Todos los modelos de datos deben definirse en `src/types.ts`.
- **Componentes**: Deben ser funcionales y utilizar hooks para la lógica de estado.
- **Estilos**: No se permiten archivos CSS externos; usar exclusivamente clases de utilidad de Tailwind en el JSX.

## 7. Flujo de Persistencia Core: Informes Técnicos (`reports`)

El sistema cuenta con un motor de sincronización fuera de línea y persistencia dual (local + remota) optimizado para informes técnicos detallados de climatización.

### 7.1 Flujo de Datos en `EditorInforme`
1. **Creación de Borrador Inicial**: Cuando un usuario accede para crear o editar un informe, el sistema comprueba el identificador. Si es `'nuevo'`, se genera de forma inmediata un Identificador Único Universal (UUID v4) y se asocia un Folio temporal (`INF-PENDIENTE-[6-CHARS]`). El usuario es redirigido a la URL persistente `/informes/${newUuid}`.
2. **Auto-guardado en Base Local**: A medida que el usuario completa el informe (datos generales, información de motores, parámetros de ciclos de refrigeración, checklist, hallazgos y fotos de evidencia), un hook `useEffect` captura los cambios e invoca silenciosamente a la base de datos local Dexie mediante un método `db.reports.put` de alto rendimiento, asegurando que no se pierdan datos por desconexión repentina sin sobrecargar la cola de sincronización de red.
3. **Persistencia de Folios Consistente**: El folio final es asignado de forma determinista y pre-inyectado en el snapshot del objeto de datos antes de gatillar la transacción y el proceso de PDF, garantizando que el folio sea inmutable y consistente en base de datos local, servidor, y el documento PDF generado.
4. **Guardado Manual**: Al presionar "Guardar", se escribe formalmente el estado de borrador y se encola un evento en la cola persistente `sync_queue` local en Dexie.
5. **Firma y Sincronización**: Al presionar "Sync & Finalizar" con la firma del técnico completada, el archivo se firma, el estado cambia a `'firmado'`, se encola en `sync_queue` para sincronización inmediata y se dispara un trigger activo del motor de sincronización en segundo plano (`syncEngine.triggerSync`).

### 7.2 Tablas Utilizadas (Persistencia Dual)

#### Servidor (Neon PostgreSQL)
* **Tabla**: `reports`
* **Definición**: Las tablas se autoverifican y autocrean al arrancar mediante la función `ensureTables` del servidor Express.
* **Esquema de Servidor**:
  ```sql
  CREATE TABLE IF NOT EXISTS reports (
    uuid_sync TEXT PRIMARY KEY,
    id TEXT,
    data JSONB NOT NULL,
    updated_at BIGINT,
    created_at BIGINT,
    deleted_at BIGINT
  );
  ```

#### Local del Cliente (Dexie DB)
* **Tabla**: `reports`
* **Esquema de Dexie**: `"uuid_sync, id, sync_status, updated_at"` (La llave primaria es `uuid_sync`).
* **Cola de Sincronización**: `sync_queue` de tipo indexed-store.

### 7.3 Esquema de Datos de Carga Útil (`data` JSONB)
El campo `data` es un objeto JSON extendido y extensible que encapsula el informe completo:
- **`estado` / `status`**: Estado del reporte (`'borrador' | 'firmado' | 'bloqueado' | 'offline_draft'`).
- **`generalData`**: Objeto con `cliente`, `sucursal`, `region`, `direccion`, `fecha`, `tecnico`, `tipoServicio`, `folio`, y localización GPS refinada (`ubicacionGeografica`).
- **`machineData`**: Datos característicos de la máquina como `tipo`, `tag`, `marca`, `modelo`, `serie`, `refrigerante`, `capacidad`, `voltaje`.
- **`circuits`**: Matriz de circuitos que almacena número de compresores, presiones (`pb`, `pa`), temperaturas (`te`, `tc`, `tsub`, `tsob`), y parámetros eléctricos de rla/r/s/t.
- **`checklist`**: Detalle del checklist con estados (`'ok' | 'obs' | 'falla'`), hallazgos de fallas (`findings`), y array de fotos en formato binario/base64 (`photos`).
- **`observaciones`**: Campo de texto libre para notas e inteligencia artificial.
- **`galeria`**: Evidencias fotográficas asociadas.
- **`firmas`**: Firmas digitalizadas en base64 del técnico (`tecnico`) y conformidad del cliente (`cliente`).
- **`fechaSincronizacionLocal`**: Marca de tiempo ISO del guardado final.

### 7.4 Lógica de Sincronización Fuera de Línea (Sync Loop)
1. **Comprobación de Red**: El cliente detecta el estado mediante el `networkMonitor`. Si está offline, los registros permanecen como `pending_insert` o `pending_update` en la base de datos local y en la `sync_queue`.
2. **Envío de Operaciones**: Al estar online o reconectarse, el `syncEngine` recopila las operaciones pendientes y las envía al endpoint `/api/sync` de PostgreSQL.
3. **Idempotencia e Inserción**: El servidor Neon Postgres procesa las inserciones/actualizaciones en forma incondicional. Si el registro no existe, se inserta; si ya existe, se actualiza mediante un query condicionado:
   ```sql
   INSERT INTO reports (id, data, uuid_sync, updated_at) 
   VALUES ($1, $2, $3, $4) 
   ON CONFLICT (uuid_sync) 
   DO UPDATE SET 
     id = EXCLUDED.id, 
     data = EXCLUDED.data, 
     updated_at = EXCLUDED.updated_at 
   WHERE EXCLUDED.updated_at > reports.updated_at OR reports.updated_at IS NULL;
   ```

---
*Desarrollado por el Agente de IA para NBYB SPA - 2026*
