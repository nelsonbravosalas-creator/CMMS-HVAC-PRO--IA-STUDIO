import { getDb } from '../_db.js';

export default async function handler(req: any, res: any) {
  try {
    const { method, query, body } = req;
    const id = query.id;

    if (method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Falta identificador (id)' });
    }

    const sql = getDb();
    const now = Date.now();

    // Actualiza el estado a completado / cerrado
    await sql`
      UPDATE work_orders 
      SET estado = 'cerrado', 
          fecha_cierre = ${new Date().toISOString()},
          updated_at = ${now},
          data = jsonb_set(coalesce(data, '{}'::jsonb), '{estado}', '"cerrado"')
      WHERE id = ${id} OR uuid_sync = ${id}
    `;

    return res.json({ success: true, message: 'Orden de trabajo completada y guardada con éxito.' });
  } catch (error: any) {
    console.error('Error en complete order:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
