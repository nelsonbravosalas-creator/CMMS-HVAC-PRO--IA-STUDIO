# Revisión del Plan Maestro ITO por Gemini

Modelo: `gemini-3.6-flash` · 2026-11-16 · Respuesta sin editar.

---

A continuación se presenta la revisión técnica independiente del **Plan Maestro — Módulo ITO**.

---

### 1. Contradicciones internas

* **Hallazgo 1.1**: Gestión de firmas al reabrir una ITO desde el estado `observada`.
  * **Gravedad**: Alta
  * **Sección**: Sección 3 (Ciclo de vida) y Sección 5 (Regla R10)
  * **Detalle**: El diagrama del ciclo de vida muestra que el contratista firma en `por_firmar` y, si hay bloqueantes, la ITO pasa a `observada`. Desde ahí, se realiza una re-inspección volviendo a `en_progreso`. Sin embargo, la Regla R10 exige un orden de firmas estricto (Inspector → Contratista → Cliente) sin saltar ninguna. El plan no especifica qué sucede con las firmas capturadas previamente. Si se conservan, el contratista no volvería a firmar la re-inspección (violando R10); si se borran, falta la regla explícita de invalidación de firmas al cambiar de estado.
  * **Corrección**: Declarar explícitamente en la regla R10 que al transicionar de `observada` a `en_progreso` por re-inspección, las firmas anteriores del inspector y del contratista quedan invalidadas e historizadas en `data.historial_firmas`, exigiendo nuevamente la secuencia completa de tres firmas para cerrar la ITO.

* **Hallazgo 1.2**: Requisitos para que el inspector firme frente a observaciones no planificadas críticas.
  * **Gravedad**: Media
  * **Sección**: Sección 2 (Decisiones - Observaciones) y Sección 5 (Regla R1)
  * **Detalle**: La Sección 2 establece que una observación no planificada crítica bloquea la aprobación de la ITO. No obstante, la regla R1 (que define los requisitos bloqueantes para que el *inspector* pueda firmar) solo valida los ítems del checklist ("No cumple"), omitiendo las observaciones no planificadas críticas. Esto permite que un inspector firme e inicie la fase de firmas aun teniendo observaciones críticas sin responsable o sin fotos.
  * **Corrección**: Ampliar la regla R1 especificando que el inspector tampoco podrá firmar si existen observaciones no planificadas marcadas como críticas que carezcan de responsable, fecha límite o evidencia fotográfica.

---

### 2. Huecos del flujo

* **Hallazgo 2.1**: Ausencia de estado y flujo para el rechazo explícito por cliente o contratista.
  * **Gravedad**: Alta
  * **Sección**: Sección 3 (Ciclo de vida)
  * **Detalle**: El ciclo de vida solo contempla el camino donde el contratista firma (pasando a `observada` si hay hallazgos) y el cliente aprueba. No existe ningún estado ni flujo previsto para cuando el cliente o el contratista se nieguen a firmar o rechacen formalmente el contenido del informe. La ITO quedaría congelada indefinidamente en `por_firmar`.
  * **Corrección**: Añadir el estado `rechazada` al ciclo de vida. Si el contratista o el cliente rechazan el documento en la pantalla de firma, la ITO pasa a `rechazada` con motivo obligatorio, notificando al supervisor para que determine si la reabre a `en_progreso` o la archiva.

* **Hallazgo 2.2**: Firma del inspector en modo offline con ID provisional.
  * **Gravedad**: Alta
  * **Sección**: Sección 2 (Correlativo y Firmas) y Sección 5 (Reglas R7 y R9)
  * **Detalle**: Si el inspector completa la inspección y firma sin conexión a internet, la ITO aún posee un correlativo provisional asignado localmente. La regla R7 exige generar en el servidor un token seguro de 256 bits y su hash para las firmas posteriores. El flujo no define qué ocurre si el inspector intenta avanzar a `por_firmar` sin red.
  * **Corrección**: Establecer que la transición al estado `por_firmar` y la generación de tokens/enlaces de firma externa quedan encoladas en estado pendiente hasta que el dispositivo recupere conexión y sincronice la ITO, obteniendo el correlativo definitivo del servidor.

* **Hallazgo 2.3**: Vencimiento del token público de firma sin mecanismo de renovación.
  * **Gravedad**: Media
  * **Sección**: Sección 5 (Regla R7) y Sección 7 (Pantallas y rutas)
  * **Detalle**: La regla R7 indica que el token de firma pública vence a los 7 días. Si el token expira mientras la ITO sigue en `por_firmar`, el cliente/contratista no podrá firmar, pero el flujo no prevé cómo solicitar o regenerar un enlace válido desde la aplicación.
  * **Corrección**: Incluir en la pantalla `/inspecciones/:id/firmas` y en el backend una acción para "Reenviar/Regenerar enlace de firma", la cual invalida el token expirado en `ito_tokens_firma` y crea uno nuevo notificando por correo.

---

### 3. Modelo de datos

