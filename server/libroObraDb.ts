/**
 * Escrituras y lecturas del Libro de Obra contra Neon.
 * Lo comparten el handler de Vercel (server/vercel/handlers/sync.ts) y Express (server.ts),
 * porque ambos sincronizan por separado y cada tabla nueva exigía dos copias del SQL.
 *
 * El folio y el hash se asignan en una sola sentencia UPDATE sobre libro_obra_secuencias,
 * así que dos anotaciones simultáneas de la misma obra nunca reciben el mismo folio.
 */
import {
  HASH_GENESIS,
  LIBRO_TABLES,
  canonicalizar,
  isLibroTable,
  validarBorrador,
  type AnotacionBorrador
} from './libroObra.js';

export class LibroError extends Error {
  code: 'immutable' | 'invalid' | 'forbidden' | 'not_found';
  constructor(code: LibroError['code'], message: string) {
    super(message);
    this.name = 'LibroError';
    this.code = code;
  }
}

interface Ctx {
  sql: any;
  table: string;
  uuid_sync: string;
  data: any;
  updated_at: number;
  clienteId: string;
  user: any;
}

function userKeys(user: any): string[] {
  return [user?.id, user?.uuid_sync].filter(Boolean).map(String);
}

function isAdmin(user: any) {
  return String(user?.perfil || '').toLowerCase().startsWith('admin');
}

