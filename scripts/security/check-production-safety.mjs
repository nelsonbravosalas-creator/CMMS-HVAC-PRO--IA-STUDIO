import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const [seed, seedData, vite, vercel, authContext, qaPlan, productionQa, communications, sync, auth] = await Promise.all([
  read('scripts/db/parametric-seed.ts'),
  read('scripts/db/parametric-data.ts'),
  read('vite.config.ts'),
  read('vercel.json'),
  read('src/context/AuthContext.tsx'),
  read('docs/PLAN_QA_INSITU.md'),
  read('tests/production-functional-qa.mjs'),
  read('api/communications.ts'),
  read('server/vercel/handlers/sync.ts'),
  read('server/vercel/auth.ts')
]);

assert.doesNotMatch(seedData, /\$argon2(?:id)?\$/i, 'credential hashes must not be committed in seed data');
assert.match(seed, /CMMS_ENABLE_DEMO_USERS/);
assert.match(seed, /isHostedEnvironment/);
assert.match(seed, /LOWER\(correo\) LIKE '%@cmms\.local'/);
assert.match(seed, /operationalAdmins/);
assert.doesNotMatch(vite, /process\.env\.(?:GEMINI_API_KEY|GOOGLE_MAPS_PLATFORM_KEY)/);
for (const header of ['Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
  assert.match(vercel, new RegExp(header), `missing Vercel security header: ${header}`);
}
assert.match(authContext, /PERMISOS_POR_PERFIL\.visita/);
assert.doesNotMatch(authContext, /\|\| PERMISOS_POR_PERFIL\.administrador/);
assert.doesNotMatch(qaPlan, /`1234`/);
assert.doesNotMatch(productionQa, /@cmms\.local/);
assert.match(communications, /Idempotency-Key/);
assert.match(communications, /AbortController/);
assert.match(sync, /operationCount > 100/);
assert.doesNotMatch(sync, /LIMIT 1000/);
assert.match(auth, /cmms_sessions/);
assert.match(auth, /revoked_at IS NULL/);

console.log('Production security invariants verified.');
