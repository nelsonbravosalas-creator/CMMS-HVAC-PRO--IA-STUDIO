import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HASH_GENESIS,
  calcularHash,
  canonicalizar,
  estaVencida,
  estadoDeHilo,
  puedeModificarAnotacion,
  validarBorrador,
  verificarCadena,
  esParticipante,
  rolEnObra,
  type AnotacionBorrador,
  type AnotacionEmitida
} from '../server/libroObra';

const base: AnotacionBorrador = {
  obra_id: 'obra-1',
  tipo: 'instruccion',
  texto: 'Reemplazar el filtro G4 del manejador 2',
  autor_id: 'u-insp',
  autor_rol: 'inspector',
  destinatarios: ['u-contr', 'u-sup'],
  escrito_en: 1_700_000_000_000
};

async function emitir(prev: string, folio: number, b: AnotacionBorrador, uuid: string): Promise<AnotacionEmitida> {
  const hash = await calcularHash(prev, folio, canonicalizar(b));
  return { ...b, uuid_sync: uuid, folio, hash, hash_anterior: prev, recibido_en: b.escrito_en + 5 };
}

test('una anotación válida no tiene errores', () => {
  assert.deepEqual(validarBorrador(base), []);
});

test('exige texto, destinatario, autor con rol y obra', () => {
  const errores = validarBorrador({ tipo: 'consulta', texto: '  ', destinatarios: [], escrito_en: 1 });
  assert.ok(errores.some((e) => e.includes('obra')));
  assert.ok(errores.some((e) => e.includes('texto')));
  assert.ok(errores.some((e) => e.includes('autor')));
  assert.ok(errores.some((e) => e.includes('destinatario')));
});

test('una anotación que pide respuesta necesita plazo', () => {
  assert.ok(validarBorrador({ ...base, pide_respuesta: true }).some((e) => e.includes('plazo')));
  assert.deepEqual(validarBorrador({ ...base, pide_respuesta: true, plazo: 1_700_100_000_000 }), []);
});

test('corrección y respuesta deben referenciar otra anotación', () => {
  assert.ok(validarBorrador({ ...base, tipo: 'correccion' }).length > 0);
  assert.ok(validarBorrador({ ...base, tipo: 'respuesta' }).length > 0);
  assert.deepEqual(validarBorrador({ ...base, tipo: 'correccion', referencia_uuid: 'a-1' }), []);
});

test('el canónico no depende del orden de los destinatarios ni de espacios en el texto', () => {
  const a = canonicalizar(base);
  const b = canonicalizar({ ...base, destinatarios: ['u-sup', 'u-contr'], texto: `  ${base.texto}  ` });
  assert.equal(a, b);
});

test('el hash coincide con la fórmula que evalúa el servidor en SQL', async () => {
  // sha256(hash_anterior | folio | canónico), mismo texto que arma libroObraDb.ts
  const canonico = canonicalizar(base);
  const esperado = (await import('node:crypto'))
    .createHash('sha256')
    .update(`${HASH_GENESIS}|1|${canonico}`)
    .digest('hex');
  assert.equal(await calcularHash(HASH_GENESIS, 1, canonico), esperado);
});

test('una cadena íntegra es válida', async () => {
  const a1 = await emitir(HASH_GENESIS, 1, base, 'a-1');
  const a2 = await emitir(a1.hash, 2, { ...base, texto: 'Se adjunta el plano rev B' }, 'a-2');
  const a3 = await emitir(a2.hash, 3, { ...base, tipo: 'consulta', texto: '¿Confirma la ubicación?' }, 'a-3');
  assert.deepEqual(await verificarCadena([a3, a1, a2]), { valida: true });
});

test('alterar el texto de una anotación rompe la cadena en su folio', async () => {
  const a1 = await emitir(HASH_GENESIS, 1, base, 'a-1');
  const a2 = await emitir(a1.hash, 2, { ...base, texto: 'original' }, 'a-2');
  const adulterada = { ...a2, texto: 'modificado después' };
  const r = await verificarCadena([a1, adulterada]);
  assert.equal(r.valida, false);
  assert.equal(r.rotaEn, 2);
});

test('un folio faltante o repetido se detecta', async () => {
  const a1 = await emitir(HASH_GENESIS, 1, base, 'a-1');
  const a3 = await emitir(a1.hash, 3, base, 'a-3');
  const r = await verificarCadena([a1, a3]);
  assert.equal(r.valida, false);
  assert.match(String(r.motivo), /Salto de folio/);
});

test('quitar una anotación intermedia rompe el enlace del hash', async () => {
  const a1 = await emitir(HASH_GENESIS, 1, base, 'a-1');
  const a2 = await emitir(a1.hash, 2, { ...base, texto: 'dos' }, 'a-2');
  const a3 = await emitir(a2.hash, 3, { ...base, texto: 'tres' }, 'a-3');
  const reordenada = [a1, { ...a3, folio: 2 }];
  assert.equal((await verificarCadena(reordenada)).valida, false);
});

