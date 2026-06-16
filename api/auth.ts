import { getDb } from './_db.js';
import { signToken } from './_auth.js';
import bcrypt from 'bcryptjs';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    const { correo, pin } = req.body;
    if (!correo || !pin) return res.status(400).json({ success: false, error: 'Correo y PIN requeridos' });

    const emailLower = correo ? correo.toLowerCase() : '';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    // Anti brute-force: check lockout for the given email in the last 15 minutes
    if (emailLower) {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const failuresCount = await sql`SELECT COUNT(*)::int as count FROM cmms_auth_failures WHERE LOWER(email) = ${emailLower} AND attempted_at > ${fifteenMinsAgo}`;
      
      if (failuresCount[0] && failuresCount[0].count >= 5) {
        const oldestFailure = await sql`SELECT attempted_at FROM cmms_auth_failures WHERE LOWER(email) = ${emailLower} AND attempted_at > ${fifteenMinsAgo} ORDER BY attempted_at ASC LIMIT 1`;
        let delay = 900;
        if (oldestFailure[0]) {
          const oldestTime = new Date(oldestFailure[0].attempted_at).getTime();
          delay = Math.ceil((oldestTime + 15 * 60 * 1000 - Date.now()) / 1000);
        }
        console.warn({ event: "auth_lockout", email: emailLower, ip });
        return res.status(401).json({
          success: false,
          error: "account_locked",
          message: "Cuenta bloqueada temporalmente por demasiados intentos fallidos.",
          retryAfter: delay > 0 ? delay : 900
        });
      }
    }

    const rows = await sql`SELECT id, nombre, correo, data, perfil, activo, pin, cliente_id, data->>'rol' as json_rol, data->>'email' as json_email FROM users WHERE LOWER(correo) = ${emailLower} OR LOWER(data->>'email') = ${emailLower}`;
    
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

    const storedPin = user.pin || (user.data && user.data.pin);
    let isMatch = false;
    
    if (storedPin && storedPin.startsWith('$2')) {
       isMatch = bcrypt.compareSync(pin, storedPin);
    } else {
       if (process.env.NODE_ENV === 'production') {
         console.warn({ event: "auth_plaintext_pin_rejected", email: emailLower, ip });
         isMatch = false;
       } else {
       isMatch = storedPin === pin;
       }
    }

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

    const returnUser = {
      id: user.id || (user.data && user.data.id),
      nombre: user.nombre || (user.data && user.data.nombre),
      correo: user.correo || (user.data && user.data.email) || correo,
      perfil: user.perfil || user.json_rol || (user.data && user.data.rol) || 'tecnico',
      cliente_id: user.cliente_id || (user.data && user.data.cliente_id),
      activo: true
    };
    
    const token = signToken({ id: returnUser.id, perfil: returnUser.perfil, cliente_id: returnUser.cliente_id });

    return res.json({ success: true, user: returnUser, token });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: 'Servicio no disponible', offline: true });
  }
}
