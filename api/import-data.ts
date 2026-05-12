import { neon } from '@neondatabase/serverless';
import { EQUIPOS_DATA } from '../src/data/equipos';

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, error: "Missing DATABASE_URL" });
  }

  if (req.method === 'POST') {
    try {
      const sql = neon(process.env.DATABASE_URL);
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
          INSERT INTO activos (id, tag_tecnico, nombre, tipo, ubicacion, estado, ultima_revision)
          VALUES (${id}, ${tag_tecnico}, ${nombre}, ${tipo}, ${ubicacion}, ${estado}, ${ultima_revision})
          ON CONFLICT (id) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            tipo = EXCLUDED.tipo,
            ubicacion = EXCLUDED.ubicacion,
            estado = EXCLUDED.estado,
            ultima_revision = EXCLUDED.ultima_revision;
        `;
        count++;
      }
      
      return res.status(200).json({ success: true, message: `Se importaron ${count} equipos a Neon correctamente.` });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed. Usa POST." });
}
