import { getDb, closeDb } from "./api/_db";
import * as dotenv from "dotenv";

async function run() {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
  const sql = getDb();
  try {
    const rows = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log("Tables in DB:", rows.map(r => r.table_name).filter(name => !name.startsWith('pg_')));
  } catch (e) {
    console.error(e);
  } finally {
    await closeDb();
  }
}
run();
