# Datos iniciales del seed

Este documento describe los datos parametrizados definidos en `scripts/db/parametric-data.ts` y aplicados por el bootstrap de base de datos.

## Clientes — tabla `clientes`

| ID | UUID sync | Nombre | Datos adicionales |
|---|---|---|---|
| `cliente-default-001` | `cliente-default-001` | Cliente Internacional | Empresa: Client Corp; activo |
| `C1` | `C1` | EECOL ELECTRIC | RUT: 78.928.030-4; plan: enterprise; contacto: José Miguel Aránguiz (`jose.aranguiz@eecol.cl`); dirección: 14 de la fama 2781; activo |

## Sucursales — tabla `sucursales`

| Cliente | ID | Nombre |
|---|---|---|
| Cliente Internacional | `sucursal-default-001` | Sede Central, Santiago |
| EECOL ELECTRIC | `11-STK` | Iquique |
| EECOL ELECTRIC | `12-STK` | Antofagasta |
| EECOL ELECTRIC | `13-STK` | Copiapó |
| EECOL ELECTRIC | `21-STK` | Santiago 14 de la Fama; Casa Matriz; contacto José Miguel Aránguiz |
| EECOL ELECTRIC | `21-STK-SB` | BME La Vara 3310 |
| EECOL ELECTRIC | `23-STK` | Viña del Mar; Calle Limache 3363 |
| EECOL ELECTRIC | `24-STK` | Rancagua |
| EECOL ELECTRIC | `31-STK` | Concepción |
| EECOL ELECTRIC | `32-STK` | Puerto Montt |
| EECOL ELECTRIC | `Planta-STK` | Planta Industrial |

## Tipos de activo — tabla `catalog_asset_types`

| Código | Descripción |
|---|---|
| `AC` | Aire acondicionado |
| `VH` | Vehículo |
| `GE` | Grupo electrógeno |
| `EB` | Equipo de Bodega |
| `GO` | Grúa horquilla |
| `XX` | Otros activos |

## Catálogos generales — tabla `settings`

### `regions:cl`

Arica y Parinacota, Tarapacá, Antofagasta, Atacama, Coquimbo, Valparaíso, Metropolitana de Santiago, Libertador Gral. Bernardo O'Higgins, Maule, Ñuble, Biobío, La Araucanía, Los Ríos, Los Lagos, Aysén del Gral. Carlos Ibáñez del Campo y Magallanes y de la Antártica Chilena.

### `refrigerants:cl`

| Código | Uso o descripción |
|---|---|
| R-410A | Aire acondicionado doméstico/comercial |
| R-134a | Refrigeración comercial y automotriz |
| R-22 | Aire acondicionado antiguo/en retirada |
| R-404A | Refrigeración comercial de baja temperatura |
| R-507A | Refrigeración industrial/comercial |
| R-407C | Retrofit de R-22 |
| R-32 | Aire acondicionado de nueva generación |
| R-600a | Isobutano; refrigeración doméstica |
| R-290 | Propano; refrigeración comercial |
| R-1234yf | Aire acondicionado automotriz |
| R-448A | Reemplazo de R-404A |
| R-449A | Reemplazo de R-404A/R-507A |
| R-452A | Transporte refrigerado |
| R-744 | CO₂; refrigeración comercial/industrial |
| R-717 | Amoníaco; refrigeración industrial |
| R-513A | Reemplazo de R-134a |
| R-417A | Retrofit directo de R-22 |
| R-422D | Reemplazo drop-in de R-22 |
| R-438A | Reemplazo de R-22 (MO99) |
| R-1234ze | Chillers y bombas de calor |

## Usuarios — tablas `users` y `user_clientes`

El seed productivo no crea usuarios. Los seis perfiles demo sólo se habilitan
en desarrollo local mediante `CMMS_ENABLE_DEMO_USERS=true` y un
`CMMS_DEMO_PIN` de 6 dígitos almacenado fuera de Git. En Vercel y en cualquier
entorno `production`, el bootstrap desactiva las cuentas `@cmms.local` y exige
la existencia de un administrador operacional con correo real.

## Tablas sin registros iniciales

El seed no crea datos operacionales en `assets`, `inventory`, `work_orders`, `ordenes_servicio`, `preventive_maintenance`, `reports`, `events`, `calendar` ni `audit_logs`.

## Comportamiento del bootstrap

El bootstrap hace *upsert* de clientes, sucursales, catálogos y configuración.
Si se elimina un registro paramétrico y se vuelve a ejecutar `/api/init-db` o
`/api/import-data`, el registro se restaura. Los usuarios no se restauran en
producción.
