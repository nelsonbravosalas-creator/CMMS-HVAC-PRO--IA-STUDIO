# QA de accesibilidad

## Qué se revisa

La prueba con teclado confirma que todas las acciones se pueden alcanzar con `Tab` y `Shift+Tab`, activar con `Enter` o `Espacio`, cerrar con `Escape` y utilizar sin quedar atrapado en un modal.

La prueba con lector de pantalla confirma que cada control anuncia un nombre, función, estado y error comprensibles. En Windows se recomienda NVDA con Chrome o Edge; en iPhone, VoiceOver con Safari.

## Estado

- El inicio de sesión relaciona sus etiquetas con los campos de correo y PIN.
- El botón para mostrar u ocultar el PIN expone nombre y estado accesibles.
- El indicador de notificaciones se anuncia como estado y no aparenta ser un botón sin acción.

## Prueba manual pendiente

1. Recorrer login, menú, selector, equipos, clientes, inventario, órdenes e informes sin usar mouse.
2. Comprobar foco visible y orden lógico.
3. Abrir y cerrar menú y modales, confirmando que el foco regresa al control de origen.
4. Completar formularios incorrectamente y escuchar los errores.
5. Firmar o proporcionar una alternativa accesible cuando el lienzo de firma no pueda utilizarse.
6. Repetir con NVDA y VoiceOver en dispositivos físicos.
