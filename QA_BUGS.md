# 🐛 REGISTRO DE BUGS — CMMS HVAC PRO
  > Generado por QA Senior Agent | Fecha: 2026-07-02  
  > Rama: `qa/test-execution-2025-07`

  ---

  ## BUGS CRÍTICOS 🔴

  | ID | Módulo | Título | Endpoint / Archivo | Reproducción |
  |---|---|---|---|---|
  | BUG-C01 | Auth/Tenancy | Admin sin tenant: 403 en módulos core | `/api/assets`, `/api/maintenance`, `/api/work-orders`, `/api/inventory` | Login admin → GET /api/assets → 403 |
  | BUG-C02 | Clientes API | Acepta cliente SIN nombre | `POST /api/clients` | `{ rut: "55.5", plan: "basico" }` → 200 |
  | BUG-C03 | Clientes API | Acepta RUT duplicado | `POST /api/clients` | Enviar mismo RUT dos veces → ambos 200 |
  | BUG-C04 | Clientes API | Acepta plan enum inválido | `POST /api/clients` | `{ plan: "PLAN_INVALIDO" }` → 200 |
  | BUG-C05 | RBAC | Tecnico/Supervisor/Visita bloqueados en TODO | `/api/assets`, `/api/clients`, `/api/users` | Login tecnico → GET /api/assets → 403 |
  | BUG-C06 | RBAC | Rol cliente bloqueado en sus propios activos | `/api/assets`, `/api/maintenance` | Login cliente → GET /api/assets → 403 |

  ---

  ## BUGS ALTOS 🟠

  | ID | Módulo | Título | Archivo | Detalle |
  |---|---|---|---|---|
  | BUG-A01 | Auth | Login falla offline | `src/data/users.ts:11-13` | `!navigator.online` → excepción dura |
  | BUG-A02 | Seguridad | Email real de dev en BD producción | `/api/users` response | `nelson.bravo.salas@gmail.com` con perfil administrador |
  | BUG-A03 | Sucursales | Sucursales son datos estáticos hardcodeados | `src/data/branches.ts` | Solo 11 sucursales fijas, no se puede crear nueva |
  | BUG-A04 | Auth/Seguridad | JWT expuesto en body, sin TTL documentado | `api/auth.ts` | Token retornado en JSON body, sin Set-Cookie |

  ---

  ## BUGS MEDIOS 🟡

  | ID | Módulo | Título | Detalle |
  |---|---|---|---|
  | BUG-M01 | UI | Typo login: "Agil" sin tilde | Debe ser "Ágil" — `src/pages/Login.tsx` |
  | BUG-M02 | UI/Auth | Botón biométrico sin feedback en desktop | Sin manejo de error cuando WebAuthn no disponible |
  | BUG-M03 | Equipos | Equipos son mock estáticos (no persisten) | `src/data/assets.ts` — comentario: "en prod vendría de PostgreSQL" |

  ---

  ## BUGS BAJOS 🔵

  | ID | Módulo | Título | Detalle |
  |---|---|---|---|
  | BUG-L01 | Equipos API | TAG duplicado expone error SQL crudo (500) | `"violates foreign key constraint assets_sucursal_id_fkey"` expuesto al cliente |
  | BUG-L02 | Sync | Motor de sync sin feedback de falla | `useSyncStore` — falla silenciosamente |
  | BUG-L03 | UX | Estados vacíos no testeados visualmente | Listas de OT/inventario con 0 registros sin mensaje visible |

  ---

  ## MATRIZ DE PRIORIDAD DE CORRECCIÓN

  ```
  Sprint 1 (BLOQUEANTES - esta semana):
    BUG-C01: Corregir seed BD — dar cliente_id al admin O bypass por rol
    BUG-C02: Agregar validación nombre requerido en POST /api/clients
    BUG-C03: Agregar constraint UNIQUE en columna rut de tabla clients
    BUG-C04: Agregar validación enum para campo plan
    BUG-C05: Revisar y corregir RBAC para tecnico/supervisor/visita

  Sprint 2 (ALTA PRIORIDAD):
    BUG-C06: Dar acceso de lectura al rol cliente en sus activos
    BUG-A01: Implementar cache de sesión offline
    BUG-A02: Eliminar cuenta real de BD producción
    BUG-A04: Revisar almacenamiento seguro del JWT

  Sprint 3 (MEJORA CONTINUA):
    BUG-A03: Hacer sucursales dinámicas (CRUD real)
    BUG-L01: Manejar errores de DB con mensajes amigables
    BUG-M01: Fix typo "Ágil"
  ```

  ---

  ## ESTADÍSTICAS DE LA SUITE

  | Módulo | Casos | Pasaron | Fallaron | % Éxito |
  |---|---|---|---|---|
  | Autenticación | 12 | 9 | 3 | 75% |
  | Clientes API | 7 | 2 | 5 | 29% |
  | Equipos API | 5 | 3 | 2 | 60% |
  | Seguridad/RBAC | 6 | 3 | 3 | 50% |
  | UX/UI | 5 | 1 | 4 | 20% |
  | **TOTAL** | **35** | **18** | **17** | **51%** |

  ---

  *Todos los bugs han sido verificados contra la app desplegada en producción: https://cmms-hvac-pro-ia-studio.vercel.app*
  