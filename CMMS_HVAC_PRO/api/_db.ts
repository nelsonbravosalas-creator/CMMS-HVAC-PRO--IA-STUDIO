import { neon } from '@neondatabase/serverless';

export function getDb() {
  let url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no configurada en Vercel');
  if (!url.startsWith('postgres')) {
    throw new Error('DATABASE_URL must start with postgres');
  }
  return neon(url);
}
