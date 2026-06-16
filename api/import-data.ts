import { neon } from '@neondatabase/serverless';
import { requireRole } from './_auth.js';
import { EQUIPOS_DATA } from '../src/data/assets.js';
import { CLIENTES_MOCK } from '../src/data/users.js';
import { MANTENIMIENTOS_MOCK } from '../src/data/preventive_maintenance.js';
import { TICKETS_MOCK } from '../src/data/work_orders.js';
import { INFORMES_MOCK } from '../src/data/reports.js';
import { EVENTOS_MOCK } from '../src/data/events.js';
import { SUCURSALES } from '../src/data/branches.js';

const BACKEND_USUARIOS_SEED = [
  {
    id: 'U1',
    nombre: 'Nelson Bravo',
    correo: process.env.SEED_NELSON_EMAIL || '',
    perfil: 'programador',
    activo: true,
    puedeEditarMantenimientos: true,
    pin: process.env.SEED_NELSON_PIN_HASH
  },
  {
    id: 'U2',
    nombre: 'Gonzalo Bravo',
    correo: process.env.SEED_GONZALO_EMAIL || '',
    perfil: 'administrador',
    activo: true,
    puedeEditarMantenimientos: true,
    pin: process.env.SEED_GONZALO_PIN_HASH
  }
];

