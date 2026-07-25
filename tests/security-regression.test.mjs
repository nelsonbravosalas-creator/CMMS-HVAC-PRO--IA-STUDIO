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
  for (const file of ['server.ts', 'server/vercel/handlers/sync.ts']) {
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
  assert.deepEqual(
    apiFiles.sort(),
    ['admin.ts', 'auth.ts', 'core.ts', 'operations.ts', 'sync.ts'],
    `expected exactly five grouped Vercel functions, found: ${apiFiles.join(', ')}`
  );

  const vercelConfig = await read('vercel.json');
  for (const action of ['biometric-verify', 'change-pin', 'logout', 'health']) {
    assert.match(vercelConfig, new RegExp(`auth\\.ts\\?action=${action}`));
  }
  for (const handler of ['assets', 'clients', 'users']) {
    assert.match(vercelConfig, new RegExp(`core\\.ts\\?handler=${handler}`));
  }
  for (const handler of ['maintenance', 'work-orders', 'inventory']) {
    assert.match(vercelConfig, new RegExp(`operations\\.ts\\?handler=${handler}`));
  }
  assert.match(vercelConfig, /sync\.ts\?handler=import-data/);
  assert.match(vercelConfig, /admin\.ts\?handler=init-db/);
});

test('retired granular endpoint cannot claim successful persistence', async () => {
  const source = await read('server.ts');
  assert.match(source, /app\.post\("\/api\/cmms\/:resource"[\s\S]+?status\(410\)/);
});

test('blocking native confirmation dialogs are not used', async () => {
  const files = (await readdir(new URL('../src/', import.meta.url), { recursive: true }))
    .filter(file => /\.(?:ts|tsx)$/.test(file));
  const offenders = [];

  for (const file of files) {
    const source = await read(`src/${file.replaceAll('\\', '/')}`);
    if (/\b(?:window\.)?confirm\s*\(/.test(source)) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `native confirm() can block Codex Desktop and PWA flows: ${offenders.join(', ')}`
  );

  const [app, globalAlert] = await Promise.all([
    read('src/App.tsx'),
    read('src/components/GlobalAlertDialog.tsx')
  ]);
  assert.match(app, /<GlobalAlertDialog \/>/);
  assert.match(globalAlert, /window\.alert = \(message\?: unknown\)/);
  assert.match(globalAlert, /role="alertdialog"/);
});

test('role permissions are enforced by resource in UI and Vercel handlers', async () => {
  const [
    auth,
    sync,
    workOrders,
    assets,
    maintenance,
    inventory,
    layout,
    reportsPage,
    orderList,
    orderEditor,
    permissionTypes
  ] = await Promise.all([
    read('server/vercel/auth.ts'),
    read('server/vercel/handlers/sync.ts'),
    read('server/vercel/handlers/work-orders.ts'),
    read('server/vercel/handlers/assets.ts'),
    read('server/vercel/handlers/maintenance.ts'),
    read('server/vercel/handlers/inventory.ts'),
    read('src/components/Layout.tsx'),
    read('src/pages/Reportes.tsx'),
    read('src/pages/OrdenesServicio.tsx'),
    read('src/pages/EditorOrdenServicio.tsx'),
    read('src/types.ts')
  ]);

  assert.match(auth, /role === 'cliente'[\s\S]+resource === 'work_orders' && operation === 'insert'/);
  assert.match(auth, /role === 'tecnico' \|\| role === 'contratista'/);
  assert.match(auth, /role === 'supervisor'[\s\S]+resource === 'assets'/);
  assert.match(sync, /assertWritableTable\(table, authUser, 'insert'\)/);
  assert.match(sync, /assertWritableTable\(table, authUser, 'update'\)/);
  assert.match(sync, /assertWritableTable\(table, authUser, 'delete'\)/);

  for (const [name, source, resource] of [
    ['work-orders', workOrders, 'work_orders'],
    ['assets', assets, 'assets'],
    ['maintenance', maintenance, 'preventive_maintenance'],
    ['inventory', inventory, 'inventory']
  ]) {
    assert.match(
      source,
      new RegExp(`canWriteResource\\(user, '${resource}', writeOperation\\)`),
      `${name} must enforce resource-specific write permissions`
    );
  }

  assert.match(layout, /item\.href === "\/reportes"[\s\S]+permisos\?\.ver_reportes/);
  assert.match(reportsPage, /if \(!permisos\?\.ver_reportes\)/);
  assert.match(permissionTypes, /crear_orden_servicio: boolean/);
  assert.match(orderList, /permisos\?\.crear_orden_servicio[\s\S]+Nueva Orden/);
  assert.match(orderList, /value=\{statusFilter\}[\s\S]+setStatusFilter/);
  assert.doesNotMatch(orderList, /FileDown|Trash2/);
  assert.match(orderEditor, /isNew && !permisos\?\.crear_orden_servicio/);
  assert.match(orderEditor, /isReadOnly = !permisos\?\.crear_orden_servicio/);
});
