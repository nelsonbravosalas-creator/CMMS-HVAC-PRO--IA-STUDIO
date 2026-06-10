import { neon } from '@neondatabase/serverless';

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
