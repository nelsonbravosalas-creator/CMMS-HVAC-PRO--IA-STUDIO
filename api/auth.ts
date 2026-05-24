import { getDb } from './_db.js';
import { signToken } from './_auth.js';
import bcrypt from 'bcryptjs';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    const { correo, pin } = req.body;
    if (!pin) return res.status(400).json({ success: false, error: 'PIN requerido' });

    let rows;
    if (correo) {
       rows = await sql`SELECT id, nombre, correo, data, perfil, activo, pin, data->>'rol' as json_rol, data->>'email' as json_email FROM users WHERE LOWER(correo) = ${correo.toLowerCase()} OR LOWER(data->>'email') = ${correo.toLowerCase()}`;
    } else {
       // Fallback by plain text pin for backward compatibility if correo is not provided
       rows = await sql`SELECT id, nombre, correo, data, perfil, activo, pin, data->>'rol' as json_rol FROM users WHERE pin = ${pin} AND activo = true LIMIT 1`;
    }
    
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const user = rows[0];
    if (!user.activo) {
       return res.status(401).json({ success: false, error: 'Usuario inactivo' });
    }

    const storedPin = user.pin || (user.data && user.data.pin);
    let isMatch = false;
    
    if (storedPin && storedPin.startsWith('$2')) {
       isMatch = bcrypt.compareSync(pin, storedPin);
    } else {
       isMatch = storedPin === pin;
    }

    if (!isMatch) {
       return res.status(401).json({ success: false, error: 'PIN inválido' });
    }

    const returnUser = {
      id: user.id || (user.data && user.data.id),
      nombre: user.nombre || (user.data && user.data.nombre),
      correo: user.correo || (user.data && user.data.email) || correo,
      perfil: user.perfil || user.json_rol || (user.data && user.data.rol) || 'tecnico',
      activo: true
    };
    
    const token = signToken({ id: returnUser.id, perfil: returnUser.perfil });

    return res.json({ success: true, user: returnUser, token });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: 'Servicio no disponible', offline: true });
  }
}
