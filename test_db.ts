import { neon } from "@neondatabase/serverless";

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('postgres')) {
    throw new Error('DATABASE_URL debe estar configurada para probar la base de datos');
  }
  const sql = neon(dbUrl);
  try {
    const rows = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log("Tables in DB:", rows.map(r => r.table_name).filter(name => !name.startsWith('pg_')));
  } catch (e) {
    console.error(e);
  }
}
run();