export default async function handler(req, res) {
  const user = requireRole(['administrador', 'programador'])(req, res);
  if (!user) return;

  let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    return res.status(500).json({ success: false, error: "Missing DATABASE_URL / POSTGRES_URL" });
  }
  if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
    return res.status(500).json({ success: false, error: "Invalid DATABASE_URL format" });
  }

  if (req.method === 'POST' || req.method === 'GET') {
    try {
      const sql = neon(connectionString);
      let resultados = {};

      const tableActivosCount = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'assets'`;
      if (tableActivosCount[0].count === '0' || tableActivosCount[0].count === 0) {
        await sql`
          CREATE TABLE IF NOT EXISTS activos (
            id TEXT PRIMARY KEY,
            tag TEXT,
            nombre TEXT,
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
            estado TEXT,
            ultimo_mantenimiento TEXT,
            proximo_mantenimiento TEXT,
            horas_operacion INTEGER,
            notas TEXT,
            data JSONB
          );
        `;
      } else {
        // Intentar agregar columnas si faltan en DB existente
        try {
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS tag TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS marca TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS modelo TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS serie TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS area TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS capacidad TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS voltaje TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS corriente TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS refrigerante TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS fecha_instalacion TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS vida_util INTEGER`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS ultimo_mantenimiento TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS proximo_mantenimiento TEXT`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS horas_operacion INTEGER`;
          await sql`ALTER TABLE activos ADD COLUMN IF NOT EXISTS notas TEXT`;
        } catch (e) {
          console.warn("Fallo al actualizar columnas de activos:", e.message);
        }
      }

      const checkActivos = await sql`SELECT count(*) FROM assets`;
      if (checkActivos[0].count === '0' || checkActivos[0].count === 0 || req.query.force === 'true') {
        let count = 0;
        for (const equipo of EQUIPOS_DATA) {
          await sql`
            INSERT INTO assets (
              id, tag, nombre, tipo, marca, modelo, serie, ubicacion, area, capacidad, 
              voltaje, corriente, refrigerante, fecha_instalacion, vida_util, estado, 
              ultimo_mantenimiento, proximo_mantenimiento, horas_operacion, notas, data
            )
            VALUES (
              ${equipo.tag}, 
              ${equipo.tag}, 
              ${equipo.nombre}, 
              ${equipo.tipo}, 
              ${equipo.marca || ''}, 
              ${equipo.modelo || ''}, 
              ${equipo.serie || ''}, 
              ${equipo.ubicacion || 'No definida'}, 
              ${equipo.area || ''}, 
              ${equipo.capacidad || ''}, 
              ${equipo.voltaje || ''}, 
              ${equipo.corriente || ''}, 
              ${equipo.refrigerante || ''}, 
              ${equipo.fecha_instalacion || ''}, 
              ${equipo.vida_util || 0}, 
              ${equipo.estado || 'operativo'}, 
              ${equipo.ultimo_mantenimiento || ''}, 
              ${equipo.proximo_mantenimiento || ''}, 
              ${equipo.horas_operacion || 0}, 
              ${equipo.notas || ''}, 
              ${JSON.stringify(equipo)}
            )
            ON CONFLICT (id) DO UPDATE SET
              nombre = EXCLUDED.nombre,
              tipo = EXCLUDED.tipo,
              marca = EXCLUDED.marca,
              modelo = EXCLUDED.modelo,
              serie = EXCLUDED.serie,
              ubicacion = EXCLUDED.ubicacion,
              area = EXCLUDED.area,
              capacidad = EXCLUDED.capacidad,
              voltaje = EXCLUDED.voltaje,
              corriente = EXCLUDED.corriente,
              refrigerante = EXCLUDED.refrigerante,
              fecha_instalacion = EXCLUDED.fecha_instalacion,
              vida_util = EXCLUDED.vida_util,
              estado = EXCLUDED.estado,
              ultimo_mantenimiento = EXCLUDED.ultimo_mantenimiento,
              proximo_mantenimiento = EXCLUDED.proximo_mantenimiento,
              horas_operacion = EXCLUDED.horas_operacion,
              notas = EXCLUDED.notas,
              data = EXCLUDED.data;
          `;
          count++;
        }
        resultados['assets'] = count;
      } else {
        resultados['assets'] = `Skip (already has ${checkActivos[0].count} recs)`;
      }

      const createTableUsuarios = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'users'`;
      if (createTableUsuarios[0].count === '0' || createTableUsuarios[0].count === 0) {
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
        let count = 0;
        for (const usuario of BACKEND_USUARIOS_SEED) {
          const { pin, ...safeUsuario } = usuario;
          await sql`
            INSERT INTO users (id, nombre, correo, perfil, activo, pin, data)
            VALUES (${usuario.id}, ${usuario.nombre}, ${usuario.correo}, ${usuario.perfil}, ${usuario.activo}, ${pin || null}, ${JSON.stringify(safeUsuario)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['users'] = count;
      }

      const createTableMante = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'preventive_maintenance'`;
      if (createTableMante[0].count === '0' || createTableMante[0].count === 0) {
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
        let count = 0;
        for (const m of MANTENIMIENTOS_MOCK) {
          await sql`
            INSERT INTO preventive_maintenance (id, tag, tipo, fecha, estado, data)
            VALUES (${m.id}, ${m.tag}, ${m.tipo}, ${m.fecha}, ${m.estado}, ${JSON.stringify(m)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['preventive_maintenance'] = count;
      }

      const createTableTickets = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'work_orders'`;
      if (createTableTickets[0].count === '0' || createTableTickets[0].count === 0) {
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
        let count = 0;
        for (const t of TICKETS_MOCK) {
          await sql`
            INSERT INTO work_orders (id, tag, titulo, estado, prioridad, data)
            VALUES (${t.id}, ${t.tag}, ${t.titulo}, ${t.estado}, ${t.prioridad}, ${JSON.stringify(t)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['work_orders'] = count;
      }

      const createTableInformes = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'reports'`;
      if (createTableInformes[0].count === '0' || createTableInformes[0].count === 0) {
        await sql`
          CREATE TABLE IF NOT EXISTS informes (
            id TEXT PRIMARY KEY,
            tag TEXT,
            fecha TEXT,
            estado TEXT,
            data JSONB
          );
        `;
        let count = 0;
        for (const t of INFORMES_MOCK) {
          await sql`
            INSERT INTO reports (id, tag, fecha, estado, data)
            VALUES (${t.id}, ${t.tag}, ${t.fecha}, ${t.estado}, ${JSON.stringify(t)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['reports'] = count;
      }

      const createTableEventos = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'events'`;
      if (createTableEventos[0].count === '0' || createTableEventos[0].count === 0) {
        await sql`
          CREATE TABLE IF NOT EXISTS eventos (
            id TEXT PRIMARY KEY,
            tipo TEXT,
            nivel TEXT,
            timestamp TEXT,
            data JSONB
          );
        `;
        let count = 0;
        for (const t of EVENTOS_MOCK) {
          await sql`
            INSERT INTO events (id, tipo, nivel, timestamp, data)
            VALUES (${t.id}, ${t.tipo}, ${t.nivel}, ${t.timestamp}, ${JSON.stringify(t)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['events'] = count;
      }

      const createTableClientes = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'clients'`;
      if (createTableClientes[0].count === '0' || createTableClientes[0].count === 0) {
        await sql`
          CREATE TABLE IF NOT EXISTS clientes (
            id TEXT PRIMARY KEY,
            nombre TEXT,
            rut TEXT,
            plan TEXT,
            data JSONB
          );
        `;
        let count = 0;
        for (const t of CLIENTES_MOCK) {
          await sql`
            INSERT INTO clients (id, nombre, rut, plan, data)
            VALUES (${t.id}, ${t.nombre}, ${t.rut}, ${t.plan}, ${JSON.stringify(t)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['clients'] = count;
      }

      const createTableSucursales = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'branches'`;
      if (createTableSucursales[0].count === '0' || createTableSucursales[0].count === 0) {
        await sql`
          CREATE TABLE IF NOT EXISTS sucursales (
            id TEXT PRIMARY KEY,
            nombre TEXT,
            data JSONB
          );
        `;
        let count = 0;
        for (const s of SUCURSALES) {
          await sql`
            INSERT INTO branches (id, nombre, data)
            VALUES (${s.id}, ${s.nombre}, ${JSON.stringify(s)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['branches'] = count;
      }

      return res.status(200).json({ success: true, message: "Importación finalizada.", resultados });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed." });
}
