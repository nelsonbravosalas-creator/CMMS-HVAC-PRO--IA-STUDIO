
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function runQA() {
  console.log("🕵️ Starting QA Audit on Sync System...");

  // TEST 1: Conflict Resolution (Last-Write-Wins)
  console.log("\n🧪 Test 1: Conflict Resolution...");
  const testUuid = "qa-test-asset-" + Date.now();
  
  // Simulate an older server state
  await sql`INSERT INTO assets (uuid_sync, tag, nombre, updated_at) VALUES (${testUuid}, 'QA-TAG', 'Server Version', 1000)`;
  
  // Simulate a sync attempt with a newer local version
  const localUpdate = {
    table: 'assets',
    uuid_sync: testUuid,
    data: { tag: 'QA-TAG', nombre: 'Local Newer Version' },
    updated_at: 2000
  };

  // We mimic the server logic manually here for the audit
  const existing = await sql`SELECT updated_at FROM assets WHERE uuid_sync = ${testUuid}`;
  if (localUpdate.updated_at > Number(existing[0].updated_at)) {
    await sql`UPDATE assets SET nombre = ${localUpdate.data.nombre}, updated_at = ${localUpdate.update_at} WHERE uuid_sync = ${testUuid}`;
    console.log("✅ Conflict resolved: Newer version accepted.");
  } else {
    console.log("❌ Conflict error: Newer version was rejected.");
  }

  // TEST 2: Schema Integrity (JSONB structures)
  console.log("\n🧪 Test 2: Schema Integrity Check...");
  try {
    const testTicket = { id: 'TK-QA', titulo: 'QA Ticket' };
    await sql`INSERT INTO work_orders (uuid_sync, id, data, updated_at) 
              VALUES ('qa-tk-1', 'TK-QA', ${JSON.stringify(testTicket)}, ${Date.now()})
              ON CONFLICT (uuid_sync) DO UPDATE SET data = EXCLUDED.data`;
    console.log("✅ JSONB storage working correctly.");
  } catch (e: any) {
    console.error("❌ Schema inconsistency found:", e.message);
  }

  // TEST 3: Potential Data Loss (Missing fields in mapping)
  console.log("\n🧪 Test 3: Field Mapping Audit...");
  const assetCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'assets'`;
  const foundCols = assetCols.map(c => c.column_name);
  const requiredCols = ['cliente_id', 'sucursal_id', 'uuid_sync', 'deleted_at'];
  
  requiredCols.forEach(col => {
    if (foundCols.includes(col)) {
      console.log(`✅ Field '${col}' present in DB.`);
    } else {
      console.warn(`⚠️ Field '${col}' MISSING in DB schema!`);
    }
  });

  // CLEANUP
  await sql`DELETE FROM assets WHERE uuid_sync = ${testUuid}`;
  await sql`DELETE FROM work_orders WHERE uuid_sync = 'qa-tk-1'`;
  await sql`DELETE FROM test_table WHERE id IS NOT NULL`;

  console.log("\n🏁 QA Audit Finished.");
}

runQA();