* **Hallazgo 3.1**: Riesgo de pérdida de datos por colisión de sincronización en el JSONB monolítico (`itos.data`).
  * **Gravedad**: Alta
  * **Sección**: Sección 4 (Modelo de datos - Decisión 1) y Sección 10 (Riesgos)
  * **Detalle**: Guardar ítems, avances de partidas, observaciones no planificadas, marcas e historial dentro de un único objeto JSONB (`itos.data`) bajo la estrategia "gana el último" (Last-Write-Wins) es peligroso. Si el supervisor modifica la cabecera o asignación en la web mientras el inspector evalúa ítems en terreno offline, la sincronización posterior del inspector sobrescribirá por completo la fila en Neon, borrando los cambios del supervisor (o viceversa). Además, enviar el JSONB completo en cada guardado de una sola observación genera un volumen de red innecesario.
  * **Corrección**: Desacoplar del JSONB monolítico las entidades de alta frecuencia de cambio. Crear las tablas independientes `ito_observaciones` y `ito_marcas` con su propio `uuid_sync` y `updated_at`. Mantener en `itos.data` únicamente la cabecera y el estado del checklist.

* **Hallazgo 3.2**: Incompatibilidad de coordenadas normalizadas (0 a 1) ante cambios de resolución entre revisiones de planos.
  * **Gravedad**: Media
  * **Sección**: Sección 4 (Modelo de datos - Decisión 2) y Sección 5 (Regla R11)
  * **Detalle**: El plan almacena marcas con coordenadas X/Y de 0 a 1 asociadas al plano. Si la `Rev B` de un plano se sube con una relación de aspecto o resolución distinta a la `Rev A` (por ejemplo, recortes de margen o cambio de formato A3 a A4), las coordenadas relativas 0-1 proyectarán las marcas en posiciones geométricas incorrectas sobre la imagen.
  * **Corrección**: Guardar en `planos.data.revisiones` el ancho, alto y *aspect ratio* exacto del archivo subido. Si una nueva revisión altera la relación de aspecto, el sistema debe alertar al usuario o solicitar una recalibración del punto de origen de las marcas.

* **Hallazgo 3.3**: Fragmentación de trazabilidad por correlativo provisional offline.
  * **Gravedad**: Media
  * **Sección**: Sección 2 (Decisiones - Correlativo)
  * **Detalle**: Si los datos offline se identifican temporalmente con un ID local y se generan borradores de informe o registros visuales con este código provisional, la reasignación del correlativo definitivo en el servidor (`0042.07.NORTEC.11.26`) romperá la referencia visual que el inspector vio en su pantalla durante el trabajo de campo.
  * **Corrección**: Ocultar la máscara del correlativo formal mientras la ITO esté en estado provisional offline (mostrando la etiqueta "Pendiente de Sincronización"). El correlativo definitivo solo se estampará y visualizará una vez confirmado por el servidor.

---

### 4. Seguridad

* **Hallazgo 4.1**: Bloqueo permanente de la cola de sincronización Dexie ante rechazo 409 por inmutabilidad.
  * **Gravedad**: Alta
  * **Sección**: Sección 5 (Regla R4) y Sección 10 (Riesgos)
  * **Detalle**: La regla R4 especifica que el servidor rechaza con HTTP 409 cualquier intento de escritura sobre una ITO en estado `aprobada`. Si un dispositivo estuvo sin conexión, el inspector modificó algo localmente y entretanto la ITO fue aprobada en el servidor, al recuperar la red la cola de sincronización de Dexie intentará subir el cambio local, recibirá un 409 y fallará. Si el cliente no sabe interpretar el 409 para descartar la mutación, la cola de sincronización se detendrá indefinidamente para todas las demás tablas del sistema.
  * **Corrección**: Implementar en el motor de sincronización del cliente un manejador de excepciones HTTP 409 específico para la tabla `itos`: si la mutación es rechazada por inmutabilidad (R4), la mutación local debe ser eliminada de la cola de Dexie y la base de datos local debe ser sobrescrita con la versión inmutable enviada por el servidor.

* **Hallazgo 4.2**: Ineficiencia de Rate-Limiting por IP en Vercel Serverless para la ruta pública de firma.
  * **Gravedad**: Alta
  * **Sección**: Sección 5 (Regla R7) y Sección 10 (Riesgos)
  * **Detalle**: La regla R7 menciona "límite de intentos por IP" en la ruta pública `/liberar/:token`. Las funciones serverless de Vercel son *stateless* y no comparten memoria entre instancias. Un control de tasa por IP implementado en memoria dentro de la función no impedirá ataques de fuerza bruta contra los hashes de los tokens si las peticiones caen en distintas instancias.
  * **Corrección**: Requerir explícitamente en la arquitectura el uso de un almacén de estado distribuido con latencia mínima (como Upstash Redis o Vercel KV) para ejecutar el middleware de rate-limiting en la ruta pública `/liberar/:token`.

* **Hallazgo 4.3**: Exposición excesiva de datos en el endpoint público `/liberar/:token`.
  * **Gravedad**: Media
  * **Sección**: Sección 7 (Pantallas y rutas)
  * **Detalle**: Si el endpoint que alimenta la ruta pública `/liberar/:token` retorna la entidad ITO completa, expondrá metadatos internos del cliente, historial de sincronización, IDs de base de datos y datos de otros participantes a un usuario no autenticado.
  * **Corrección**: Diseñar un endpoint específico (`GET /api/public/signature-request/:token`) que retorne exclusivamente un DTO sanitizado con los campos indispensables para la firma (nombre de obra, resumen de ítems, observaciones abiertas y nombres de los firmantes).

