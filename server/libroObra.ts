/**
 * Reglas puras del Libro de Obra (PLAN_MAESTRO_ITO.md, secciones 17 a 19).
 * Sin dependencias de base de datos: las usan el cliente, ambos servidores y las pruebas.
 *
 * R16  Nada se edita ni se borra: un error se corrige con una anotación nueva.
 * R21  Folio consecutivo único por obra, asignado por el servidor.
 * R22  La anotación la firma su autor; los destinatarios dan acuse.
 * R24  Cada anotación guarda el hash de la anterior de la obra.
 * R25  Todas las anotaciones emitidas son visibles para todos los participantes.
 * R26  Sin conexión: borrador firmado sin folio hasta sincronizar.
 */

export const LIBRO_TABLES = ['obras', 'participantes_obra', 'anotaciones', 'anotacion_acuses'] as const;
export type LibroTable = (typeof LIBRO_TABLES)[number];

export function isLibroTable(table: string): table is LibroTable {
  return (LIBRO_TABLES as readonly string[]).includes(table);
}

export const TIPOS_ANOTACION = [
  'ito',
  'correccion',
  'instruccion',
  'consulta',
  'respuesta',
  'hecho_relevante',
  'recepcion'
] as const;
export type TipoAnotacion = (typeof TIPOS_ANOTACION)[number];

export const ROLES_OBRA = ['cliente', 'inspector', 'contratista', 'supervisor'] as const;
export type RolObra = (typeof ROLES_OBRA)[number];

export const ETIQUETA_TIPO: Record<TipoAnotacion, string> = {
  ito: 'ITO',
  correccion: 'Corrección',
  instruccion: 'Instrucción',
  consulta: 'Consulta',
  respuesta: 'Respuesta',
  hecho_relevante: 'Hecho relevante',
  recepcion: 'Recepción de trabajos'
};

/** Hash de partida de la cadena: la primera anotación de una obra lo toma como anterior. */
export const HASH_GENESIS = '0'.repeat(64);

/** Tipos que obligan a referenciar otra anotación. */
const TIPOS_CON_REFERENCIA: TipoAnotacion[] = ['correccion', 'respuesta'];

export interface AnotacionBorrador {
  obra_id: string;
  tipo: TipoAnotacion;
  texto: string;
  autor_id: string;
  autor_rol: RolObra;
  destinatarios: string[];
  /** Fecha límite de respuesta (epoch ms), obligatoria si pide respuesta. */
  plazo?: number | null;
  pide_respuesta?: boolean;
  /** uuid_sync de la anotación que se responde o corrige. */
  referencia_uuid?: string | null;
  /** Hora del dispositivo al firmar (epoch ms). */
  escrito_en: number;
}

export interface AnotacionEmitida extends AnotacionBorrador {
  uuid_sync: string;
  folio: number;
  hash: string;
  hash_anterior: string;
  /** Hora del servidor al recibirla (epoch ms). */
  recibido_en: number;
}

export function validarBorrador(a: Partial<AnotacionBorrador>): string[] {
  const errores: string[] = [];
  if (!a.obra_id) errores.push('La anotación debe pertenecer a una obra');
  if (!a.tipo || !(TIPOS_ANOTACION as readonly string[]).includes(a.tipo)) {
    errores.push('Tipo de anotación no válido');
  }
  if (!a.texto || !String(a.texto).trim()) errores.push('El texto es obligatorio');
  if (!a.autor_id) errores.push('Falta el autor');
  if (!a.autor_rol || !(ROLES_OBRA as readonly string[]).includes(a.autor_rol)) {
    errores.push('El autor debe tener un rol en la obra');
  }
  if (!Array.isArray(a.destinatarios) || a.destinatarios.length === 0) {
    errores.push('Debe haber al menos un destinatario');
  }
  if (a.pide_respuesta && !a.plazo) errores.push('Una anotación que pide respuesta necesita plazo');
  if (a.tipo && TIPOS_CON_REFERENCIA.includes(a.tipo) && !a.referencia_uuid) {
    errores.push(`Una anotación de tipo ${ETIQUETA_TIPO[a.tipo]} debe referenciar otra anotación`);
  }
  if (typeof a.escrito_en !== 'number' || !Number.isFinite(a.escrito_en)) {
    errores.push('Falta la hora de escritura');
  }
  return errores;
}

