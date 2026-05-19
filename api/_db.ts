import { neon } from '@neondatabase/serverless';

export function getDb() {
  let url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no configurada');
  if (!url.startsWith('postgres')) {
    url = 'postgresql://neondb_owner:npg_63SfsKCBdZwa@ep-billowing-mud-aq22ej6r-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  }
  return neon(url);
}
