# Operación, respaldos y alertas

## Objetivos de recuperación

Antes del piloto, el responsable del sistema debe aprobar:

- **RPO:** pérdida máxima aceptable de datos. Propuesta inicial: 24 horas.
- **RTO:** tiempo máximo para recuperar el servicio. Propuesta inicial: 4 horas.
- **Responsable:** una persona titular y una suplente con acceso a Neon y Vercel.

## Estrategia de respaldo para Neon

1. Mantener habilitada la ventana de restauración instantánea del proyecto.
2. Crear un snapshot antes de migraciones, importaciones, limpiezas o cambios masivos.
3. Programar snapshots diarios o semanales cuando el plan contratado lo permita.
4. Generar además un `pg_dump` semanal cifrado y guardarlo fuera de Neon. Esto protege frente a pérdida de acceso al proveedor o errores que superen la ventana de restauración.
5. Conservar un respaldo mensual durante 12 meses para el piloto; ajustar la retención según requisitos contractuales.
6. Ensayar una restauración trimestral en una rama aislada. Un respaldo no se considera confiable hasta que se prueba.

Neon permite restauración a un punto dentro de la ventana configurada y snapshots. Las funciones, límites y retención dependen del plan vigente; deben revisarse antes de fijar el RPO contractual.

## Procedimiento ante pérdida o corrupción

1. Detener escrituras o colocar el sistema en mantenimiento.
2. Registrar la hora estimada del incidente.
3. Usar la vista previa o una rama temporal para comprobar el punto correcto.
4. Restaurar primero en una rama aislada y validar usuarios, clientes, sucursales, activos y órdenes.
5. Autorizar la restauración productiva por dos personas.
6. Verificar la aplicación, documentar el incidente y conservar temporalmente el estado anterior.

## Alertas

### Estado actual

- Las notificaciones por correo para despliegues fallidos están habilitadas en Vercel.
- Los errores HTTP 5xx, fallos de sincronización y rechazos de Resend quedan registrados en sus respectivos logs.
- La API emite eventos estructurados `cmms_security_alert` para fallos críticos de autenticación, sincronización y correo.
- Si se configura `SECURITY_ALERT_WEBHOOK_URL`, esos eventos se envían también por HTTPS a un receptor externo; `SECURITY_ALERT_WEBHOOK_TOKEN` agrega autenticación Bearer.
- Las alertas personalizadas y de anomalías de Observability no están disponibles en el plan Hobby comprobado.

### Configuración recomendada para producción

- **HTTP 5xx:** alertar si ocurren 3 errores en 5 minutos.
- **Sincronización:** alertar si una operación permanece pendiente más de 15 minutos o acumula 3 fallos.
- **Correo:** alertar ante eventos `bounced`, `complained` o `delivery_delayed` recibidos por webhook de Resend.
- Enviar las alertas a un correo operativo compartido y, para incidentes críticos, a un canal secundario que no dependa de Resend.
- Al migrar a Pro, crear reglas en Vercel Observability o integrar un servicio externo de monitoreo.

### Activación del webhook

1. Crear en el proveedor de monitoreo un endpoint HTTPS que acepte JSON.
2. Agregar `SECURITY_ALERT_WEBHOOK_URL` y, si corresponde, `SECURITY_ALERT_WEBHOOK_TOKEN` como variables protegidas de Producción y Preview en Vercel.
3. Hacer un nuevo despliegue.
4. Provocar un fallo controlado en Preview y confirmar que el receptor obtiene `event`, `severity`, `details` y `timestamp`.
5. No usar una URL que contenga credenciales ni registrar el token en capturas o documentos.

## Revisión operativa

- Diario durante el piloto: despliegues, 5xx, sincronizaciones y correos rechazados.
- Semanal: capacidad de Neon/Vercel, usuarios activos y registros dados de baja.
- Mensual: accesos administrativos, rotación de secretos y prueba de un respaldo.
