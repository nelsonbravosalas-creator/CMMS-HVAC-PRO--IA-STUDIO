
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const getSql = () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL no definida');
  return neon(dbUrl);
};

async function ensureTables() {
  try {
    const sql = getSql();
    console.log("📦 Initializing Database Schema...");
    
    // Rename old tables if they exist
    const renameTables = async () => {
      try { await sql`ALTER TABLE IF EXISTS activos RENAME TO assets`; } catch (e) {}
      try { await sql`ALTER TABLE IF EXISTS usuarios RENAME TO users`; } catch (e) {}
    }
    await renameTables();

    await sql`CREATE TABLE IF NOT EXISTS assets (
      uuid_sync TEXT PRIMARY KEY, tag TEXT UNIQUE, nombre TEXT NOT NULL, tipo TEXT, marca TEXT, modelo TEXT, serie TEXT, 
      ubicacion TEXT, area TEXT, capacidad TEXT, voltaje TEXT, corriente TEXT, refrigerante TEXT, fecha_instalacion TEXT, 
      vida_util INTEGER DEFAULT 10, estado TEXT DEFAULT 'operativo', ultimo_mantenimiento TEXT, proximo_mantenimiento TEXT, 
      horas_operacion INTEGER DEFAULT 0, tecnicos JSONB, notas TEXT, cliente_id TEXT, sucursal_id TEXT, 
      updated_at BIGINT, created_at BIGINT, deleted_at BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS users (
      uuid_sync TEXT PRIMARY KEY, id TEXT UNIQUE, nombre TEXT, correo TEXT UNIQUE, perfil TEXT, pin TEXT, 
      activo BOOLEAN DEFAULT true, data JSONB, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS preventive_maintenance (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS work_orders (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS reports (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS events (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS clients (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS branches (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS catalog_asset_types (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS settings (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;
    await sql`CREATE TABLE IF NOT EXISTS ordenes_servicio (uuid_sync TEXT PRIMARY KEY, id TEXT, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT, deleted_at BIGINT)`;


    await sql`CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, user_id TEXT NOT NULL, payload JSONB, timestamp BIGINT NOT NULL)`;

    console.log("✅ Database Schema integrity check completed");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
  }
}

ensureTables();
