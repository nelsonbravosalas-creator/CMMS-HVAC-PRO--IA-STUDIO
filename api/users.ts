import { getDb } from './_db.js';
import { verifyToken, requireRole } from './_auth.js';

export default async function handler(req: any, res: any) {
  try {
    const sql = getDb();
    const { method, body } = req;

    // [SEC C-06] Toda operación sobre usuarios exige un JWT válido.
    const auth: any = verifyToken(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'No autorizado - falta token' });
    }
    const clienteIdFromToken = auth.clienteId || auth.cliente_id;

    if (method === 'GET') {
      // [SEC C-06] Aislamiento multi-tenant: solo usuarios del tenant del token. Nunca se devuelve el PIN.
      const rows = await sql`SELECT id, nombre, correo, perfil, activo, uuid_sync, updated_at FROM users WHERE activo = true AND deleted_at IS NULL AND cliente_id = ${clienteIdFromToken}`;
      return res.json({ success: true, data: rows });
    }

    if (method === 'POST') {
      // [SEC C-06] Crear/editar usuarios (perfil, pin) requiere rol administrador.
      const admin = requireRole(['administrador'])(req, res);
      if (!admin) return; // requireRole ya respondió 401/403
      const d = body;
      const id = d.id || `U-${Date.now()}`;
      const now = Date.now();
      // [SEC C-06] El tenant se fuerza desde el token: un admin no puede crear usuarios en otro cliente.
      const clienteIdForUser = clienteIdFromToken;
      await sql`
        INSERT INTO users (id, nombre, correo, perfil, activo, pin, uuid_sync, cliente_id, updated_at, data)
        VALUES (${id}, ${d.nombre || ''}, ${d.correo || ''}, ${d.perfil || 'tecnico'},
          ${d.activo !== false}, ${d.pin || '0000'}, ${d.uuid_sync || id}, ${clienteIdForUser}, ${d.updated_at || now}, ${JSON.stringify(d)})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre, correo = EXCLUDED.correo, perfil = EXCLUDED.perfil,
          activo = EXCLUDED.activo, pin = EXCLUDED.pin, updated_at = EXCLUDED.updated_at, data = EXCLUDED.data
        WHERE (EXCLUDED.updated_at > users.updated_at OR users.updated_at IS NULL)
          AND users.cliente_id = ${clienteIdForUser}
      `;
      return res.json({ success: true, data: { id } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
