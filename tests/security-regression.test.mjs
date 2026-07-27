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

test('asset identifiers are unique within a tenant, not globally', async () => {
  const [bootstrap, assetsHandler] = await Promise.all([
    read('scripts/db/bootstrap.ts'),
    read('server/vercel/handlers/assets.ts')
  ]);

  assert.match(bootstrap, /DROP CONSTRAINT IF EXISTS assets_tag_key/);
  assert.match(bootstrap, /DROP CONSTRAINT IF EXISTS assets_id_key/);
  assert.match(bootstrap, /idx_assets_tenant_tag_unique[\s\S]+\(cliente_id, tag\)/);
  assert.match(bootstrap, /idx_assets_tenant_id_unique[\s\S]+\(cliente_id, id\)/);
  assert.match(assetsHandler, /ON CONFLICT \(cliente_id, tag\) DO UPDATE SET/);
  assert.match(assetsHandler, /\(id = \$\{d\.sucursal_id\} OR uuid_sync = \$\{d\.sucursal_id\}\)/);
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
    ['admin.ts', 'auth.ts', 'communications.ts', 'core.ts', 'operations.ts', 'sync.ts'],
    `expected the six domain-grouped Vercel functions, found: ${apiFiles.join(', ')}`
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
  assert.match(vercelConfig, /admin\.ts\?handler=import-data/);
  assert.match(vercelConfig, /admin\.ts\?handler=init-db/);
  assert.match(vercelConfig, /communications\.ts\?handler=export/);
});

test('PWA keeps each deployment coherent and supports offline navigation', async () => {
  const source = await read('vite.config.ts');
  assert.match(source, /registerType: 'prompt'/);
  assert.match(source, /globPatterns: \['\*\*\/\*\.\{html,js,css,/);
  assert.match(source, /clientsClaim: false/);
  assert.match(source, /skipWaiting: false/);
  assert.match(source, /navigateFallback: '\/index\.html'/);
  assert.match(source, /navigateFallbackDenylist: \[\/\^\\\/api\\\//);
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
    permissionTypes,
    app,
    inventoryPage
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
    read('src/types.ts'),
    read('src/App.tsx'),
    read('src/pages/InventarioInterno.tsx')
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
  assert.match(orderEditor, /db\.ordenes_servicio\.get\(uuid\)[\s\S]+where\('id'\)\.equals\(rawId \|\| uuid\)\.first\(\)/);
  assert.match(orderEditor, /if \(existing\.uuid_sync !== uuid\) setUuid\(existing\.uuid_sync\)/);
  assert.match(layout, /href: "\/consola"[\s\S]+adminOnly: true/);
  assert.match(app, /path="\/consola"[\s\S]+isAdmin \? <Consola \/> : <AccessDenied/);
  assert.match(app, /path="\/configuracion"[\s\S]+isAdmin \? <Configuracion \/> : <AccessDenied/);
  assert.match(inventoryPage, /const canManageInventory = [\s\S]+administrador[\s\S]+supervisor[\s\S]+tecnico[\s\S]+contratista/);
  assert.match(inventoryPage, /\{canManageInventory && \([\s\S]+Registrar Recurso/);
});

test('admin function runtime imports use explicit ESM extensions', async () => {
  const [bootstrap, seed] = await Promise.all([
    read('scripts/db/bootstrap.ts'),
    read('scripts/db/parametric-seed.ts')
  ]);
  assert.match(bootstrap, /from "\.\/parametric-seed\.js"/);
  assert.match(bootstrap, /from "\.\/one-time-fresh-start\.js"/);
  assert.match(seed, /from "\.\/parametric-data\.js"/);
});

test('mobile dashboard cannot expand beyond the viewport', async () => {
  const [layout, dashboard] = await Promise.all([
    read('src/components/Layout.tsx'),
    read('src/pages/Dashboard.tsx')
  ]);
  assert.match(layout, /<main className=\{`flex-1 min-w-0[\s\S]+overflow-x-hidden/);
  assert.match(dashboard, /w-full min-w-0[\s\S]+overflow-x-hidden/);
  assert.match(dashboard, /grid w-full min-w-0 grid-cols-2[\s\S]+Filtrar por sucursal/);
  assert.match(dashboard, /className="w-full min-w-0[\s\S]+text-\[11px\]/);
});

test('mobile main menu supports right and left handed placement', async () => {
  const layout = await read('src/components/Layout.tsx');
  assert.match(layout, /localStorage\.getItem\('mobile_menu_side'\) === 'left'/);
  assert.match(layout, /localStorage\.setItem\('mobile_menu_side', menuPosition\)/);
  assert.match(layout, /top-1\/2 -translate-y-1\/2[\s\S]+menuPosition === 'right'[\s\S]+right-0 rounded-l-2xl[\s\S]+left-0 rounded-r-2xl/);
  assert.match(layout, /Mover controles al lado/);
});

test('mobile floating controls have a dedicated footer clearance area', async () => {
  const layout = await read('src/components/Layout.tsx');
  assert.match(layout, /aria-label="Fin del contenido"/);
  assert.match(layout, /min-h-44[\s\S]+lg:hidden/);
  assert.match(layout, /CMMS HVAC · Fin del contenido/);
});

test('sync inspector stays inside the mobile viewport', async () => {
  const [inspector, layout] = await Promise.all([
    read('src/components/debug/SyncInspectorPanel.tsx'),
    read('src/components/Layout.tsx')
  ]);
  assert.match(inspector, /fixed inset-x-3 bottom-28[\s\S]+lg:inset-x-auto/);
  assert.match(inspector, /h-\[min\(600px,calc\(100dvh-12rem\)\)\][\s\S]+w-full[\s\S]+max-w-\[450px\]/);
  assert.match(inspector, /Cerrar inspector de sincronización/);
  assert.match(inspector, /addEventListener\('open-sync-inspector'/);
  assert.doesNotMatch(inspector, /onClick=\{\(\) => setIsOpen\(!isOpen\)\}/);
  assert.match(layout, /dispatchEvent\(new CustomEvent\('open-sync-inspector'\)\)/);
  assert.match(layout, /Sync Inspector/);
});

test('dark theme preserves contrast across light-authored modules', async () => {
  const [css, layout, login] = await Promise.all([
    read('src/index.css'),
    read('src/components/Layout.tsx'),
    read('src/pages/Login.tsx')
  ]);

  assert.match(css, /\.dark \.bg-white,[\s\S]*?background-color:\s*#1e293b\s*!important/);
  assert.match(css, /\.dark \.text-slate-900,[\s\S]*?color:\s*#f8fafc\s*!important/);
  assert.match(css, /\.dark \.recharts-default-tooltip[\s\S]*?background-color:\s*#0f172a\s*!important/);
  assert.match(css, /\.dark #printable-tag[\s\S]*?background-color:\s*#ffffff\s*!important/);
  assert.match(layout, /localStorage\.getItem\('cmms_theme'\) === 'dark'/);
  assert.match(layout, /localStorage\.setItem\('cmms_theme', nextThemeIsDark \? 'dark' : 'light'\)/);
  assert.match(login, /localStorage\.getItem\('cmms_theme'\) !== 'light'/);
});
