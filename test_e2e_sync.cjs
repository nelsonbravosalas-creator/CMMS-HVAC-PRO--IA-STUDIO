// test_e2e_sync.cjs
const http = require('http');

const API_BASE = 'http://localhost:3000/api/sync';

async function fetchSync(payload) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch (e) {
    return { status: res.status, text };
  }
}

async function runTests() {
  console.log('=== Iniciando test de sincronización E2E (App -> Neon) ===');
  const now = Date.now();
  
  const tablesToTest = ['clients', 'branches', 'assets', 'preventive_maintenance', 'work_orders', 'users', 'reports'];
  
  for (const table of tablesToTest) {
    console.log(`\n--- Test CRUD para tabla: ${table} ---`);
    const uuid = `TEST-${table}-${now}`;
    
    // 1. Crear
    let dataPayload = { id: uuid, nombre: `Test ${table}` };
    if (table === 'assets') {
      dataPayload = { tag: uuid, nombre: `Test Asset ${now}`, tipo: 'Generador' };
    }
    
    console.log(`[Crear] Enviando INSERT sync para ${table}...`);
    const createRes = await fetchSync({
      inserts: [{ table, uuid_sync: uuid, data: dataPayload, updated_at: now }]
    });
    console.log(createRes);

    // 2. Editar
    let updatePayload = { ...dataPayload, nombre: `Test ${table} (Editado)` };
    if (table === 'assets') {
      updatePayload.nombre = `Test Asset ${now} (Editado)`;
    }
    console.log(`[Editar] Enviando UPDATE sync para ${table}...`);
    const updateRes = await fetchSync({
      updates: [{ table, uuid_sync: uuid, data: updatePayload, updated_at: now + 1000 }]
    });
    console.log(updateRes);

    // 3. Obtener (Pull)
    console.log(`[Leer] Haciendo PULL con lastSync ${now - 1000}...`);
    const pullRes = await fetchSync({ lastSync: now - 1000 });
    const found = (pullRes.data.serverChanges[table] || []).find(r => r.uuid_sync === uuid);
    if (found) {
       console.log('✅ Registro encontrado en el PULL');
    } else {
       console.log('❌ Registro NO encontrado en el PULL', pullRes.data.serverChanges[table]);
    }

    // 4. Borrar
    console.log(`[Borrar] Enviando DELETE para ${table}...`);
    const deleteRes = await fetchSync({
      deletes: [{ table, uuid_sync: uuid }]
    });
    if (deleteRes.data && deleteRes.data.success) {
        console.log(`✅ DELETE exitoso`);
    } else {
        console.log(`❌ DELETE falló`);
    }
  }

  console.log('\n=== Tests Finalizados ===');
}

runTests();
