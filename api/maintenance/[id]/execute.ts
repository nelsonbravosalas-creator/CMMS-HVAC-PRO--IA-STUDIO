import { getDb } from '../../_db.js';

export default async function handler(req: any, res: any) {
  try {
    const { method, query } = req;
    const id = query.id;

    if (method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Falta identificador (id)' });
    }

    const sql = getDb();
    const now = Date.now();

    await sql`
      UPDATE preventive_maintenance 
      SET updated_at = ${now},
          data = jsonb_set(coalesce(data, '{}'::jsonb), '{estado}', '"ejecutado"')
      WHERE id = ${id} OR uuid_sync = ${id}
    `;

    return res.json({ success: true, message: 'Mantenimiento ejecutado con éxito.' });
  } catch (error: any) {
    console.error('Error en execute maintenance:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
