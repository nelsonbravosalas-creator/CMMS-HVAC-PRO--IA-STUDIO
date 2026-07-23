import { getDb } from './_db.js';
import { requireRole } from './_auth.js';
import { hashPin } from '../server/passwords.js';

const ALLOWED_ROLES = new Set([
  'administrador',
  'supervisor',
  'tecnico',
  'contratista',
  'cliente',
  'visita'
]);
const GLOBAL_ROLES = new Set(['administrador']);

function normalizeRole(value: unknown) {
  return String(value || 'tecnico')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default async function handler(req: any, res: any) {
  try {
    const admin = requireRole(['administrador'])(req, res);
    if (!admin) return;

    const sql = getDb();
    const { method, body = {} } = req;

    if (method === 'GET') {
      const [users, relations] = await Promise.all([
        sql`
          SELECT id, nombre, correo, perfil, activo, uuid_sync, cliente_id, updated_at
          FROM users
          WHERE deleted_at IS NULL
          ORDER BY nombre ASC
        `,
        sql`SELECT user_id, cliente_id FROM user_clientes`
      ]);
      const clientIdsByUser = new Map<string, string[]>();
      for (const relation of relations) {
        const current = clientIdsByUser.get(relation.user_id) || [];
        current.push(relation.cliente_id);
        clientIdsByUser.set(relation.user_id, current);
      }
      return res.json({
        success: true,
        data: users.map((user: any) => ({
          ...user,
          cliente_ids: clientIdsByUser.get(user.uuid_sync) || []
        }))
      });
    }

    if (method === 'POST') {
      const perfil = normalizeRole(body.perfil);
      if (!ALLOWED_ROLES.has(perfil)) {
        return res.status(400).json({ success: false, error: 'Perfil de usuario no válido' });
      }

      const nombre = String(body.nombre || '').trim();
      const correo = String(body.correo || '').trim().toLowerCase();
      if (!nombre || !correo) {
        return res.status(400).json({ success: false, error: 'Nombre y correo son obligatorios' });
      }
      if (body.pin && !/^\d{4}$/.test(String(body.pin))) {
        return res.status(400).json({ success: false, error: 'El PIN debe contener exactamente 4 dígitos' });
      }

      let clienteId: string | null = null;
      let clienteIds: string[] = [];
      if (!GLOBAL_ROLES.has(perfil)) {
        const requestedClientIds = Array.from(new Set(
          (Array.isArray(body.cliente_ids) && body.cliente_ids.length
            ? body.cliente_ids
            : [body.cliente_id])
            .map((value: unknown) => String(value || '').trim())
            .filter(Boolean)
        )) as string[];
        if (requestedClientIds.length === 0) {
          return res.status(400).json({ success: false, error: 'Debe asignar al menos un cliente para este perfil' });
        }
        for (const requestedClientId of requestedClientIds) {
          const clients = await sql`
            SELECT id FROM clientes
            WHERE (id = ${requestedClientId} OR uuid_sync = ${requestedClientId})
              AND deleted_at IS NULL
            LIMIT 1
          `;
          if (!clients[0]) {
            return res.status(400).json({ success: false, error: 'Uno o más clientes seleccionados no existen o están inactivos' });
          }
          clienteIds.push(clients[0].id);
        }
        clienteIds = Array.from(new Set(clienteIds));
        clienteId = clienteIds[0];
      }

      const id = body.id || `U-${Date.now()}`;
      const uuidSync = body.uuid_sync || crypto.randomUUID();
      const now = Date.now();
      const pinHash = body.pin ? await hashPin(String(body.pin)) : null;
      const { pin: _pin, ...safeData } = body;
      const normalizedData = {
        ...safeData,
        id,
        uuid_sync: uuidSync,
        nombre,
        correo,
        perfil,
        activo: body.activo !== false,
        cliente_id: clienteId,
        cliente_ids: clienteIds
      };

      await sql`
        INSERT INTO users (
          uuid_sync, id, nombre, correo, perfil, pin_hash, pin, activo,
          data, updated_at, created_at, deleted_at, cliente_id
        )
        VALUES (
          ${uuidSync}, ${id}, ${nombre}, ${correo}, ${perfil}, ${pinHash}, NULL,
          ${body.activo !== false}, ${JSON.stringify(normalizedData)}, ${now},
          ${body.created_at || now}, NULL, ${clienteId}
        )
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          correo = EXCLUDED.correo,
          perfil = EXCLUDED.perfil,
          activo = EXCLUDED.activo,
          pin_hash = COALESCE(EXCLUDED.pin_hash, users.pin_hash),
          pin = NULL,
          cliente_id = EXCLUDED.cliente_id,
          updated_at = EXCLUDED.updated_at,
          deleted_at = NULL,
          data = EXCLUDED.data
      `;

      const storedUsers = await sql`SELECT uuid_sync FROM users WHERE id = ${id} LIMIT 1`;
      const storedUuid = storedUsers[0]?.uuid_sync || uuidSync;
      await sql`DELETE FROM user_clientes WHERE user_id = ${storedUuid}`;
      for (const assignedClientId of clienteIds) {
        const relationId = `UC-${storedUuid}-${assignedClientId}`;
        await sql`
          INSERT INTO user_clientes (uuid_sync, id, user_id, cliente_id, created_at)
          VALUES (${relationId}, ${relationId}, ${storedUuid}, ${assignedClientId}, ${now})
          ON CONFLICT (user_id, cliente_id) DO NOTHING
        `;
      }

      return res.json({
        success: true,
        data: {
          id,
          uuid_sync: storedUuid,
          cliente_id: clienteId,
          cliente_ids: clienteIds
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (String(error?.message || '').toLowerCase().includes('correo')) {
      return res.status(409).json({ success: false, error: 'El correo ya está registrado' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
}
