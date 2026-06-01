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

    const { amount, reason } = body;
    if (amount === undefined) {
      return res.status(400).json({ error: 'Falta cantidad a ajustar (amount)' });
    }

    const sql = getDb();
    const now = Date.now();

    // Actualiza la cantidad de stock
    await sql`
      UPDATE inventory 
      SET cantidad = ${Number(amount)}, 
          updated_at = ${now},
          data = jsonb_set(coalesce(data, '{}'::jsonb), '{stock}', ${String(amount)}::jsonb)
      WHERE id = ${id} OR uuid_sync = ${id}
    `;

    return res.json({ success: true, message: 'Stock del repuesto ajustado con éxito.' });
  } catch (error: any) {
    console.error('Error en adjust maintenance:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
