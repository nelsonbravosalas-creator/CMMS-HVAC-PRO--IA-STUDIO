# CMMS HVAC PRO

Plataforma de gestión de mantenimiento (CMMS) multi-tenant, offline-first y mobile-first, con HVAC como vertical principal sobre un modelo de activos universal.

- **Frontend:** React 19 + Vite + Tailwind CSS, persistencia local con Dexie (IndexedDB) para operación sin conexión.
- **Backend:** Express (`server.ts`) sobre PostgreSQL serverless (Neon) vía `@neondatabase/serverless`, sin ORM.
- **Sincronización:** cola offline → online con resolución de conflictos (ver `CMMS_HVAC_PRO_Especificacion_Tecnica.md`).

## Documentación

Punto de entrada obligatorio: [`DOCS_INDEX.md`](DOCS_INDEX.md) — gobierna qué documento es la fuente vigente por dominio.

| Documento | Contenido |
|---|---|
| [`CMMS_HVAC_PRO_Reglas_de_Negocio.md`](CMMS_HVAC_PRO_Reglas_de_Negocio.md) | Reglas de negocio normativas (único) |
| [`CMMS_HVAC_PRO_Especificacion_Tecnica.md`](CMMS_HVAC_PRO_Especificacion_Tecnica.md) | Arquitectura, stack y modelo de datos normativos (único) |
| [`SPEC-ASSET-UNIVERSAL.md`](SPEC-ASSET-UNIVERSAL.md) · [`SPEC-CONFIG-FLOWS.md`](SPEC-CONFIG-FLOWS.md) · [`SPEC-QR-FLOW.md`](SPEC-QR-FLOW.md) | Especificaciones temáticas |
| [`FASE_2_PLAN_IMPLEMENTACION_FRONTEND.md`](FASE_2_PLAN_IMPLEMENTACION_FRONTEND.md) | Plan vivo de implementación (sprints, checklist) |

## Ejecutar localmente

**Prerrequisitos:** Node.js

1. Instalar dependencias:
   ```
   npm install
   ```
2. Configurar variables de entorno (ver [.env.example](.env.example)): credenciales de Neon Postgres y `GEMINI_API_KEY`.
3. Levantar la base de datos (crea tablas si no existen):
   ```
   npm run db:bootstrap
   ```
4. Ejecutar en desarrollo:
   ```
   npm run dev
   ```

## Build y producción

```
npm run build   # compila frontend (Vite) y backend (esbuild) a dist/
npm start       # sirve dist/server.cjs
```

Despliegue configurado para Vercel (`vercel.json`, `vercel-build`) y alternativamente Docker (`Dockerfile`, `docker-compose.yml`).
