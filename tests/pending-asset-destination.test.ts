import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assetQrUrl, parseAssetDestination } from '../src/navigation/pendingAssetDestination';

test('QR contains the immutable asset UUID and its client context', () => {
  const url = assetQrUrl(
    'https://cmms-hvac-pro-ia-studio.vercel.app',
    '0e8400-e29b-41d4-a716-446655440000',
    'QA-20260812'
  );
  assert.equal(url, 'https://cmms-hvac-pro-ia-studio.vercel.app/equipos/0e8400-e29b-41d4-a716-446655440000?cliente=QA-20260812');
});

test('validates and normalizes a scanned equipment destination', () => {
  assert.deepEqual(
    parseAssetDestination('https://cmms.example/equipos/QA12.AC.0001?cliente=QA-20260812'),
    { path: '/equipos/QA12.AC.0001', clientId: 'QA-20260812' }
  );
});

test('rejects malformed post-login destinations', () => {
  assert.equal(parseAssetDestination('https://evil.example/administracion'), null);
  assert.equal(parseAssetDestination('https://cmms.example/equipos/%2Fadministracion'), null);
  assert.equal(parseAssetDestination('javascript:alert(1)'), null);
});

test('equipment detail resolves an empty tenant cache before reporting not found', () => {
  const detail = readFileSync('src/pages/DetalleEquipo.tsx', 'utf8');
  assert.match(detail, /syncEngine\.triggerSync\(true\)/);
  assert.match(detail, /Sincronizando ficha del equipo/);
  assert.match(detail, /<QRLabelModal/);
  assert.match(detail, /cliente_id: equipo\.cliente_id/);
});
