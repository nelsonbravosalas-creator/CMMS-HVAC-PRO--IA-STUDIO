import { neon } from '@neondatabase/serverless';

// Suppress DEP0169: url.parse() emitted by @neondatabase/serverless internally (Node 22+).
// The warning is harmless — Neon hasn't migrated to WHATWG URL yet.
process.on('warning', (w: NodeJS.ProcessEmittedWarning) => {
  if ((w as any).code === 'DEP0169') return;
  process.stderr.write(`${w.name}: ${w.message}\n`);
});

let cachedDb: any = null;

export function getDb() {
  if (cachedDb) return cachedDb;
  let url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no configurada en Vercel');
  if (!url.startsWith('postgres')) {
    throw new Error('DATABASE_URL must start with postgres');
  }
  cachedDb = neon(url);
  return cachedDb;
}
