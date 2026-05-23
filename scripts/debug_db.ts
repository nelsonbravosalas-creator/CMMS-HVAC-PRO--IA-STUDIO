
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debugDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL not found in .env.local");
    return;
  }

  console.log("🔍 Checking connection to:", dbUrl.split('@')[1]);
  const sql = neon(dbUrl);

  try {
    const tables = await sql`
      SELECT tablename as table_name 
      FROM pg_catalog.pg_tables 
      WHERE schemaname != 'pg_catalog' 
      AND schemaname != 'information_schema'
    `;
    console.log("📋 Existing tables:", tables.map(t => t.table_name).join(', '));

    for (const table of tables) {
      const name = table.table_name;
      const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = ${name}
      `;
      console.log(`\n🔹 Table: ${name}`);
      columns.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
    }

  } catch (error) {
    console.error("❌ Error connecting to database:", error);
  }
}

debugDb();
