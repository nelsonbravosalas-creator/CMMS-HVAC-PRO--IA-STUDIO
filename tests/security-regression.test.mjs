import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Express write and sync endpoints require write authorization', async () => {
  const source = await read('server.ts');
  const writeRoutes = source.match(/app\.(?:post|put|delete)\("\/api\/v1\/:cliente_id[^\n]+/g) || [];
  assert.ok(writeRoutes.length >= 10, 'expected protected v1 write routes');
  for (const route of writeRoutes) {
    assert.match(route, /requireWriteRole/, route);
  }
  assert.match(source, /app\.post\('\/api\/sync', requireWriteRole/);
  assert.match(source, /app\.post\("\/api\/sync\/:table", requireWriteRole/);
});

test('tenant upserts cannot update a row owned by another tenant', async () => {
  for (const file of ['server.ts', 'api/sync.ts']) {
    const source = await read(file);
    for (const table of ['assets', 'work_orders', 'inventory', 'preventive_maintenance']) {
      assert.match(
        source,
        new RegExp(`${table}\\.cliente_id = EXCLUDED\\.cliente_id`),
        `${file} must scope ${table} conflicts by tenant`
      );
    }
  }
});

test('production database URL is never accepted from the request body', async () => {
  const source = await read('server.ts');
  assert.doesNotMatch(source, /req\.body\.prodUrl/);
  assert.match(source, /process\.env\.PROD_DATABASE_URL/);
});

test('incomplete biometric authentication is disabled', async () => {
  const [login, api] = await Promise.all([
    read('src/pages/Login.tsx'),
    read('api/auth.ts')
  ]);
  assert.match(login, /acceso biométrico está temporalmente deshabilitado/i);
  assert.match(api, /status\(501\)/);
});

test('Vercel Hobby function count stays within the deployment limit', async () => {
  const apiFiles = (await readdir(new URL('../api/', import.meta.url)))
    .filter(file => /\.(?:js|ts)$/.test(file));
  assert.ok(apiFiles.length <= 12, `expected at most 12 Vercel functions, found ${apiFiles.length}`);

  const vercelConfig = await read('vercel.json');
  for (const action of ['biometric-verify', 'change-pin', 'logout', 'health']) {
    assert.match(vercelConfig, new RegExp(`auth\\.ts\\?action=${action}`));
  }
});

test('retired granular endpoint cannot claim successful persistence', async () => {
  const source = await read('server.ts');
  assert.match(source, /app\.post\("\/api\/cmms\/:resource"[\s\S]+?status\(410\)/);
});
