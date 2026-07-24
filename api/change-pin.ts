import { requireAuth } from './_auth.js';
import { getDb } from './_db.js';
import { hashPin, verifyPin } from '../server/passwords.js';

export default async function handler(req: any, res: any) {
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
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