/** Serialización estable: mismas claves en el mismo orden, destinatarios ordenados. */
export function canonicalizar(a: AnotacionBorrador): string {
  return JSON.stringify([
    a.obra_id,
    a.tipo,
    String(a.texto).trim(),
    a.autor_id,
    a.autor_rol,
    [...(a.destinatarios || [])].sort(),
    a.plazo ?? null,
    a.pide_respuesta ? 1 : 0,
    a.referencia_uuid ?? null,
    a.escrito_en
  ]);
}

export async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * hash = sha256( hash_anterior | folio | canónico ).
 * La misma fórmula se evalúa en SQL al asignar el folio (ver libroObraDb.ts).
 */
export function textoDeHash(hashAnterior: string, folio: number, canonico: string): string {
  return `${hashAnterior}|${folio}|${canonico}`;
}

export async function calcularHash(hashAnterior: string, folio: number, canonico: string): Promise<string> {
  return sha256Hex(textoDeHash(hashAnterior, folio, canonico));
}

export interface ResultadoCadena {
  valida: boolean;
  /** Folio donde se rompe la cadena, si no es válida. */
  rotaEn?: number;
  motivo?: string;
}

/** Verifica folios consecutivos desde 1, enlace de hashes y hash de cada anotación. */
export async function verificarCadena(anotaciones: AnotacionEmitida[]): Promise<ResultadoCadena> {
  const ordenadas = [...anotaciones].sort((x, y) => x.folio - y.folio);
  let anterior = HASH_GENESIS;
  for (let i = 0; i < ordenadas.length; i++) {
    const a = ordenadas[i];
    if (a.folio !== i + 1) {
      return { valida: false, rotaEn: a.folio, motivo: `Salto de folio: se esperaba ${i + 1}` };
    }
    if (a.hash_anterior !== anterior) {
      return { valida: false, rotaEn: a.folio, motivo: 'El hash anterior no coincide' };
    }
    const esperado = await calcularHash(a.hash_anterior, a.folio, canonicalizar(a));
    if (esperado !== a.hash) {
      return { valida: false, rotaEn: a.folio, motivo: 'El contenido no coincide con su hash' };
    }
    anterior = a.hash;
  }
  return { valida: true };
}

/** R16: una anotación con folio no se edita ni se borra. */
export function puedeModificarAnotacion(existente: { folio?: number | null } | null | undefined): boolean {
  return !(existente && typeof existente.folio === 'number' && existente.folio > 0);
}

export interface ParticipanteObra {
  usuario_id: string;
  rol: RolObra;
  empresa?: string;
  especialidad?: string;
  activo?: boolean;
}

/** R25: todo participante activo de la obra ve todas las anotaciones emitidas. */
export function esParticipante(participantes: ParticipanteObra[], usuarioId: string): boolean {
  return participantes.some((p) => p.usuario_id === usuarioId && p.activo !== false);
}

export function rolEnObra(participantes: ParticipanteObra[], usuarioId: string): RolObra | null {
  const p = participantes.find((x) => x.usuario_id === usuarioId && x.activo !== false);
  return p ? p.rol : null;
}

export type EstadoHilo = 'abierta' | 'respondida' | 'cerrada';

/**
 * Estado de una anotación que pide respuesta, derivado de las demás:
 * respondida si existe una anotación de tipo respuesta que la referencia.
 * El cierre explícito del hilo queda para una iteración posterior.
 */
export function estadoDeHilo(
  anotacion: Pick<AnotacionEmitida, 'uuid_sync' | 'pide_respuesta'>,
  todas: Pick<AnotacionEmitida, 'tipo' | 'referencia_uuid'>[]
): EstadoHilo | null {
  if (!anotacion.pide_respuesta) return null;
  const respondida = todas.some((o) => o.tipo === 'respuesta' && o.referencia_uuid === anotacion.uuid_sync);
  return respondida ? 'respondida' : 'abierta';
}

/** Un hilo vencido se destaca en rojo; no genera correo. */
export function estaVencida(
  anotacion: Pick<AnotacionEmitida, 'plazo' | 'pide_respuesta'>,
  estado: EstadoHilo | null,
  ahora: number
): boolean {
  return !!anotacion.pide_respuesta && estado === 'abierta' && !!anotacion.plazo && anotacion.plazo < ahora;
}
