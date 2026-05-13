import { getDb } from './_db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ success: false, error: 'PIN requerido' });

    const rows = await sql`SELECT id, nombre, correo, perfil, activo, pin FROM usuarios WHERE pin = ${pin} AND activo = true LIMIT 1`;
    
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'PIN inválido' });
    }

    const user = rows[0];
    const { pin: _, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: 'Servicio no disponible', offline: true });
  }
}
