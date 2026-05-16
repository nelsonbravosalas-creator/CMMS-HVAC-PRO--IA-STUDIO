import { neon } from "@neondatabase/serverless";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !dbUrl.startsWith('postgres')) {
  throw new Error('DATABASE_URL debe estar configurada para revisar el esquema');
}
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
