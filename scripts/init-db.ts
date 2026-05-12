import { neon } from '@neondatabase/serverless';
import { EQUIPOS_DATA } from '../src/data/equipos.ts';
import { USUARIOS_MOCK, CLIENTES_MOCK } from '../src/data/usuarios.ts';
import { MANTENIMIENTOS_MOCK } from '../src/data/mantenimientos.ts';
import { TICKETS_MOCK } from '../src/data/tickets.ts';
import { INFORMES_MOCK } from '../src/data/informes.ts';
import { EVENTOS_MOCK } from '../src/data/eventos.ts';
import { SUCURSALES } from '../src/data/sucursales.ts';

async function initializeDB() {
  const defaultUrl = 'postgresql://neondb_owner:npg_63SfsKCBdZwa@ep-billowing-mud-aq22ej6r-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || defaultUrl;
  
  if (connectionString && (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://'))) {
    connectionString = defaultUrl;
  }

  if (!connectionString) {
    console.warn("⚠️ DATABASE_URL no está definida.");
    return;
  }

  try {
    console.log("Iniciando reconstrucción de tablas en Neon DB...");
    const sql = neon(connectionString);

    // 1. Activos (Equipos) - Recrear para asegurar estructura exacta
    console.log("Limpiando y recreando tabla 'activos'...");
    await sql`DROP TABLE IF EXISTS activos CASCADE;`;
    await sql`
      CREATE TABLE activos (
        tag TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        tipo TEXT,
        marca TEXT,
        modelo TEXT,
        serie TEXT,
        ubicacion TEXT,
        area TEXT,
        capacidad TEXT,
        voltaje TEXT,
        corriente TEXT,
        refrigerante TEXT,
        fecha_instalacion TEXT,
        vida_util INTEGER,
        estado TEXT DEFAULT 'operativo',
        ultimo_mantenimiento TEXT,
        proximo_mantenimiento TEXT,
        horas_operacion INTEGER DEFAULT 0,
        tecnicos JSONB,
        notas TEXT,
        uuid_sincro TEXT UNIQUE,
        modificado_en BIGINT
      );
    `;

    let importedEquipos = 0;
    const now = Date.now();
    for (const equipo of EQUIPOS_DATA) {
      await sql`
        INSERT INTO activos (
          tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, 
          voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, 
          ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, tecnicos, notas,
          uuid_sincro, modificado_en
        )
        VALUES (
          ${equipo.tag}, ${equipo.nombre}, ${equipo.tipo}, ${equipo.marca || ''}, 
          ${equipo.modelo || ''}, ${equipo.serie || ''}, ${equipo.ubicacion || ''}, 
          ${equipo.area || ''}, ${equipo.capacidad || ''}, ${equipo.voltaje || ''}, 
          ${equipo.corriente || ''}, ${equipo.refrigerante || ''}, ${equipo.fecha_instalacion || ''}, 
          ${equipo.vida_util || 0}, ${equipo.estado || 'operativo'}, ${equipo.ultimo_mantenimiento || ''}, 
          ${equipo.proximo_mantenimiento || ''}, ${equipo.horas_operacion || 0}, 
          ${JSON.stringify(equipo.tecnicos || [])}, ${equipo.notas || ''},
          ${equipo.tag}, ${now}
        );
      `;
      importedEquipos++;
    }
    console.log(`✅ Tabla 'activos' reseteada. ${importedEquipos} registros importados.`);

    // 2. Usuarios
    await sql`DROP TABLE IF EXISTS usuarios CASCADE;`;
    await sql`
      CREATE TABLE usuarios (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        correo TEXT,
        perfil TEXT,
        activo BOOLEAN,
        pin TEXT,
        uuid_sincro TEXT UNIQUE,
        modificado_en BIGINT,
        data JSONB
      );
    `;
    for (const u of USUARIOS_MOCK) {
      await sql`INSERT INTO usuarios (id, nombre, correo, perfil, activo, pin, uuid_sincro, modificado_en, data)
                VALUES (${u.id}, ${u.nombre}, ${u.correo}, ${u.perfil}, ${u.activo}, ${u.pin || '1234'}, ${u.id}, ${now}, ${JSON.stringify(u)})`;
    }

    // 3. Clientes
    await sql`DROP TABLE IF EXISTS clientes CASCADE;`;
    await sql`
      CREATE TABLE clientes (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        empresa TEXT,
        email TEXT,
        telefono TEXT,
        direccion TEXT,
        uuid_sincro TEXT UNIQUE,
        modificado_en BIGINT,
        data JSONB
      );
    `;
    for (const c of CLIENTES_MOCK) {
      await sql`INSERT INTO clientes (id, nombre, empresa, uuid_sincro, modificado_en, data)
                VALUES (${c.id}, ${c.nombre}, ${c.nombre}, ${c.id}, ${now}, ${JSON.stringify(c)})`;
    }

    // 4. Mantenimientos
    await sql`DROP TABLE IF EXISTS mantenimientos CASCADE;`;
    await sql`
      CREATE TABLE mantenimientos (
        id TEXT PRIMARY KEY,
        equipo_tag TEXT,
        tecnico_id TEXT,
        tipo TEXT,
        fecha TEXT,
        hallazgos TEXT,
        acciones TEXT,
        repuestos TEXT,
        uuid_sincro TEXT UNIQUE,
        modificado_en BIGINT
      );
    `;

    // 5. Tickets
    await sql`DROP TABLE IF EXISTS tickets CASCADE;`;
    await sql`
      CREATE TABLE tickets (
        id TEXT PRIMARY KEY,
        titulo TEXT,
        descripcion TEXT,
        prioridad TEXT,
        estado TEXT,
        equipo_tag TEXT,
        cliente_id TEXT,
        creado_por TEXT,
        asignado_a TEXT,
        fecha_creacion TEXT,
        uuid_sincro TEXT UNIQUE,
        modificado_en BIGINT
      );
    `;

    console.log("🎉 Reconstrucción de Neon DB completada.");
  } catch (error) {
    console.error("❌ Error inicializando la base de datos:", error);
  }
}

initializeDB();
