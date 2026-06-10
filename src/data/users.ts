import { db } from '../db/database';
import bcrypt from 'bcryptjs';

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  perfil: 'visita' | 'tecnico' | 'supervisor' | 'administrador' | 'programador' | 'cliente' | 'contratista';
  activo: boolean;
  puedeEditarMantenimientos: boolean;
  pin: string;
}

export const validatePin = async (pinIngresado: string, correo?: string) => {
  if (navigator.onLine) {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinIngresado, correo })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error("Credenciales inválidas");
    }
    return data;
  } else {
    // Fallback offline seguro contra DB Local
    if (correo) {
      const user = await db.users.where('email').equalsIgnoreCase(correo).first();
      if (!user || !user.activo) {
        throw new Error("Credenciales inválidas");
      }
      const isMatch = user.pin.startsWith('$2')
        ? bcrypt.compareSync(pinIngresado, user.pin)
        : user.pin === pinIngresado;
      if (!isMatch) {
        throw new Error("Credenciales inválidas");
      }
      return user;
    } else {
      const allUsers = await db.users.toArray();
      const user = allUsers.find(u => {
        if (!u.activo) return false;
        return u.pin.startsWith('$2')
          ? bcrypt.compareSync(pinIngresado, u.pin)
          : u.pin === pinIngresado;
      });
      if (!user) {
        throw new Error("Credenciales inválidas");
      }
      return user;
    }
  }
};

export interface Cliente {
  id: string;
  nombre: string;
  rut: string;
  plan: 'basico' | 'premium' | 'enterprise';
  activo: boolean;
  usuariosIds: string[];
}

export const CLIENTES_MOCK: Cliente[] = [
  {
    id: 'C1',
    nombre: 'EECOL ELECTRIC',
    rut: '78.928.030-4',
    plan: 'enterprise',
    activo: true,
    usuariosIds: ['U1', 'U2']
  }
];

