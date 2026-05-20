import { getDb, closeDb } from "./api/_db";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();
const sql = getDb();

async function check() {
  try {
    const rows = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('sucursales', 'eventos', 'informes', 'clientes')
      ORDER BY table_name
    `;
    console.log("Schema info:", rows);
  } catch (e: any) {
    console.error("Error checking columns:", e.message);
  } finally {
    await closeDb();
  }
}
check();
