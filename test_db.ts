import { neon } from "@neondatabase/serverless";

async function run() {
  const dbUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres') ? process.env.DATABASE_URL : "postgresql://neondb_owner:npg_63SfsKCBdZwa@ep-billowing-mud-aq22ej6r-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const sql = neon(dbUrl);
  try {
    const rows = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log("Tables in DB:", rows.map(r => r.table_name).filter(name => !name.startsWith('pg_')));
  } catch (e) {
    console.error(e);
  }
}
run();
