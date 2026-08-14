import * as http from 'http';

const tables = ['activos', 'usuarios', 'mantenimientos', 'tickets', 'informes', 'eventos', 'clientes', 'sucursales'];

async function testAll() {
  for (const table of tables) {
    await new Promise((resolve) => {
      http.get(`http://localhost:3000/api/sync/${table}?since=0`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log(`Table: ${table} | Status: ${res.statusCode} | Data size: ${data.length}`);
          if (res.statusCode !== 200) console.log("Response:", data);
          resolve(null);
        });
      }).on("error", (err) => {
        console.log(`Table: ${table} | Error: ${err.message}`);
        resolve(null);
      });
    });
  }
}

testAll();
