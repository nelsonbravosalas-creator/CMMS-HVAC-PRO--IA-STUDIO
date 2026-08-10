import assert from 'node:assert/strict';

const baseUrl = (process.env.QA_BASE_URL || 'https://cmms-hvac-pro-ia-studio.vercel.app').replace(/\/$/, '');
const qaUsers = JSON.parse(process.env.QA_USERS_JSON || '[]');
if (!Array.isArray(qaUsers) || qaUsers.length === 0) {
  throw new Error('QA_USERS_JSON is required with [{"role":"...","email":"...","pin":"..."}]. Credentials are never stored in this test.');
}

async function login(email, pin) {
  const response = await fetch(`${baseUrl}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, pin })
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `Login failed for ${email}: ${response.status}`);
  const cookie = response.headers.getSetCookie?.()[0] || response.headers.get('set-cookie');
  assert.ok(cookie, `Session cookie missing for ${email}`);
  return { body, cookie: cookie.split(';', 1)[0] };
}

async function request(path, cookie, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      cookie
    }
  });
}

const health = await fetch(`${baseUrl}/api/health`);
assert.equal(health.status, 200, 'Health endpoint must be available');

const anonymousUsers = await fetch(`${baseUrl}/api/users`);
assert.equal(anonymousUsers.status, 401, 'Users endpoint must reject anonymous access');

const results = [];

for (const account of qaUsers) {
  const expectedRole = String(account.role || '');
  const email = String(account.email || '');
  const pin = String(account.pin || '');
  assert.match(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'QA account email is invalid');
  assert.match(pin, /^\d{6}$/, 'QA account PIN must contain 6 digits');
  const session = await login(email, pin);
  assert.equal(session.body?.user?.perfil, expectedRole, `Unexpected role for ${email}`);

  const syncStatus = await request('/api/sync/status', session.cookie);
  assert.equal(syncStatus.status, 200, `Sync status failed for ${expectedRole}`);

  const checks = [];
  const expectForbidden = async (name, path, options) => {
    const response = await request(path, session.cookie, options);
    const responseText = await response.text();
    assert.equal(
      response.status,
      403,
      `${expectedRole} unexpectedly passed ${name}: ${response.status} ${responseText.slice(0, 300)}`
    );
    checks.push(`${name}:403`);
  };

  if (expectedRole === 'administrador') {
    const [clients, users] = await Promise.all([
      request('/api/clients', session.cookie),
      request('/api/users', session.cookie)
    ]);
    assert.equal(clients.status, 200, 'Administrator cannot read clients');
    assert.equal(users.status, 200, 'Administrator cannot read users');
    const clientsBody = await clients.json();
    const clientRows = clientsBody.data || [];
    const eecolRows = clientRows.filter(row =>
      String(row.id) === 'C1' || String(row.data?.nombre || row.nombre || '').toUpperCase() === 'EECOL ELECTRIC'
    );
    assert.equal(eecolRows.length, 1, 'EECOL must have a single active client record');

    const branches = await request('/api/branches?cliente_id=C1', session.cookie);
    assert.equal(branches.status, 200, 'Administrator cannot read EECOL branches');
    const branchesBody = await branches.json();
    assert.equal((branchesBody.data || []).length, 10, 'EECOL must have 10 active branches');

    const invalidClient = await request('/api/clients', session.cookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: 'QA INVALIDO NO CREAR', rut: '1-1' })
    });
    assert.equal(invalidClient.status, 400, 'Invalid client RUT must be rejected');

    const invalidAsset = await request('/api/assets', session.cookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-id': 'C1' },
      body: '{}'
    });
    assert.equal(invalidAsset.status, 400, 'Asset without required fields must be rejected');

    const invalidExport = await request('/api/export', session.cookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    assert.equal(invalidExport.status, 400, 'Incomplete email export must be rejected');

    checks.push(
      'clients:200',
      'users:200',
      'eecol:1',
      'eecol-branches:10',
      'invalid-client:400',
      'invalid-asset:400',
      'invalid-export:400'
    );
  } else if (expectedRole === 'supervisor') {
    await expectForbidden('delete client', '/api/clients?id=QA-NO-EXISTE', { method: 'DELETE' });
  } else if (expectedRole === 'tecnico' || expectedRole === 'contratista') {
    await expectForbidden('delete work order', '/api/work-orders/QA-NO-EXISTE', { method: 'DELETE' });
    await expectForbidden('read users', '/api/users', { method: 'GET' });
  } else if (expectedRole === 'cliente') {
    await expectForbidden('create asset', '/api/assets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    await expectForbidden('delete work order', '/api/work-orders/QA-NO-EXISTE', { method: 'DELETE' });
  } else {
    await expectForbidden('create asset', '/api/assets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    await expectForbidden('push sync', '/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
  }

  if (expectedRole !== 'administrador') {
    await expectForbidden('administrative import', '/api/import-data', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
  }

  results.push({ role: expectedRole, login: 200, sync: 200, checks });
}

console.log(JSON.stringify({
  baseUrl,
  health: health.status,
  anonymousUsers: anonymousUsers.status,
  roles: results
}, null, 2));
