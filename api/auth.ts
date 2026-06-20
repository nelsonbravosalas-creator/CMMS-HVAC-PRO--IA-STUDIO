import { getDb } from './_db.js';
import { signToken } from './_auth.js';
import { hashPin, needsArgon2Upgrade, verifyPin } from '../server/passwords.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    const correo = String(req.body.correo || req.body.email || '').trim();
    const pin = String(req.body.pin || req.body.password || '').trim();
    if (!correo || !pin) return res.status(400).json({ success: false, error: 'Correo y PIN requeridos' });

    const emailLower = correo ? correo.toLowerCase() : '';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    // Anti brute-force: 5 intentos fallidos bloquean durante 30 minutos.
    if (emailLower) {
      const lockWindowStart = new Date(Date.now() - 30 * 60 * 1000);
      const failuresCount = await sql`SELECT COUNT(*)::int as count FROM cmms_auth_failures WHERE LOWER(email) = ${emailLower} AND attempted_at > ${lockWindowStart}`;
      
      if (failuresCount[0] && failuresCount[0].count >= 5) {
        const oldestFailure = await sql`SELECT attempted_at FROM cmms_auth_failures WHERE LOWER(email) = ${emailLower} AND attempted_at > ${lockWindowStart} ORDER BY attempted_at ASC LIMIT 1`;
        let delay = 1800;
        if (oldestFailure[0]) {
          const oldestTime = new Date(oldestFailure[0].attempted_at).getTime();
          delay = Math.ceil((oldestTime + 30 * 60 * 1000 - Date.now()) / 1000);
        }
        console.warn({ event: "auth_lockout", email: emailLower, ip });
        return res.status(401).json({
          success: false,
          error: "account_locked",
          message: "Cuenta bloqueada temporalmente por demasiados intentos fallidos.",
          retryAfter: delay > 0 ? delay : 1800
        });
      }
    }

    const rows = await sql`SELECT uuid_sync, id, nombre, correo, data, perfil, activo, COALESCE(pin_hash, pin) AS stored_pin_hash, cliente_id, data->>'rol' as json_rol, data->>'email' as json_email FROM users WHERE LOWER(correo) = ${emailLower} OR LOWER(data->>'email') = ${emailLower}`;
    
    if (rows.length === 0) {
      if (emailLower) {
        await sql`INSERT INTO cmms_auth_failures (email, ip, attempted_at) VALUES (${emailLower}, ${ip}, NOW())`;
      }
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const user = rows[0];
    if (!user.activo) {
       return res.status(401).json({ success: false, error: 'Usuario inactivo' });
    }

    const storedPin = user.stored_pin_hash || (user.data && user.data.pin);
    const isMatch = await verifyPin(storedPin, pin);

    if (!isMatch) {
       if (emailLower) {
         await sql`INSERT INTO cmms_auth_failures (email, ip, attempted_at) VALUES (${emailLower}, ${ip}, NOW())`;
       }
       return res.status(401).json({ success: false, error: 'PIN inválido' });
    }

    // Auth succeeded! Clear block counter
    if (emailLower) {
      await sql`DELETE FROM cmms_auth_failures WHERE LOWER(email) = ${emailLower}`;
    }

    if (needsArgon2Upgrade(storedPin)) {
      const upgradedHash = await hashPin(pin);
      await sql`UPDATE users SET pin_hash = ${upgradedHash}, pin = NULL, updated_at = ${Date.now()} WHERE uuid_sync = ${user.uuid_sync}`;
    }

    const returnUser = {
      id: user.id || (user.data && user.data.id),
      nombre: user.nombre || (user.data && user.data.nombre),
      correo: user.correo || (user.data && user.data.email) || correo,
      perfil: user.perfil || user.json_rol || (user.data && user.data.rol) || 'tecnico',
      cliente_id: user.cliente_id || (user.data && user.data.cliente_id),
      activo: true
    };

    const tenantRows = await sql`SELECT cliente_id FROM user_clientes WHERE user_id = ${user.uuid_sync}`;
    const clienteIds = tenantRows.map((row: any) => row.cliente_id);
    const token = signToken({
      id: returnUser.id,
      uuid_sync: user.uuid_sync,
      perfil: returnUser.perfil,
      cliente_id: returnUser.cliente_id,
      cliente_ids: clienteIds
    });

    return res.json({ success: true, user: { ...returnUser, cliente_ids: clienteIds }, token });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: 'Servicio no disponible', offline: true });
  }
}
