# Handoff — CMMS HVAC PRO

Documento de continuidad para retomar el trabajo con otra sesión o agente de IA
sin depender del historial de conversación.

> Actualizar este archivo al finalizar cada bloque de trabajo importante.

## Estado actual

- El proyecto compila y funciona localmente.
- La aplicación carga correctamente la pantalla de acceso en
  `http://localhost:3000/login`.
- El modo sin `DATABASE_URL` utiliza el simulador de base de datos local.
- El repositorio ya contenía otros cambios sin confirmar antes del último bloque
  de trabajo. No deben descartarse ni sobrescribirse sin revisarlos.

## Último bloque realizado

### Validación local

- Ejecutado `npm test`.
- TypeScript compiló sin errores.
- Las 5 pruebas de regresión de seguridad fueron aprobadas.
- Ejecutado `npm run build` correctamente.
- Verificada la respuesta HTTP `200 OK`.
- Verificada visualmente la pantalla de acceso.
- No se detectaron errores de consola en el navegador.

### Correcciones de arranque offline

- La limpieza de tablas obsoletas se ejecuta solamente con una conexión real a
  PostgreSQL/Neon.
- En modo offline se omite explícitamente esa operación.
- Se eliminaron los mensajes repetidos:
  `sql.unsafe is not a function`.

Archivo principal:

- `server.ts`

### Optimización del frontend

- Las páginas se cargan con `React.lazy` y `Suspense`.
- El paquete JavaScript inicial bajó aproximadamente de 2,43 MB a 410 KB.
- `jspdf` se carga solamente cuando se genera un documento PDF.
- Se eliminaron imports dinámicos inefectivos de `database` y `syncEngine`.
- El build finalizó sin advertencias de tamaño de chunk ni de imports dinámicos
  inefectivos.

Archivos modificados en este bloque:

- `server.ts`
- `src/App.tsx`
- `src/components/SyncIndicator.tsx`
- `src/components/modals/ClientModal.tsx`
- `src/pages/EditorInforme.tsx`

## Verificación recomendada al retomar

```powershell
npm test
npm run build
npm run dev
```

Después, abrir:

```text
http://localhost:3000/login
```

Comprobar:

1. Que no aparezca `sql.unsafe is not a function`.
2. Que la pantalla de acceso termine de cargar.
3. Que la consola del navegador no muestre errores.
4. Que las rutas protegidas carguen sus módulos después de iniciar sesión.

## Pendientes conocidos

- Probar el flujo autenticado y navegar por las rutas cargadas de forma diferida.
- Probar el arranque con una instancia PostgreSQL/Neon real y sus migraciones.
- Revisar si los 2,9 MB aproximados del precache PWA son adecuados para el modo
  offline esperado. No impide compilar ni cargar la aplicación.
- Revisar y separar los cambios preexistentes del repositorio antes de crear un
  commit.

## Reglas de continuidad

- Leer este archivo antes de modificar el proyecto.
- Ejecutar `git status --short` antes de editar.
- Preservar los cambios existentes que no pertenezcan a la tarea actual.
- Registrar aquí solamente resultados comprobados.
- Mover a “Pendientes conocidos” cualquier trabajo iniciado pero incompleto.
- Añadir los comandos de validación ejecutados y su resultado.
- No guardar claves, tokens, contraseñas ni datos sensibles en este archivo.

## Registro

### 2026-07-24

- Se validó el proyecto localmente.
- Se corrigió el arranque con la base simulada.
- Se implementó división de código por rutas.
- Se redujo el bundle inicial.
- Se verificaron pruebas, build, HTTP y renderizado del login.

