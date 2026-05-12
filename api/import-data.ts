import { neon } from '@neondatabase/serverless';
import { EQUIPOS_DATA } from '../src/data/equipos.js';
import { USUARIOS_MOCK, CLIENTES_MOCK } from '../src/data/usuarios.js';
import { MANTENIMIENTOS_MOCK } from '../src/data/mantenimientos.js';
import { TICKETS_MOCK } from '../src/data/tickets.js';
import { INFORMES_MOCK } from '../src/data/informes.js';
import { EVENTOS_MOCK } from '../src/data/eventos.js';

export default async function handler(req, res) {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    return res.status(500).json({ success: false, error: "Missing DATABASE_URL / POSTGRES_URL" });
  }

  if (req.method === 'POST' || req.method === 'GET') {
    try {
      const sql = neon(connectionString);
      let resultados = {};

      const createTableActivos = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'activos'`;
      if (createTableActivos[0].count === '0' || createTableActivos[0].count === 0) {
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
        let count = 0;
        for (const equipo of EQUIPOS_DATA) {
          const id = equipo.tag;
          const tag_tecnico = equipo.tag;
          const nombre = equipo.nombre;
          const tipo = equipo.tipo;
          const ubicacion = equipo.ubicacion || 'No definida';
          const estado = equipo.estado || 'operativo';
          const ultima_revision = new Date();

          await sql`
            INSERT INTO activos (id, tag_tecnico, nombre, tipo, ubicacion, estado, ultima_revision, data)
            VALUES (${id}, ${tag_tecnico}, ${nombre}, ${tipo}, ${ubicacion}, ${estado}, ${ultima_revision}, ${JSON.stringify(equipo)})
            ON CONFLICT (id) DO UPDATE SET
              nombre = EXCLUDED.nombre,
              tipo = EXCLUDED.tipo,
              ubicacion = EXCLUDED.ubicacion,
              estado = EXCLUDED.estado,
              ultima_revision = EXCLUDED.ultima_revision,
              data = EXCLUDED.data;
          `;
          count++;
        }
        resultados['activos'] = count;
      }

      const createTableUsuarios = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'usuarios'`;
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
        for (const usuario of USUARIOS_MOCK) {
          await sql`
            INSERT INTO usuarios (id, nombre, correo, perfil, activo, data)
            VALUES (${usuario.id}, ${usuario.nombre}, ${usuario.correo}, ${usuario.perfil}, ${usuario.activo}, ${JSON.stringify(usuario)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['usuarios'] = count;
      }

      const createTableMante = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'mantenimientos'`;
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
            INSERT INTO mantenimientos (id, tag, tipo, fecha, estado, data)
            VALUES (${m.id}, ${m.tag}, ${m.tipo}, ${m.fecha}, ${m.estado}, ${JSON.stringify(m)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['mantenimientos'] = count;
      }

      const createTableTickets = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'tickets'`;
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
            INSERT INTO tickets (id, tag, titulo, estado, prioridad, data)
            VALUES (${t.id}, ${t.tag}, ${t.titulo}, ${t.estado}, ${t.prioridad}, ${JSON.stringify(t)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['tickets'] = count;
      }

      const createTableInformes = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'informes'`;
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
            INSERT INTO informes (id, tag, fecha, estado, data)
            VALUES (${t.id}, ${t.tag}, ${t.fecha}, ${t.estado}, ${JSON.stringify(t)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['informes'] = count;
      }

      const createTableEventos = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'eventos'`;
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
            INSERT INTO eventos (id, tipo, nivel, timestamp, data)
            VALUES (${t.id}, ${t.tipo}, ${t.nivel}, ${t.timestamp}, ${JSON.stringify(t)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['eventos'] = count;
      }

      const createTableClientes = await sql`SELECT count(*) FROM information_schema.tables WHERE table_name = 'clientes'`;
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
            INSERT INTO clientes (id, nombre, rut, plan, data)
            VALUES (${t.id}, ${t.nombre}, ${t.rut}, ${t.plan}, ${JSON.stringify(t)})
            ON CONFLICT (id) DO NOTHING;
          `;
          count++;
        }
        resultados['clientes'] = count;
      }

      return res.status(200).json({ success: true, message: "Importación finalizada.", resultados });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed." });
}
