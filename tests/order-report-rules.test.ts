import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canCloseOrder, canMoveReport, getReportState } from '../src/rules/orderReportRules';
import { buildDraftReportFolio, buildFinalReportFolio, getReportDisplayFolio, isDraftReportFolio } from '../src/lib/reportFolio';

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

test('los informes muestran folios compactos y nunca el UUID técnico', () => {
  const uuid = '7188b974-143e-4742-a055-1d0948f3a9f7';
  assert.equal(buildDraftReportFolio(uuid), 'INF-BOR-7188B9');
  assert.equal(buildFinalReportFolio(uuid, new Date('2026-08-07T12:00:00Z')), 'INF-26-7188B974');
  assert.equal(getReportDisplayFolio('', uuid, uuid), 'INF-BOR-7188B9');
  assert.equal(getReportDisplayFolio('INF-26-00001234', uuid, uuid), 'INF-26-00001234');
  assert.equal(isDraftReportFolio('INF-PENDIENTE-7188B9'), true);
  assert.equal(isDraftReportFolio('INF-BOR-7188B9'), true);
  assert.equal(isDraftReportFolio('INF-26-7188B974'), false);
});

test('el informe conserva solo la firma técnica y nunca la firma del cliente', async () => {
  const [reportEditor, orderReports] = await Promise.all([
    readFile(new URL('../src/pages/EditorInforme.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/orders/OrderReportsSection.tsx', import.meta.url), 'utf8')
  ]);

  assert.match(reportEditor, /Firma del Técnico/);
  assert.match(reportEditor, /FullscreenSignatureModal/);
  assert.match(reportEditor, /firmas:\s*\{\s*tecnico:/);
  assert.doesNotMatch(reportEditor, /Firma Cliente|Firma del Cliente|signatureType|canvasCli/);
  assert.match(orderReports, /label="Firma técnico"/);
  assert.match(orderReports, /report\.data\?\.firmas\?\.tecnico/);
  assert.doesNotMatch(orderReports, /data\?\.firmas\?\.cliente/);
  assert.match(reportEditor, /const displayFolio = getReportDisplayFolio/);
  assert.match(reportEditor, /isNew \? 'Nuevo Informe' : displayFolio/);
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
