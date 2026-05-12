import { neon } from '@neondatabase/serverless';
import { EQUIPOS_DATA } from '../src/data/equipos.js';
import { USUARIOS_MOCK, CLIENTES_MOCK } from '../src/data/usuarios.js';
import { MANTENIMIENTOS_MOCK } from '../src/data/mantenimientos.js';
import { TICKETS_MOCK } from '../src/data/tickets.js';
import { INFORMES_MOCK } from '../src/data/informes.js';
import { EVENTOS_MOCK } from '../src/data/eventos.js';
import { SUCURSALES } from '../src/data/sucursales.js';

async function initializeDB() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.warn("⚠️ DATABASE_URL no está definida. Saltando la inicialización de la base de datos.");
    return;
  }

  if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
    console.warn("⚠️ DATABASE_URL no es una URL de PostgreSQL válida (debe empezar con postgres://). Saltando inicialización.");
    return;
  }

  try {
    console.log("Iniciando conexión a Neon DB durante el build...");
    const sql = neon(connectionString);

    // 1. Activos (Equipos)
    const tableActivos = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'activos'`;
    if (tableActivos[0].count === '0' || tableActivos[0].count === 0) {
      console.log("Creando tabla 'activos'...");
      await sql`
        CREATE TABLE IF NOT EXISTS activos (
          id TEXT PRIMARY KEY,
          tag_tecnico TEXT,
          nombre TEXT,
          tipo TEXT,
          ubicacion TEXT,
          estado TEXT,
          ultima_revision TIMESTAMP,
          data JSONB
        );
      `;

      let imported = 0;
      for (const equipo of EQUIPOS_DATA) {
        await sql`
          INSERT INTO activos (id, tag_tecnico, nombre, tipo, ubicacion, estado, ultima_revision, data)
          VALUES (
            ${equipo.tag}, 
            ${equipo.tag}, 
            ${equipo.nombre}, 
            ${equipo.tipo}, 
            ${equipo.ubicacion || 'No definida'}, 
            ${equipo.estado || 'operativo'}, 
            ${new Date()},
            ${JSON.stringify(equipo)}
          )
          ON CONFLICT (id) DO NOTHING;
        `;
        imported++;
      }
      console.log(`✅ Base de datos 'activos' inicializada. ${imported} equipos importados.`);
    } else {
      console.log("✅ La tabla 'activos' ya existe.");
    }

    // 2. Usuarios
    const tableUsuarios = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'usuarios'`;
    if (tableUsuarios[0].count === '0' || tableUsuarios[0].count === 0) {
      console.log("Creando tabla 'usuarios'...");
      await sql`
        CREATE TABLE IF NOT EXISTS usuarios (
          id TEXT PRIMARY KEY,
          nombre TEXT,
          correo TEXT,
          perfil TEXT,
          activo BOOLEAN,
          data JSONB
        );
      `;
      let imported = 0;
      for (const usuario of USUARIOS_MOCK) {
        await sql`
          INSERT INTO usuarios (id, nombre, correo, perfil, activo, data)
          VALUES (${usuario.id}, ${usuario.nombre}, ${usuario.correo}, ${usuario.perfil}, ${usuario.activo}, ${JSON.stringify(usuario)})
          ON CONFLICT (id) DO NOTHING;
        `;
        imported++;
      }
      console.log(`✅ Base de datos 'usuarios' inicializada. ${imported} usuarios importados.`);
    }

    // 3. Mantenimientos
    const tableMantenimientos = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'mantenimientos'`;
    if (tableMantenimientos[0].count === '0' || tableMantenimientos[0].count === 0) {
      console.log("Creando tabla 'mantenimientos'...");
      await sql`
        CREATE TABLE IF NOT EXISTS mantenimientos (
          id TEXT PRIMARY KEY,
          tag TEXT,
          tipo TEXT,
          fecha TEXT,
          estado TEXT,
          data JSONB
        );
      `;
      let imported = 0;
      for (const m of MANTENIMIENTOS_MOCK) {
        await sql`
          INSERT INTO mantenimientos (id, tag, tipo, fecha, estado, data)
          VALUES (${m.id}, ${m.tag}, ${m.tipo}, ${m.fecha}, ${m.estado}, ${JSON.stringify(m)})
          ON CONFLICT (id) DO NOTHING;
        `;
        imported++;
      }
      console.log(`✅ Base de datos 'mantenimientos' inicializada. ${imported} registros importados.`);
    }

    // 4. Tickets
    const tableTickets = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'tickets'`;
    if (tableTickets[0].count === '0' || tableTickets[0].count === 0) {
      console.log("Creando tabla 'tickets'...");
      await sql`
        CREATE TABLE IF NOT EXISTS tickets (
          id TEXT PRIMARY KEY,
          tag TEXT,
          titulo TEXT,
          estado TEXT,
          prioridad TEXT,
          data JSONB
        );
      `;
      let imported = 0;
      for (const t of TICKETS_MOCK) {
        await sql`
          INSERT INTO tickets (id, tag, titulo, estado, prioridad, data)
          VALUES (${t.id}, ${t.tag}, ${t.titulo}, ${t.estado}, ${t.prioridad}, ${JSON.stringify(t)})
          ON CONFLICT (id) DO NOTHING;
        `;
        imported++;
      }
      console.log(`✅ Base de datos 'tickets' inicializada. ${imported} registros importados.`);
    }

    // 5. Informes
    const tableInformes = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'informes'`;
    if (tableInformes[0].count === '0' || tableInformes[0].count === 0) {
      console.log("Creando tabla 'informes'...");
      await sql`
        CREATE TABLE IF NOT EXISTS informes (
          id TEXT PRIMARY KEY,
          tag TEXT,
          fecha TEXT,
          estado TEXT,
          data JSONB
        );
      `;
      let imported = 0;
      for (const t of INFORMES_MOCK) {
        await sql`
          INSERT INTO informes (id, tag, fecha, estado, data)
          VALUES (${t.id}, ${t.tag}, ${t.fecha}, ${t.estado}, ${JSON.stringify(t)})
          ON CONFLICT (id) DO NOTHING;
        `;
        imported++;
      }
      console.log(`✅ Base de datos 'informes' inicializada. ${imported} registros importados.`);
    }

    // 6. Eventos
    const tableEventos = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'eventos'`;
    if (tableEventos[0].count === '0' || tableEventos[0].count === 0) {
      console.log("Creando tabla 'eventos'...");
      await sql`
        CREATE TABLE IF NOT EXISTS eventos (
          id TEXT PRIMARY KEY,
          tipo TEXT,
          nivel TEXT,
          timestamp TEXT,
          data JSONB
        );
      `;
      let imported = 0;
      for (const t of EVENTOS_MOCK) {
        await sql`
          INSERT INTO eventos (id, tipo, nivel, timestamp, data)
          VALUES (${t.id}, ${t.tipo}, ${t.nivel}, ${t.timestamp}, ${JSON.stringify(t)})
          ON CONFLICT (id) DO NOTHING;
        `;
        imported++;
      }
      console.log(`✅ Base de datos 'eventos' inicializada. ${imported} registros importados.`);
    }

    // 7. Clientes
    const tableClientes = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'clientes'`;
    if (tableClientes[0].count === '0' || tableClientes[0].count === 0) {
      console.log("Creando tabla 'clientes'...");
      await sql`
        CREATE TABLE IF NOT EXISTS clientes (
          id TEXT PRIMARY KEY,
          nombre TEXT,
          rut TEXT,
          plan TEXT,
          data JSONB
        );
      `;
      let imported = 0;
      for (const t of CLIENTES_MOCK) {
        await sql`
          INSERT INTO clientes (id, nombre, rut, plan, data)
          VALUES (${t.id}, ${t.nombre}, ${t.rut}, ${t.plan}, ${JSON.stringify(t)})
          ON CONFLICT (id) DO NOTHING;
        `;
        imported++;
      }
      console.log(`✅ Base de datos 'clientes' inicializada. ${imported} registros importados.`);
    }

    // 8. Sucursales
    const tableSucursales = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'sucursales'`;
    if (tableSucursales[0].count === '0' || tableSucursales[0].count === 0) {
      console.log("Creando tabla 'sucursales'...");
      await sql`
        CREATE TABLE IF NOT EXISTS sucursales (
          id TEXT PRIMARY KEY,
          nombre TEXT,
          data JSONB
        );
      `;
      let imported = 0;
      for (const s of SUCURSALES) {
        await sql`
          INSERT INTO sucursales (id, nombre, data)
          VALUES (${s.id}, ${s.nombre}, ${JSON.stringify(s)})
          ON CONFLICT (id) DO NOTHING;
        `;
        imported++;
      }
      console.log(`✅ Base de datos 'sucursales' inicializada. ${imported} registros importados.`);
    }

    console.log("🎉 Inicialización de Neon DB completada.");
  } catch (error) {
    console.error("❌ Error inicializando la base de datos:", error);
    // No hacemos throw error para no romper el build
  }
}

initializeDB();