test('R16: con folio no se modifica; un borrador sin folio sí', () => {
  assert.equal(puedeModificarAnotacion({ folio: 4 }), false);
  assert.equal(puedeModificarAnotacion({}), true);
  assert.equal(puedeModificarAnotacion(null), true);
});

test('R25: solo los participantes activos de la obra son parte del libro', () => {
  const ps = [
    { usuario_id: 'u1', rol: 'inspector' as const },
    { usuario_id: 'u2', rol: 'contratista' as const, activo: false }
  ];
  assert.equal(esParticipante(ps, 'u1'), true);
  assert.equal(esParticipante(ps, 'u2'), false);
  assert.equal(esParticipante(ps, 'u9'), false);
  assert.equal(rolEnObra(ps, 'u1'), 'inspector');
  assert.equal(rolEnObra(ps, 'u2'), null);
});

test('hilos: una consulta pasa a respondida cuando existe una respuesta que la referencia', () => {
  const consulta = { uuid_sync: 'c-1', pide_respuesta: true };
  assert.equal(estadoDeHilo(consulta, []), 'abierta');
  assert.equal(estadoDeHilo(consulta, [{ tipo: 'respuesta', referencia_uuid: 'c-1' }]), 'respondida');
  assert.equal(estadoDeHilo(consulta, [{ tipo: 'respuesta', referencia_uuid: 'otra' }]), 'abierta');
  assert.equal(estadoDeHilo({ uuid_sync: 'x', pide_respuesta: false }, []), null);
});

test('un hilo abierto con plazo pasado está vencido; uno respondido no', () => {
  const a = { plazo: 1000, pide_respuesta: true };
  assert.equal(estaVencida(a, 'abierta', 2000), true);
  assert.equal(estaVencida(a, 'respondida', 2000), false);
  assert.equal(estaVencida(a, 'abierta', 500), false);
  assert.equal(estaVencida({ plazo: null, pide_respuesta: true }, 'abierta', 2000), false);
});

import { diferirHijosDelLibro } from '../src/sync/libroOrden';

test('sync: una obra pendiente retiene a sus participantes y anotaciones', () => {
  const cola = [
    { table: 'obras', uuid_sync: 'o1', operation: 'insert' as const, data: {} },
    { table: 'participantes_obra', uuid_sync: 'p1', operation: 'insert' as const, data: { obra_id: 'o1' } },
    { table: 'anotaciones', uuid_sync: 'a1', operation: 'insert' as const, data: { obra_id: 'o1', escrito_en: 1 } }
  ];
  assert.deepEqual(diferirHijosDelLibro(cola).map((i) => i.uuid_sync), ['o1']);
});

test('sync: participantes pendientes retienen las anotaciones de su obra', () => {
  const cola = [
    { table: 'participantes_obra', uuid_sync: 'p1', operation: 'insert' as const, data: { obra_id: 'o1' } },
    { table: 'anotaciones', uuid_sync: 'a1', operation: 'insert' as const, data: { obra_id: 'o1', escrito_en: 1 } }
  ];
  assert.deepEqual(diferirHijosDelLibro(cola).map((i) => i.uuid_sync), ['p1']);
});

test('sync: sale una sola anotación por obra por ciclo, la más antigua', () => {
  const cola = [
    { table: 'anotaciones', uuid_sync: 'a3', operation: 'insert' as const, data: { obra_id: 'o1', escrito_en: 30 } },
    { table: 'anotaciones', uuid_sync: 'a1', operation: 'insert' as const, data: { obra_id: 'o1', escrito_en: 10 } },
    { table: 'anotaciones', uuid_sync: 'b1', operation: 'insert' as const, data: { obra_id: 'o2', escrito_en: 20 } }
  ];
  assert.deepEqual(diferirHijosDelLibro(cola).map((i) => i.uuid_sync).sort(), ['a1', 'b1']);
});

test('sync: el acuse espera a su anotación; lo demás pasa sin cambios', () => {
  const cola = [
    { table: 'anotaciones', uuid_sync: 'a1', operation: 'insert' as const, data: { obra_id: 'o1', escrito_en: 1 } },
    { table: 'anotacion_acuses', uuid_sync: 'k1', operation: 'insert' as const, data: { obra_id: 'o1', anotacion_uuid: 'a1' } },
    { table: 'events', uuid_sync: 'e1', operation: 'insert' as const, data: {} },
    { table: 'obras', uuid_sync: 'o9', operation: 'update' as const, data: {} }
  ];
  assert.deepEqual(diferirHijosDelLibro(cola).map((i) => i.uuid_sync), ['a1', 'e1', 'o9']);
});
