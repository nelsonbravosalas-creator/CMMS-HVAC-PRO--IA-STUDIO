import * as dotenv from "dotenv";
import { getDb, closeDb } from "../api/_db";
import { ensureDatabaseSchema, getDatabaseHealth } from "../api/_schema";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function initDb() {
  try {
    console.log("Inicializando esquema PostgreSQL...");
    const sql = getDb();
    await ensureDatabaseSchema(sql);
    const health = await getDatabaseHealth(sql);
    console.log("Base de datos inicializada correctamente.");
    console.log(JSON.stringify({
      expectedTables: health.expectedTables,
      missingTables: health.missingTables,
      counts: health.counts
    }, null, 2));
  } catch (error) {
    console.error("Error al inicializar base de datos:", error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

initDb();
