import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Script de inicialización de Base de Datos para Neon
 * Ejecutar localmente con: tsx scripts/init-db.ts
 */
async function initDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('postgres')) {
    console.warn("âš ï¸  Advertencia: DATABASE_URL no encontrada o invÃ¡lida. Saltando inicializaciÃ³n de DB.");
    return;
  }

  const sql = neon(dbUrl);

  try {
    console.log("ðŸ“¦ Iniciando inicialización de esquema en Neon...");

    // Tabla de ACTIVOS (Esquema detallado)
    console.log("- Criando tabla: activos");
    await sql`
      CREATE TABLE IF NOT EXISTS activos (
        uuid_sincro TEXT PRIMARY KEY,
        tag TEXT UNIQUE,
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
        vida_util INTEGER DEFAULT 10,
        estado TEXT DEFAULT 'operativo',
        ultimo_mantenimiento TEXT,
        proximo_mantenimiento TEXT,
        horas_operacion INTEGER DEFAULT 0,
        tecnicos JSONB,
        notas TEXT,
        cliente_id TEXT,
        sucursal_id TEXT,
        modificado_en BIGINT,
        creado_en BIGINT
      )
    `;

    // Tabla de USUARIOS (Esquema detallado para login)
    console.log("- Criando tabla: usuarios");
    await sql`
      CREATE TABLE IF NOT EXISTS usuarios (
        uuid_sincro TEXT PRIMARY KEY,
        id TEXT UNIQUE,
        nombre TEXT,
        correo TEXT UNIQUE,
        perfil TEXT,
        pin TEXT,
        activo BOOLEAN DEFAULT true,
        data JSONB,
        modificado_en BIGINT,
        creado_en BIGINT
      )
    `;

    // Tablas genéricas con almacenamiento JSONB para flexibilidad
    const genericTables = [
      'mantenimientos', 
      'tickets', 
      'informes', 
      'eventos', 
      'clientes', 
      'sucursales'
    ];

    for (const table of genericTables) {
      console.log(`- Criando tabla: ${table}`);
      await (sql as any)(`
        CREATE TABLE IF NOT EXISTS ${table} (
          uuid_sincro TEXT PRIMARY KEY,
          id TEXT,
          data JSONB NOT NULL,
          modificado_en BIGINT,
          creado_en BIGINT
        )
      `);
    }

    // Tabla de Logs de Auditoría
    console.log("- Criando tabla: audit_logs");
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        user_id TEXT,
        details TEXT,
        timestamp BIGINT
      )
    `;

    console.log("- Verificando columnas en todas las tablas");
    const allTables = ['activos', 'usuarios', 'mantenimientos', 'tickets', 'informes', 'eventos', 'clientes', 'sucursales'];
    for (const table of allTables) {
      try {
        await (sql as any)(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS modificado_en BIGINT`);
        await (sql as any)(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS creado_en BIGINT`);
        await (sql as any)(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS uuid_sincro TEXT`);
      } catch (e) {
        console.warn(`  - Aviso: No se pudo verificar/añadir columnas en ${table}:`, e);
      }
    }

    console.log("✅ Base de datos inicializada con éxito.");
  } catch (error) {
    console.error("â Œ Error al inicializar base de datos:", error);
    process.exit(1);
  }
}

initDb();
