const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no configurada');
}

const sql = neon(process.env.DATABASE_URL);

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
