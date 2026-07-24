import { getDb } from '../server/vercel/db.js';
import { requireAuth, setAuthCookie, signToken } from '../server/vercel/auth.js';
import { hashPin, needsArgon2Upgrade, verifyPin } from '../server/passwords.js';

export default async function handler(req: any, res: any) {
  const action = String(req.query?.action || 'login');
  if (action === 'health') {
    return res.status(200).json({ status: 'ok' });
  }
  if (action === 'logout') {
    return handleLogout(req, res);
  }
  if (action === 'change-pin') {
    return handleChangePin(req, res);
  }
  if (action === 'biometric-verify') {
    return handleBiometricVerify(req, res);
  }

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
    const assignedClients = [];
    for (const clienteId of clienteIds) {
      const clientRows = await sql`
        SELECT * FROM clientes
        WHERE (id = ${clienteId} OR uuid_sync = ${clienteId})
          AND deleted_at IS NULL
        LIMIT 1
      `;
      if (clientRows[0]) {
        const rawData = clientRows[0].data;
        let parsedData: any = {};
        if (rawData && typeof rawData === 'object') {
          parsedData = rawData;
        } else if (typeof rawData === 'string' && /^[{\[]/.test(rawData.trim())) {
          try {
            parsedData = JSON.parse(rawData);
          } catch {
            parsedData = {};
          }
        }
        assignedClients.push({ ...parsedData, ...clientRows[0] });
      }
    }
    const defaultClientId = returnUser.cliente_id || clienteIds[0] || null;
    const token = signToken({
      id: returnUser.id,
      uuid_sync: user.uuid_sync,
      perfil: returnUser.perfil,
      cliente_id: defaultClientId,
      cliente_ids: clienteIds
    });
    setAuthCookie(res, token);

    return res.json({
      success: true,
      user: {
        ...returnUser,
        cliente_id: defaultClientId,
        cliente_ids: clienteIds,
        assigned_clients: assignedClients
      }
    });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: 'Servicio no disponible', offline: true });
  }
}

function handleLogout(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `cmms_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
  return res.json({ success: true });
}

async function handleChangePin(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authUser: any = requireAuth(req, res);
  if (!authUser) return;

  const currentPin = String(req.body.currentPin || '').trim();
  const newPin = String(req.body.newPin || '').trim();
  if (!currentPin || newPin.length < 4) {
    return res.status(400).json({ success: false, error: 'PIN actual y nuevo PIN válido son requeridos' });
  }

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT uuid_sync, COALESCE(pin_hash, pin) AS stored_pin_hash
      FROM users
      WHERE uuid_sync = ${authUser.uuid_sync} OR id = ${authUser.id}
      LIMIT 1
    `;
    const storedPinHash = rows[0]?.stored_pin_hash || rows[0]?.pin_hash || rows[0]?.pin;
    if (!rows[0] || !(await verifyPin(storedPinHash, currentPin))) {
      return res.status(401).json({ success: false, error: 'El PIN actual es incorrecto' });
    }

    const nextHash = await hashPin(newPin);
    await sql`
      UPDATE users
      SET pin_hash = ${nextHash}, pin = NULL, updated_at = ${Date.now()}
      WHERE uuid_sync = ${rows[0].uuid_sync}
    `;
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

function handleBiometricVerify(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const authUser = requireAuth(req, res);
  if (!authUser) return;
  return res.status(501).json({
    success: false,
    error: 'Autenticación biométrica temporalmente deshabilitada'
  });
}
