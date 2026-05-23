const fs = require('fs');
let data = fs.readFileSync('src/data/equipos.ts', 'utf8');
data = data.replace(/fechaInstalacion/g, 'fecha_instalacion')
           .replace(/vidaUtil/g, 'vida_util')
           .replace(/ultimoMantenimiento/g, 'ultimo_mantenimiento')
           .replace(/proximoMantenimiento/g, 'proximo_mantenimiento')
           .replace(/horasOperacion/g, 'horas_operacion');
fs.writeFileSync('src/data/equipos.ts', data);
