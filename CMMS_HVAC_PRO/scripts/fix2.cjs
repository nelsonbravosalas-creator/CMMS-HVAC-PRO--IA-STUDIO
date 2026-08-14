const fs = require('fs');
['api/import-data.ts', 'scripts/init-db.ts', 'src/pages/Dashboard.tsx', 'src/pages/DetalleEquipo.tsx', 'src/pages/Equipos.tsx'].forEach(file => {
  let data = fs.readFileSync(file, 'utf8');
  data = data.replace(/fechaInstalacion/g, 'fecha_instalacion')
             .replace(/vidaUtil/g, 'vida_util')
             .replace(/ultimoMantenimiento/g, 'ultimo_mantenimiento')
             .replace(/proximoMantenimiento/g, 'proximo_mantenimiento')
             .replace(/horasOperacion/g, 'horas_operacion');
  fs.writeFileSync(file, data);
});
