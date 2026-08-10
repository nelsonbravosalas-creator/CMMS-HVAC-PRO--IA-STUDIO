import {
  PARAMETRIC_ASSET_TYPES,
  PARAMETRIC_BRANCHES,
  PARAMETRIC_CLIENTS,
  PARAMETRIC_SEED_VERSION,
  PARAMETRIC_SETTINGS,
  PARAMETRIC_USERS
} from "./parametric-data.js";
import { hashPin } from "../../server/passwords.js";

type SqlClient = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

interface SeedOptions {
  logger?: Pick<Console, "log">;
}

const json = (value: unknown) => JSON.stringify(value);

export async function seedParametricData(sql: SqlClient, options: SeedOptions = {}) {
  const logger = options.logger || console;
  const ts = PARAMETRIC_SEED_VERSION;

  await sql`
    UPDATE users
    SET activo = false,
        deleted_at = COALESCE(deleted_at, ${ts}),
        updated_at = ${ts}
    WHERE LOWER(perfil) = 'programador'
       OR LOWER(data->>'rol') = 'programador'
  `;

  for (const client of PARAMETRIC_CLIENTS) {
    await sql`
      INSERT INTO clientes (id, uuid_sync, data, updated_at, created_at, deleted_at)
      VALUES (${client.id}, ${client.uuid_sync}, ${json(client.data)}, ${ts}, ${ts}, NULL)
      ON CONFLICT (id) DO UPDATE SET
        uuid_sync = EXCLUDED.uuid_sync,
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL
    `;
  }

  for (const branch of PARAMETRIC_BRANCHES) {
    await sql`
      INSERT INTO sucursales (id, cliente_id, uuid_sync, data, updated_at, created_at, deleted_at)
      VALUES (${branch.id}, ${branch.cliente_id}, ${branch.uuid_sync}, ${json(branch.data)}, ${ts}, ${ts}, NULL)
      ON CONFLICT (id) DO UPDATE SET
        cliente_id = EXCLUDED.cliente_id,
        uuid_sync = EXCLUDED.uuid_sync,
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL
    `;
  }

  for (const type of PARAMETRIC_ASSET_TYPES) {
    await sql`
      INSERT INTO catalog_asset_types (uuid_sync, id, data, updated_at, created_at, deleted_at, cliente_id)
      VALUES (${type.codigo}, ${type.codigo}, ${json(type)}, ${ts}, ${ts}, NULL, 'cliente-default-001')
      ON CONFLICT (uuid_sync) DO UPDATE SET
        id = EXCLUDED.id,
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL,
        cliente_id = EXCLUDED.cliente_id
    `;
  }

  for (const setting of PARAMETRIC_SETTINGS) {
    await sql`
      INSERT INTO settings (uuid_sync, id, data, updated_at, created_at, deleted_at, cliente_id)
      VALUES (${setting.uuid_sync}, ${setting.id}, ${json(setting.data)}, ${ts}, ${ts}, NULL, ${setting.cliente_id})
      ON CONFLICT (uuid_sync) DO UPDATE SET
        id = EXCLUDED.id,
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL,
        cliente_id = EXCLUDED.cliente_id
    `;
  }

  const isHostedEnvironment = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const includeDemoUsers = !isHostedEnvironment && process.env.CMMS_ENABLE_DEMO_USERS === 'true';
  const demoPin = String(process.env.CMMS_DEMO_PIN || '');

  if (includeDemoUsers && !/^\d{6}$/.test(demoPin)) {
    throw new Error('CMMS_DEMO_PIN must contain exactly 6 digits when demo users are enabled');
  }

  if (isHostedEnvironment) {
    const bootstrapEmail = String(process.env.CMMS_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
    const bootstrapPin = String(process.env.CMMS_BOOTSTRAP_ADMIN_PIN || '');
    if (bootstrapEmail || bootstrapPin) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bootstrapEmail) || bootstrapEmail.endsWith('@cmms.local') || !/^\d{6}$/.test(bootstrapPin)) {
        throw new Error('Bootstrap admin requires a non-local email and a 6-digit CMMS_BOOTSTRAP_ADMIN_PIN');
      }
      const bootstrapHash = await hashPin(bootstrapPin);
      const bootstrapUuid = 'BOOTSTRAP-ADMIN';
      const bootstrapData = JSON.stringify({
        id: bootstrapUuid,
        nombre: 'Administrador inicial',
        email: bootstrapEmail,
        rol: 'administrador',
        cliente_id: null,
        cliente_ids: [],
        activo: true,
        requiere_cambio_pin: true
      });
      await sql`
        INSERT INTO users (uuid_sync, id, nombre, correo, perfil, pin_hash, pin, activo, data, updated_at, created_at, deleted_at, cliente_id)
        VALUES (${bootstrapUuid}, ${bootstrapUuid}, 'Administrador inicial', ${bootstrapEmail}, 'administrador', ${bootstrapHash}, NULL, true, ${bootstrapData}, ${ts}, ${ts}, NULL, NULL)
        ON CONFLICT (uuid_sync) DO NOTHING
      `;
    }

    const operationalAdmins = await sql`
      SELECT COUNT(*)::int AS count FROM users
      WHERE activo = true
        AND deleted_at IS NULL
        AND LOWER(perfil) = 'administrador'
        AND LOWER(correo) NOT LIKE '%@cmms.local'
    `;
    if (Number(operationalAdmins[0]?.count || 0) === 0) {
      throw new Error('Production bootstrap blocked: create an operational administrator before disabling demo accounts');
    }

    await sql`
      UPDATE users
      SET activo = false,
          deleted_at = COALESCE(deleted_at, ${ts}),
          updated_at = ${ts}
      WHERE LOWER(correo) LIKE '%@cmms.local'
         OR id IN ('U2', 'U-SUPERVISOR', 'U-TECNICO', 'U-CONTRATISTA', 'U-CLIENTE', 'U-VISITA')
    `;
  }

  if (!includeDemoUsers) {
    logger.log(`Parametric seed applied without demo users. version=${PARAMETRIC_SEED_VERSION}`);
    return;
  }

  const demoPinHash = await hashPin(demoPin);
  for (const user of PARAMETRIC_USERS) {
    const existingUsers = await sql`
      SELECT uuid_sync
      FROM users
      WHERE id = ${user.id} OR LOWER(correo) = LOWER(${user.correo})
      LIMIT 1
    `;
    const userUuid = existingUsers[0]?.uuid_sync || user.uuid_sync;

    await sql`
      INSERT INTO users (uuid_sync, id, nombre, correo, perfil, pin_hash, pin, activo, data, updated_at, created_at, deleted_at, cliente_id)
      VALUES (
        ${userUuid},
        ${user.id},
        ${user.nombre},
        ${user.correo},
        ${user.perfil},
        ${demoPinHash},
        NULL,
        ${user.activo},
        ${json(user.data)},
        ${ts},
        ${ts},
        NULL,
        ${user.cliente_id}
      )
      ON CONFLICT (uuid_sync) DO UPDATE SET
        id = EXCLUDED.id,
        nombre = EXCLUDED.nombre,
        correo = EXCLUDED.correo,
        perfil = EXCLUDED.perfil,
        pin_hash = EXCLUDED.pin_hash,
        pin = NULL,
        activo = EXCLUDED.activo,
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL,
        cliente_id = EXCLUDED.cliente_id
    `;

    await sql`DELETE FROM user_clientes WHERE user_id = ${userUuid}`;
    for (const clienteId of user.cliente_ids) {
      await sql`
        INSERT INTO user_clientes (uuid_sync, id, user_id, cliente_id, created_at)
        VALUES (
          ${`UC-${userUuid}-${clienteId}`},
          ${`UC-${user.id}-${clienteId}`},
          ${userUuid},
          ${clienteId},
          ${ts}
        )
        ON CONFLICT (user_id, cliente_id) DO NOTHING
      `;
    }
  }

  logger.log(`Parametric seed applied. version=${PARAMETRIC_SEED_VERSION}`);
}
