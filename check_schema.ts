import { neon } from "@neondatabase/serverless";

const dbUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres') ? process.env.DATABASE_URL : "postgresql://neondb_owner:npg_63SfsKCBdZwa@ep-billowing-mud-aq22ej6r-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(dbUrl);

async function check() {
  try {
    const rows = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('sucursales', 'eventos', 'informes', 'clientes')
      ORDER BY table_name
    `;
    console.log("Schema info:", rows);
  } catch (e) {
    console.error("Error checking columns:", e.message);
  }
}
check();
