import { neon } from '@neondatabase/serverless';
import { EQUIPOS_DATA } from '../src/data/equipos.js';

async function initializeDB() {
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL no está definida. Saltando la inicialización de la base de datos.");
    return;
  }

  try {
    console.log("Iniciando conexión a Neon DB durante el build...");
    const sql = neon(process.env.DATABASE_URL);

    // Verificamos si la tabla existe
    const tableCheck = await sql`
      SELECT count(*) 
      FROM information_schema.tables 
      WHERE table_name = 'activos'
    `;

    if (tableCheck[0].count === '0' || tableCheck[0].count === 0) {
      console.log("Creando tabla 'activos' y poblando datos...");
      
      await sql`
        CREATE TABLE IF NOT EXISTS activos (
          id TEXT PRIMARY KEY,
          tag_tecnico TEXT,
          nombre TEXT,
          tipo TEXT,
          ubicacion TEXT,
          estado TEXT,
          ultima_revision TIMESTAMP
        );
      `;

      let imported = 0;
      for (const equipo of EQUIPOS_DATA) {
        await sql`
          INSERT INTO activos (id, tag_tecnico, nombre, tipo, ubicacion, estado, ultima_revision)
          VALUES (
            ${equipo.tag}, 
            ${equipo.tag}, 
            ${equipo.nombre}, 
            ${equipo.tipo}, 
            ${equipo.ubicacion || 'No definida'}, 
            ${equipo.estado || 'operativo'}, 
            ${new Date()}
          )
          ON CONFLICT (id) DO NOTHING;
        `;
        imported++;
      }
      console.log(`✅ Base de datos inicializada correctamente. ${imported} equipos importados.`);
    } else {
      console.log("✅ La tabla 'activos' ya existe. Omitiendo importación inicial para no sobreescribir.");
    }
  } catch (error) {
    console.error("❌ Error inicializando la base de datos:", error);
    // No hacemos throw error para no romper el build si hay error transitorio en Vercel
  }
}

initializeDB();
