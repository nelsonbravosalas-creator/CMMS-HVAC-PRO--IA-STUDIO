import { neon } from '@neondatabase/serverless';
import { requireRole } from './_auth.js';

export default async function handler(req, res) {
  const user = requireRole(['administrador', 'programador'])(req, res);
  if (!user) return;

  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ success: false, error: "Missing DATABASE_URL" });
  }
  if (!dbUrl.startsWith('postgres')) {
    return res.status(500).json({ success: false, error: "Invalid DATABASE_URL format" });
  }

  if (req.method === 'POST' || req.method === 'GET') {
    try {
      const sql = neon(dbUrl);
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
      return res.status(200).json({ success: true, message: "Base de datos inicializada correctamente en Neon" });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
