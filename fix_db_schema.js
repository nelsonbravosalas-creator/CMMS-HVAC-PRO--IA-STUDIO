import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no configurada');
}

const sql = neon(process.env.DATABASE_URL);

async function fixSchema() {
  console.log("🛠 Fix Schema...");
  
  // assets
  try { await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS cliente_id TEXT`; console.log('✅ assets.cliente_id'); } catch(e){}
  try { await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS sucursal_id TEXT`; console.log('✅ assets.sucursal_id');} catch(e){}

  // users
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS data JSONB`; console.log('✅ users.data');} catch(e){}

  // preventive_maintenance
  try { await sql`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS data JSONB`; console.log('✅ pm.data');} catch(e){}
  
  // work_orders
  try { await sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS data JSONB`; console.log('✅ wo.data');} catch(e){}

  // reports
  try { await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS data JSONB`; console.log('✅ rep.data');} catch(e){}

  // events
  try { await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS data JSONB`; console.log('✅ evt.data');} catch(e){}

  // clients
  try { await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS data JSONB`; console.log('✅ cli.data'); } catch(e){}

  // branches
  try { await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS data JSONB`; console.log('✅ bra.data'); } catch(e){}

  console.log("Done");
}

fixSchema().catch(console.error);
