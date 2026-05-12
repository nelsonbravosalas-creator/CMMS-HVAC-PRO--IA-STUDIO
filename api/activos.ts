import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, error: "Missing DATABASE_URL" });
  }
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM activos ORDER BY tag_tecnico ASC LIMIT 100`;
      return res.status(200).json({ success: true, data: rows });
    } catch (error) {
      console.error("GET Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { id, tag_tecnico, nombre, tipo, ubicacion, estado } = req.body;
      const ultima_revision = new Date();

      await sql`
        INSERT INTO activos (id, tag_tecnico, nombre, tipo, ubicacion, estado, ultima_revision)
        VALUES (${id}, ${tag_tecnico}, ${nombre}, ${tipo}, ${ubicacion}, ${estado}, ${ultima_revision})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          tipo = EXCLUDED.tipo,
          ubicacion = EXCLUDED.ubicacion,
          estado = EXCLUDED.estado,
          ultima_revision = EXCLUDED.ultima_revision;
      `;
      return res.status(200).json({ success: true, data: { id, status: "sincronizado" } });
    } catch (error) {
      console.error("POST Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
