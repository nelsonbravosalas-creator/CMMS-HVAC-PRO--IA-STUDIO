const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_63SfsKCBdZwa@ep-billowing-mud-aq22ej6r-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

async function run() {
  try {
     console.log('Creando tabla ordenes_servicio...');
     await sql`CREATE TABLE IF NOT EXISTS ordenes_servicio (
            uuid_sync TEXT PRIMARY KEY,
            id TEXT,
            draft_key TEXT,
            sync_status TEXT DEFAULT 'synced',
            updated_at BIGINT,
            created_at BIGINT,
            data JSONB
     )`;
     console.log('Tabla OK.');
  } catch(e) {
     console.error(e);
  }
}
run();
