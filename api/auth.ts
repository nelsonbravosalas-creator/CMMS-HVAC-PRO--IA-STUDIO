import { getDb } from '../server/vercel/db.js';
import { createSession, requireAuth, setAuthCookie, verifyToken } from '../server/vercel/auth.js';
import { hashPin, needsArgon2Upgrade, verifyPin } from '../server/passwords.js';
import {
  consumeRateLimit,
  emitOperationalAlert,
  isValidCredential,
  privacyHash,
  rejectRateLimit,
  rejectOversizedRequest,
  rejectUntrustedOrigin,
  requestIp,
  writeSecurityAudit
} from '../server/vercel/security.js';

const DUMMY_PIN_HASH = hashPin('000000');
const INVALID_CREDENTIALS = 'Correo o PIN inválido';

export default async function handler(req: any, res: any) {
  const action = String(req.query?.action || 'login');
  if (action === 'health') {
    return res.status(200).json({ status: 'ok' });
  }
  if (action === 'logout') {
    return await handleLogout(req, res);
  }
  if (action === 'change-pin') {
    return handleChangePin(req, res);
  }
  if (action === 'biometric-verify') {
    return await handleBiometricVerify(req, res);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rejectUntrustedOrigin(req, res)) return;
  if (rejectOversizedRequest(req, res, 16 * 1024)) return;

  try {
    const sql = getDb();
    const correo = String(req.body.correo || req.body.email || '').trim();
    const pin = String(req.body.pin || req.body.password || '').trim();
    if (!correo || !pin) return res.status(400).json({ success: false, error: 'Correo y PIN requeridos' });
    if (!isValidCredential(pin)) {
      return res.status(401).json({ success: false, error: INVALID_CREDENTIALS });
    }

    const emailLower = correo ? correo.toLowerCase() : '';
    const ip = requestIp(req);
    const [ipLimit, accountLimit, accountIpLimit] = await Promise.all([
      consumeRateLimit(sql, 'auth-ip', ip, 20, 15 * 60 * 1000),
      consumeRateLimit(sql, 'auth-account', emailLower, 30, 60 * 60 * 1000),
      consumeRateLimit(sql, 'auth-account-ip', `${emailLower}:${ip}`, 5, 15 * 60 * 1000)
    ]);
    const rejectedLimit = [ipLimit, accountLimit, accountIpLimit].find((result) => !result.allowed);
    if (rejectedLimit) {
      await writeSecurityAudit(sql, {
        action: 'auth.rate_limited',
        entityType: 'user',
        entityId: privacyHash(emailLower),
        outcome: 'denied',
        details: { ipHash: privacyHash(ip) }
      });
      await emitOperationalAlert('auth.rate_limited', 'warning', {
        accountHash: privacyHash(emailLower),
        ipHash: privacyHash(ip)
      });
      return rejectRateLimit(res, rejectedLimit);
    }

    const rows = await sql`SELECT uuid_sync, id, nombre, correo, data, perfil, activo, COALESCE(pin_hash, pin) AS stored_pin_hash, cliente_id, data->>'rol' as json_rol, data->>'email' as json_email FROM users WHERE LOWER(correo) = ${emailLower} OR LOWER(data->>'email') = ${emailLower}`;
    
    const user = rows[0];
    const storedPin = user?.stored_pin_hash || (user?.data && user.data.pin) || await DUMMY_PIN_HASH;
    const isMatch = await verifyPin(storedPin, pin);

    if (!user || !user.activo || !isMatch) {
       await writeSecurityAudit(sql, {
         action: 'auth.login',
         entityType: 'user',
         entityId: privacyHash(emailLower),
         outcome: 'failure',
         details: { ipHash: privacyHash(ip) }
       });
       return res.status(401).json({ success: false, error: INVALID_CREDENTIALS });
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
      activo: true,
      requiere_cambio_pin: user.data?.requiere_cambio_pin === true
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
    const token = await createSession(sql, req, {
      id: returnUser.id,
      uuid_sync: user.uuid_sync,
      perfil: returnUser.perfil,
      cliente_id: defaultClientId,
      cliente_ids: clienteIds,
      must_change_pin: returnUser.requiere_cambio_pin
    });
    setAuthCookie(res, token);
    await writeSecurityAudit(sql, {
      action: 'auth.login',
      entityType: 'user',
      entityId: user.uuid_sync,
      userId: user.uuid_sync,
      tenantId: defaultClientId,
      outcome: 'success',
      details: { ipHash: privacyHash(ip) }
    });

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

async function handleLogout(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const token: any = verifyToken(req);
  if (token?.jti) {
    const sql = getDb();
    await sql`UPDATE cmms_sessions SET revoked_at = ${Date.now()} WHERE jti = ${token.jti}`;
    await writeSecurityAudit(sql, {
      action: 'auth.logout',
      entityType: 'session',
      entityId: token.jti,
      userId: token.uuid_sync || token.id,
      tenantId: token.cliente_id,
      outcome: 'success'
    });
  }
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `cmms_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
  return res.json({ success: true });
}

async function handleChangePin(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (rejectOversizedRequest(req, res, 16 * 1024)) return;
  const sql = getDb();
  const authUser: any = await requireAuth(req, res, sql);
  if (!authUser) return;

  const currentPin = String(req.body.currentPin || '').trim();
  const newPin = String(req.body.newPin || '').trim();
  if (!currentPin || !isValidCredential(newPin) || currentPin === newPin) {
    return res.status(400).json({ success: false, error: 'El nuevo PIN debe tener 6 dígitos y ser distinto del actual' });
  }

  try {
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
      SET pin_hash = ${nextHash}, pin = NULL,
          data = jsonb_set(COALESCE(data, '{}'::jsonb), '{requiere_cambio_pin}', 'false'::jsonb, true),
          updated_at = ${Date.now()}
      WHERE uuid_sync = ${rows[0].uuid_sync}
    `;
    await sql`UPDATE cmms_sessions SET revoked_at = ${Date.now()} WHERE user_id = ${rows[0].uuid_sync} AND revoked_at IS NULL`;
    await writeSecurityAudit(sql, {
      action: 'auth.credential_changed',
      entityType: 'user',
      entityId: rows[0].uuid_sync,
      userId: rows[0].uuid_sync,
      tenantId: authUser.cliente_id,
      outcome: 'success'
    });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `cmms_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
    return res.json({ success: true, reauthenticationRequired: true });
  } catch {
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

async function handleBiometricVerify(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const sql = getDb();
  const authUser = await requireAuth(req, res, sql);
  if (!authUser) return;
  return res.status(501).json({
    success: false,
    error: 'Autenticación biométrica temporalmente deshabilitada'
  });
}
