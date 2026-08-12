# Pendientes de QA y preparación del piloto

**Estado:** QA pausado por decisión del responsable del proyecto  
**Fecha de actualización:** 10 de agosto de 2026  
**Entorno:** `https://cmms-hvac-pro-ia-studio.vercel.app`

Este documento conserva las verificaciones que deben retomarse antes de declarar
el sistema listo para un piloto controlado. No contiene PIN, contraseñas, API
keys ni otros secretos.

## Reinicio ejecutado el 12 de agosto de 2026

- Se ejecutó un borrón y cuenta nueva controlado en producción.
- Se conservaron la cuenta administrativa operativa y los catálogos/seed base.
- Se eliminaron usuarios QA anteriores, SETPRO, QA Móvil y todos los registros
  operativos previos.
- Todas las sesiones existentes fueron revocadas.
- La versión 16 de IndexedDB descarta datos y colas antiguas al actualizar la
  PWA, evitando que un dispositivo vuelva a subir registros eliminados.
- Se creó la campaña aislada `QA-20260812`, asignada a su propia casa matriz.
- La campaña incluye cinco perfiles QA, un activo, un repuesto, un mantenimiento,
  una orden abierta y un informe en borrador. Estos registros deben conservarse
  durante la revisión del usuario.

## 1. QA funcional por perfil

Ejecutar la matriz completa con administrador, supervisor, técnico,
contratista, cliente y visita:

- Comprobar funciones permitidas y accesos rechazados para cada perfil.
- Probar clientes, sucursales, equipos, inventario, mantenimientos y calendario.
- Probar el flujo completo de órdenes de servicio e informes.
- Confirmar que una orden admite múltiples informes y múltiples equipos.
- Impedir el cierre cuando exista algún informe sin finalizar.
- Exigir la firma de la orden para cerrarla.
- Confirmar que el informe conserva únicamente la firma del técnico.
- Impedir eliminar una orden que tenga informes relacionados.
- Revisar portada, resumen y descarga del PDF después de los cambios recientes.
- Mantener los datos creados durante esta campaña para que el usuario pueda
  revisarlos; clasificarlos o eliminarlos solamente al cerrar formalmente el QA.

## 2. Dispositivos, navegadores y PWA

- Chrome Android: instalación, cierre, reapertura y actualización tras deploy.
- Safari iPhone y, de ser posible, una tablet Android o iPad.
- Modo avión, creación o edición offline y persistencia de la cola.
- Recuperación de conexión y sincronización única, sin pérdida ni duplicados.
- Apertura offline de rutas visitadas y no visitadas.
- Dos pestañas o instancias PWA abiertas durante una actualización.
- Cámara y escáner QR, firma táctil, cambio de mano de controles móviles,
  menú lateral, botones flotantes y modo oscuro.

### Logo por cliente

- Crear un cliente cargando un logo PNG, JPG y WEBP en pruebas separadas.
- Editar un cliente existente, reemplazar su logo y comprobar la sincronización.
- Confirmar el logo correcto en selector, listado, detalle, orden e informe.
- Descargar los PDF de orden e informe y verificar nitidez y proporción.
- Quitar el logo y confirmar que vuelve a utilizarse la identidad corporativa de
  respaldo sin conservar una imagen antigua en caché.
- Probar rechazo de archivos no permitidos, corruptos y mayores de 2 MB.

## 3. Seguridad pendiente de validación externa

- Configurar y probar `SECURITY_ALERT_WEBHOOK_URL` o una alternativa equivalente.
- Probar IDOR/BOLA entre clientes para activos, órdenes, informes y usuarios.
- Ejecutar DAST/fuzzing autenticado en un entorno controlado.
- Incorporar MFA para administradores antes de operación comercial sensible.
- Contratar un pentest independiente antes del lanzamiento comercial.
- Aplicar la política de seguridad de dispositivos a los equipos con uso offline.

## 4. Operación y proveedores

- Definir RPO/RTO de Neon y ejecutar una restauración de prueba en una rama
  aislada.
- Configurar alertas para errores 5xx, sincronizaciones fallidas y correos
  rechazados o rebotados.
- Verificar el dominio `.cl` en Resend y reemplazar el remitente temporal.
- Enviar correos hacia destinatarios externos distintos del propietario de
  Resend y comprobar entrega, apertura y adjunto.
- Migrar Vercel Hobby a Pro antes del uso comercial continuo.
- Revisar logs de Vercel, sincronización y Resend durante los primeros usuarios.

## 5. Rendimiento y concurrencia

- Mantener al menos cinco usuarios concurrentes durante 15 minutos.
- Probar ediciones simultáneas de datos relacionados.
- Ejercitar sincronización, PDF y correo bajo concurrencia.
- Confirmar ausencia de errores 5xx, duplicados y relaciones huérfanas.
- Repetir con el volumen esperado del piloto.

## 6. Accesibilidad manual

- Recorrer los flujos principales únicamente con teclado.
- Comprobar foco visible, orden lógico y retorno del foco al cerrar modales.
- Confirmar que los errores de formularios son anunciados correctamente.
- Probar NVDA con Chrome o Edge en Windows.
- Probar VoiceOver con Safari en iPhone.
- Definir una alternativa accesible para usuarios que no puedan utilizar el
  lienzo de firma.

## 7. Documentación por actualizar

- Corregir en `PLAN_QA_INSITU.md` las referencias heredadas a PIN de cuatro
  dígitos; la política vigente exige exactamente seis.
- Sustituir los resultados históricos de `QA_REPORT.md` por un informe de cierre
  actualizado; contiene verificaciones antiguas que ya no representan el deploy.
- Registrar evidencias, versión desplegada, dispositivo y resultado cuando se
  retome cada caso.

## 8. Cuentas temporales y cierre de campaña

Existen cuentas temporales para supervisor, técnico, contratista, cliente y
visita asignadas a EECOL. Sus credenciales se entregaron fuera de este documento.

Al finalizar el QA:

- Desactivar o eliminar las cuentas temporales.
- Revocar sus sesiones.
- Reemplazar cualquier PIN genérico compartido durante las pruebas.
- Rotar el PIN del administrador si fue compartido por un canal no seguro.
- Revisar y clasificar todos los registros creados durante la campaña.

## Criterio de cierre

El QA puede cerrarse cuando los flujos críticos funcionen en los seis perfiles,
las pruebas PWA físicas y de sincronización estén aprobadas, no existan defectos
bloqueantes o altos sin tratamiento y las evidencias queden incorporadas al
informe final.