async function obraDelCliente(sql: any, obraId: string, clienteId: string) {
  const rows = await sql`
    SELECT uuid_sync, data FROM obras
    WHERE (uuid_sync = ${obraId} OR id = ${obraId}) AND cliente_id = ${clienteId} AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows?.[0] || null;
}

async function esParticipanteActivo(sql: any, obraUuid: string, user: any) {
  const keys = userKeys(user);
  if (keys.length === 0) return false;
  const rows = await sql`
    SELECT 1 FROM participantes_obra
    WHERE obra_id = ${obraUuid} AND deleted_at IS NULL
      AND (data->>'usuario_id') = ANY(${keys})
      AND COALESCE(data->>'activo', 'true') <> 'false'
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function applyLibroInsert(ctx: Ctx): Promise<'applied' | 'noop'> {
  const { sql, table, uuid_sync, data, updated_at, clienteId, user } = ctx;
  if (!isLibroTable(table)) throw new LibroError('invalid', 'Tabla del libro desconocida');
  const strData = JSON.stringify(data);
  const id = data.id || uuid_sync;

  if (table === 'obras') {
    await sql`
      INSERT INTO obras (id, data, uuid_sync, updated_at, created_at, cliente_id)
      VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteId})
      ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
      WHERE obras.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > obras.updated_at OR obras.updated_at IS NULL)
    `;
    return 'applied';
  }

  if (table === 'participantes_obra') {
    const obra = await obraDelCliente(sql, String(data.obra_id || ''), clienteId);
    if (!obra) throw new LibroError('not_found', 'La obra no existe para este cliente');
    await sql`
      INSERT INTO participantes_obra (id, data, uuid_sync, updated_at, created_at, cliente_id, obra_id)
      VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteId}, ${obra.uuid_sync})
      ON CONFLICT (uuid_sync) DO UPDATE SET id = EXCLUDED.id, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
      WHERE participantes_obra.cliente_id = EXCLUDED.cliente_id AND (EXCLUDED.updated_at > participantes_obra.updated_at OR participantes_obra.updated_at IS NULL)
    `;
    return 'applied';
  }

  if (table === 'anotacion_acuses') {
    const obra = await obraDelCliente(sql, String(data.obra_id || ''), clienteId);
    if (!obra) throw new LibroError('not_found', 'La obra no existe para este cliente');
    if (!isAdmin(user) && !(await esParticipanteActivo(sql, obra.uuid_sync, user))) {
      throw new LibroError('forbidden', 'Solo un participante de la obra puede dar acuse');
    }
    if (!userKeys(user).includes(String(data.usuario_id || ''))) {
      throw new LibroError('forbidden', 'El acuse debe ser del usuario autenticado');
    }
    const res = await sql`
      INSERT INTO anotacion_acuses (id, data, uuid_sync, updated_at, created_at, cliente_id, obra_id, anotacion_uuid)
      VALUES (${id}, ${strData}, ${uuid_sync}, ${updated_at}, ${updated_at}, ${clienteId}, ${obra.uuid_sync}, ${String(data.anotacion_uuid || '')})
      ON CONFLICT (uuid_sync) DO NOTHING
      RETURNING uuid_sync
    `;
    return res.length ? 'applied' : 'noop';
  }

  // anotaciones
  const existente = await sql`SELECT uuid_sync FROM anotaciones WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${clienteId} LIMIT 1`;
  if (existente.length) return 'noop'; // reintento de una anotación ya emitida: conserva su folio

  const borrador = data as AnotacionBorrador;
  const errores = validarBorrador(borrador);
  if (errores.length) throw new LibroError('invalid', errores.join('. '));

  const obra = await obraDelCliente(sql, borrador.obra_id, clienteId);
  if (!obra) throw new LibroError('not_found', 'La obra no existe para este cliente');
  const obraData = typeof obra.data === 'string' ? JSON.parse(obra.data) : obra.data || {};
  if (obraData.libro_estado === 'cerrado') {
    throw new LibroError('immutable', 'El libro de la obra está cerrado');
  }
  if (!userKeys(user).includes(String(borrador.autor_id))) {
    throw new LibroError('forbidden', 'El autor debe ser el usuario autenticado');
  }
  if (!isAdmin(user) && !(await esParticipanteActivo(sql, obra.uuid_sync, user))) {
    throw new LibroError('forbidden', 'Solo un participante de la obra puede anotar en el libro');
  }
  if (borrador.referencia_uuid) {
    const ref = await sql`SELECT 1 FROM anotaciones WHERE uuid_sync = ${borrador.referencia_uuid} AND obra_id = ${obra.uuid_sync} LIMIT 1`;
    if (!ref.length) throw new LibroError('invalid', 'La anotación referenciada no existe en esta obra');
  }

  const canonico = canonicalizar({ ...borrador, obra_id: borrador.obra_id });
  await sql`
    INSERT INTO libro_obra_secuencias (obra_id, cliente_id, ultimo_folio, ultimo_hash, hash_anterior)
    VALUES (${obra.uuid_sync}, ${clienteId}, 0, ${HASH_GENESIS}, ${HASH_GENESIS})
    ON CONFLICT (obra_id) DO NOTHING
  `;
  // Todo el cálculo ocurre en esta sentencia: el segundo emisor concurrente espera el bloqueo
  // de la fila y recibe el folio y el hash siguientes.
  const seq = await sql`
    UPDATE libro_obra_secuencias SET
      hash_anterior = ultimo_hash,
      ultimo_folio = ultimo_folio + 1,
      ultimo_hash = encode(sha256(convert_to(ultimo_hash || '|' || (ultimo_folio + 1)::text || '|' || ${canonico}, 'UTF8')), 'hex')
    WHERE obra_id = ${obra.uuid_sync} AND cliente_id = ${clienteId}
    RETURNING ultimo_folio AS folio, ultimo_hash AS hash, hash_anterior
  `;
  if (!seq.length) throw new LibroError('not_found', 'No se pudo asignar el folio');
  const { folio, hash, hash_anterior } = seq[0];

  const recibido_en = Date.now();
  const emitida = {
    ...borrador,
    uuid_sync,
    id: `${obra.uuid_sync}:${folio}`,
    cliente_id: clienteId,
    folio: Number(folio),
    hash,
    hash_anterior,
    recibido_en
  };
  await sql`
    INSERT INTO anotaciones (id, data, uuid_sync, updated_at, created_at, cliente_id, obra_id, folio)
    VALUES (${emitida.id}, ${JSON.stringify(emitida)}, ${uuid_sync}, ${recibido_en}, ${recibido_en}, ${clienteId}, ${obra.uuid_sync}, ${Number(folio)})
    ON CONFLICT (uuid_sync) DO NOTHING
  `;
  return 'applied';
}

export async function applyLibroUpdate(ctx: Ctx): Promise<'applied' | 'noop'> {
  const { sql, table, uuid_sync, data, updated_at, clienteId } = ctx;
  if (!isLibroTable(table)) throw new LibroError('invalid', 'Tabla del libro desconocida');
  if (table === 'anotaciones' || table === 'anotacion_acuses') {
    // R16: una anotación emitida no se edita. Un error se corrige con una anotación nueva.
    // Un borrador sin folio no llega al servidor, así que toda anotación remota está emitida.
    void sql; void uuid_sync; void clienteId;
    throw new LibroError('immutable', 'Una anotación emitida no se edita; emita una corrección');
  }
  const id = data.id || uuid_sync;
  const strData = JSON.stringify(data);
  if (table === 'obras') {
    await sql`UPDATE obras SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${clienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`;
  } else {
    await sql`UPDATE participantes_obra SET id = ${id}, data = ${strData}, updated_at = ${updated_at} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${clienteId} AND (updated_at < ${updated_at} OR updated_at IS NULL)`;
  }
  return 'applied';
}

export async function applyLibroDelete(ctx: Pick<Ctx, 'sql' | 'table' | 'uuid_sync' | 'clienteId'> & { ts: number }) {
  const { sql, table, uuid_sync, clienteId, ts } = ctx;
  if (table === 'anotaciones' || table === 'anotacion_acuses') {
    throw new LibroError('immutable', 'Una anotación emitida no se borra; emita una corrección');
  }
  if (table === 'obras') {
    await sql`UPDATE obras SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${clienteId}`;
  } else if (table === 'participantes_obra') {
    await sql`UPDATE participantes_obra SET deleted_at = ${ts}, updated_at = ${ts} WHERE uuid_sync = ${uuid_sync} AND cliente_id = ${clienteId}`;
  }
}

/**
 * R25: todo participante ve todas las anotaciones emitidas de sus obras.
 * Un usuario que no es administrador solo recibe obras donde participa.
 */
export async function pullLibro(
  sql: any,
  table: string,
  opts: { clienteId: string; since: number; globalScope: boolean; user: any }
): Promise<any[]> {
  const { clienteId, since, globalScope, user } = opts;
  const admin = isAdmin(user);
  const keys = userKeys(user);
  if (!isLibroTable(table)) return [];

  if (globalScope) {
    switch (table) {
      case 'obras': return sql`SELECT * FROM obras WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
      case 'participantes_obra': return sql`SELECT * FROM participantes_obra WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
      case 'anotaciones': return sql`SELECT * FROM anotaciones WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
      case 'anotacion_acuses': return sql`SELECT * FROM anotacion_acuses WHERE (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
    }
  }
  if (admin) {
    switch (table) {
      case 'obras': return sql`SELECT * FROM obras WHERE cliente_id = ${clienteId} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
      case 'participantes_obra': return sql`SELECT * FROM participantes_obra WHERE cliente_id = ${clienteId} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
      case 'anotaciones': return sql`SELECT * FROM anotaciones WHERE cliente_id = ${clienteId} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
      case 'anotacion_acuses': return sql`SELECT * FROM anotacion_acuses WHERE cliente_id = ${clienteId} AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
    }
  }
  switch (table) {
    case 'obras': return sql`SELECT * FROM obras WHERE cliente_id = ${clienteId} AND uuid_sync IN (SELECT obra_id FROM participantes_obra WHERE cliente_id = ${clienteId} AND deleted_at IS NULL AND (data->>'usuario_id') = ANY(${keys})) AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
    case 'participantes_obra': return sql`SELECT * FROM participantes_obra WHERE cliente_id = ${clienteId} AND obra_id IN (SELECT obra_id FROM participantes_obra WHERE cliente_id = ${clienteId} AND deleted_at IS NULL AND (data->>'usuario_id') = ANY(${keys})) AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
    case 'anotaciones': return sql`SELECT * FROM anotaciones WHERE cliente_id = ${clienteId} AND obra_id IN (SELECT obra_id FROM participantes_obra WHERE cliente_id = ${clienteId} AND deleted_at IS NULL AND (data->>'usuario_id') = ANY(${keys})) AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
    case 'anotacion_acuses': return sql`SELECT * FROM anotacion_acuses WHERE cliente_id = ${clienteId} AND obra_id IN (SELECT obra_id FROM participantes_obra WHERE cliente_id = ${clienteId} AND deleted_at IS NULL AND (data->>'usuario_id') = ANY(${keys})) AND (updated_at > ${since} OR updated_at IS NULL) ORDER BY updated_at ASC LIMIT 200`;
  }
  return [];
}

export { LIBRO_TABLES };
