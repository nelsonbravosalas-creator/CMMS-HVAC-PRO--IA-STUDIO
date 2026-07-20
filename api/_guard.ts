// [SEC C-01/C-02/A-02/A-03] Guard para endpoints de bootstrap/migración destructivos.
//
// Estos endpoints (init-db, migrate-defaults, import-data, clone-db) pueden borrar
// o reescribir la base de datos completa, por lo que NO pueden depender de un JWT de
// usuario (init-db crea la propia tabla de usuarios). Se protegen con un secreto de
// infraestructura fuera de banda y quedan DESHABILITADOS por defecto si no está
// configurado — nunca deben ser invocables por un GET público.
//
// Uso: definir DB_BOOTSTRAP_SECRET en el entorno y enviar el header
//   x-bootstrap-secret: <secreto>
// Si la variable no está definida, el endpoint responde 403 y no ejecuta nada.

export function requireBootstrapSecret(req: any, res: any): boolean {
  const configured = process.env.DB_BOOTSTRAP_SECRET;
  if (!configured) {
    res.status(403).json({
      success: false,
      error: 'Endpoint de bootstrap deshabilitado. Configure DB_BOOTSTRAP_SECRET para habilitarlo.',
    });
    return false;
  }
  const provided = req.headers?.['x-bootstrap-secret'];
  if (!provided || provided !== configured) {
    res.status(401).json({ success: false, error: 'No autorizado - secreto de bootstrap inválido' });
    return false;
  }
  return true;
}
