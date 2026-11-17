# Encargo de revisión del Plan Maestro ITO

Pega este texto y, a continuación, el contenido completo de `PLAN_MAESTRO_ITO.md`.

---

Actúa como revisor técnico independiente. Te entrego el plan de un módulo nuevo (ITO:
Inspección Técnica de Obra) para una aplicación existente: React 19 + Vite, Dexie
(offline-first con cola de sincronización), backend duplicado en Express y funciones de
Vercel, base Neon PostgreSQL con tablas JSONB por cliente. Todavía no hay código.

Revisa el plan y responde, en este orden:

1. **Contradicciones internas**: reglas, estados o decisiones que se contradigan entre sí.
2. **Huecos del flujo**: situaciones que el ciclo de vida no cubre (rechazos, reaperturas,
   vencimientos, cambios de inspector, ITO sin plantilla, trabajo sin conexión).
3. **Modelo de datos**: riesgos de guardar ítems, marcas y observaciones dentro del JSON de
   la ITO; conflictos de sincronización; tamaño; correlativo por cliente y año bajo concurrencia.
4. **Seguridad**: la ruta pública de firma, la inmutabilidad tras aprobar, el aislamiento
   entre clientes y el endpoint genérico de sincronización.
5. **Orden de las fases**: dependencias mal ordenadas o fases demasiado grandes.
6. **Puntos abiertos**: cuáles bloquean el inicio y qué recomiendas para cada uno.
7. **Veredicto**: listo para iniciar la Fase 1, listo con condiciones, o no listo.

Para cada hallazgo indica gravedad (alta, media, baja), la sección del plan y una corrección
concreta. No reescribas el plan; no elogies; si algo está bien, no lo menciones.