---

### 5. Orden de las fases

* **Hallazgo 5.1**: La Fase 1 está sobredimensionada y acumula demasiado riesgo estructural.
  * **Gravedad**: Media
  * **Sección**: Sección 9 (Fases)
  * **Detalle**: La Fase 1 abarca la creación de la base de datos Dexie v17, gestión de obras/partidas, CRUD completo de plantillas con versionado, ejecución del checklist, mediciones, avance de partidas, observaciones no planificadas, captura de evidencia (fotos/PDFs), interfaz del panel, menú y permisos. Agrupar todo esto en una sola fase genera un PR masivo difícil de revisar y probar adecuadamente.
  * **Corrección**: Dividir la Fase 1 en dos sub-fases:
    * **Fase 1A (Estructura y Plantillas)**: Dexie v17, esquemas Postgres, entidades de obras/partidas, gestor de plantillas versionadas y permisos de menú.
    * **Fase 1B (Ejecución Offline y Evidencia)**: Formulario de ejecución de la ITO, motor de checklist, captura de observaciones, mediciones y compresión/subida de evidencia fotográfica.

* **Hallazgo 5.2**: Pruebas de inmutabilidad y seguridad diferidas a la última fase.
  * **Gravedad**: Media
  * **Sección**: Sección 9 (Fases - Fase 5)
  * **Detalle**: Las pruebas de seguridad (aislamiento de datos entre clientes, inmutabilidad R4 en `/api/sync` y validación de tokens) se han programado para la Fase 5 ("Endurecimiento"). Si se descubren fallos en el aislamiento multitenant o en el validador de sincronización en esta etapa final, se requerirá refactorizar el código desarrollado en las Fases 1, 2 y 3.
  * **Corrección**: Mover los tests de integración de seguridad (validador R4 en `/api/sync` y aislamiento por `cliente_id`) como criterio de aceptación obligatorio al cierre de la Fase 1B y Fase 3 respectivamente.

---

### 6. Puntos abiertos

Los puntos abiertos 1 a 5 de la Sección 11 **bloquean el inicio de la Fase 1** porque alteran el modelo de base de datos, la máquina de estados o la infraestructura. A continuación se presenta la resolución recomendada para cada uno:

1. **Cierre de una observación crítica no planificada (Punto 1)**:
   * **Bloqueante**: Sí.
   * **Recomendación**: Definir que se cierra **exclusivamente por re-inspección del inspector**. El inspector debe marcar la observación como "resuelta" adjuntando foto de evidencia en una re-inspección, manteniendo la misma regla estricta que los ítems "No cumple".
2. **Entidad Obra (Punto 2)**:
   * **Bloqueante**: Sí.
   * **Recomendación**: Modelar `obras` como una **entidad nueva e independiente** ligada a `cliente_id`, conteniendo un campo opcional `sucursal_id`. No reutilizar la tabla de sucursales existente para evitar acoplamiento no deseado.
3. **Código corto del cliente (Punto 3)**:
   * **Bloqueante**: Sí.
   * **Recomendación**: Agregar la columna `codigo_corto VARCHAR(10)` a la tabla de clientes mediante migración en la Fase 1A. Asignar como valor por defecto las primeras 6 letras del nombre del cliente en mayúsculas y permitir al administrador editarlo.
4. **Firmas al reabrir (Punto 4)**:
   * **Bloqueante**: Sí.
   * **Recomendación**: Al reabrir una ITO `observada` para re-inspección, **las firmas anteriores se invalidan y se archivan**. Se debe requerir el flujo completo de firmas de nuevo (Inspector → Contratista → Cliente) sobre el estado actualizado.
5. **Aviso al vencer un hallazgo (Punto 5)**:
   * **Bloqueante**: Sí.
   * **Recomendación**: Implementar un **Vercel Cron Job** (`/api/cron/check-expirations`) configurado en `vercel.json` para ejecutarse una vez al día a las 00:00 UTC. La función consultará hallazgos vencidos en Neon y disparará las notificaciones usando `api/communications.ts`.

---

### 7. Veredicto

**LISTO CON CONDICIONES**

No se debe iniciar el desarrollo de la Fase 1 hasta que se cumplan las siguientes tres condiciones:

1. **Resolver formalmente los Puntos Abiertos 1 al 5** integrando las recomendaciones descritas en la Sección 6 de este informe dentro del plan.
2. **Corregir la arquitectura de datos del JSONB monolítico** (Hallazgo 3.1) separando las tablas `ito_observaciones` e `ito_marcas` antes de definir los esquemas de Dexie v17 y PostgreSQL.
3. **Especificar el manejo del error HTTP 409 en el motor de sincronización de Dexie** (Hallazgo 4.1) para prevenir el bloqueo de la cola offline ante intentos de modificación de ITOs aprobadas.
