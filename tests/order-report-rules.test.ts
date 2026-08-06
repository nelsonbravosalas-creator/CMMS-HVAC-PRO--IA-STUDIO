import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canCloseOrder, canMoveReport, getReportState } from '../src/rules/orderReportRules';

const report = (estado: string) => ({ data: { estado } }) as any;
const order = (estado: string, cliente = 'C1', sucursal = 'S1') => ({
  estado,
  cliente_id: cliente,
  sucursal_id: sucursal
}) as any;

test('una visita sin informes puede cerrarse', () => {
  assert.equal(canCloseOrder([]), true);
});

test('una orden con todos sus informes finalizados puede cerrarse', () => {
  assert.equal(canCloseOrder([report('finalizado'), report('firmado')]), true);
});

test('un solo borrador bloquea el cierre de la orden', () => {
  assert.equal(canCloseOrder([report('finalizado'), report('borrador')]), false);
});

test('los estados heredados firmados se normalizan como finalizados', () => {
  assert.equal(getReportState(report('firmado')), 'finalizado');
  assert.equal(getReportState(report('bloqueado')), 'finalizado');
});

test('el traslado exige órdenes abiertas del mismo cliente y sucursal', () => {
  assert.equal(canMoveReport(order('abierto'), order('en_progreso')), true);
  assert.equal(canMoveReport(order('cerrado'), order('abierto')), false);
  assert.equal(canMoveReport(order('abierto'), order('abierto', 'C2')), false);
  assert.equal(canMoveReport(order('abierto'), order('abierto', 'C1', 'S2')), false);
});

test('el servidor y la migración preservan las reglas críticas de la relación', async () => {
  const [syncHandler, bootstrap, cleanup, orderEditor, orderList] = await Promise.all([
    readFile(new URL('../server/vercel/handlers/sync.ts', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/db/bootstrap.ts', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/db/one-time-order-reports.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/EditorOrdenServicio.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/OrdenesServicio.tsx', import.meta.url), 'utf8')
  ]);

  assert.match(syncHandler, /orden_servicio_uuid es obligatorio para todo informe/);
  assert.match(syncHandler, /La firma principal de la orden es obligatoria para cerrarla/);
  assert.match(syncHandler, /No es posible cerrar la orden mientras existan informes sin finalizar/);
  assert.match(syncHandler, /No se puede eliminar una orden que contiene informes/);
  assert.match(syncHandler, /Solo un administrador puede eliminar órdenes de servicio/);
  assert.match(syncHandler, /Solo un administrador puede trasladar informes entre órdenes/);
  assert.match(bootstrap, /FOREIGN KEY \(orden_servicio_uuid\)[\s\S]+ON DELETE RESTRICT/);
  assert.match(cleanup, /await sql`DELETE FROM reports`/);
  assert.doesNotMatch(cleanup, /DELETE FROM (?!reports)/);
  assert.match(orderEditor, /setSavedOrderSignatures\(data\.firmas\)/);
  assert.match(orderEditor, /drawSavedSignature\(canvasTecRef\.current/);
  assert.match(orderEditor, /Descargar PDF resumen/);
  assert.match(orderList, /isAdmin && os\.informes\.length === 0/);
});
