/**
 * Contexto de Autenticación y Autorización.
 * Centraliza el estado del usuario logueado y sus capacidades (permisos).
 * 
 * @module context/AuthContext
 */

import React, { createContext, useContext, useState } from 'react';
import { Usuario, Permisos, PERMISOS_POR_PERFIL } from '../types';
import { db } from '../db/database';

/**
 * Definición del contrato del contexto de autenticación.
 */
interface AuthContextType {
  /** Datos del usuario actual. Null si no hay sesión. */
  user: Usuario | null;
  /** Matriz de permisos derivados del perfil del usuario. */
  permisos: Permisos | null;
  /** Función para autenticar mediante PIN. */
  login: (pin: string) => Promise<boolean>;
  /** Función para destruir la sesión actual. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Proveedor de Autenticación.
 * Envuelve la aplicación para inyectar los datos del usuario.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(() => {
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser && localStorage.getItem('is_authenticated') === 'true') {
      try {
        return JSON.parse(savedUser);
      } catch {
        localStorage.removeItem('auth_user');
      }
    }
    return null;
  });
  
  /** Derivación reactiva de permisos basada en el perfil del usuario */
  const permisos = user ? PERMISOS_POR_PERFIL[user.perfil] : null;

  /**
   * Intenta loguear un usuario buscando coincidencias de PIN en la base de datos (o mock).
   * @param pin Código de acceso del técnico/operario.
   */
  const login = async (pin: string): Promise<boolean> => {
    // 1. Intentar login contra API real
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const json = await response.json();
      if (json.success && json.user) {
        setUser(json.user);
        localStorage.setItem('auth_pin', pin);
        localStorage.setItem('auth_user', JSON.stringify(json.user));
        localStorage.setItem('is_authenticated', 'true');
        return true;
      }
    } catch (networkError) {
      console.warn('API no disponible, intentando login offline...');
    }

    // 2. Fallback offline: buscar usuarios ya sincronizados en IndexedDB.
    const found = await db.users.where('pin').equals(pin).first();
    if (found && found.activo) {
      const offlineUser = {
        id: found.id,
        nombre: found.nombre,
        correo: found.email,
        perfil: found.rol as any,
        activo: found.activo,
        puedeEditarMantenimientos: true,
        pin: found.pin
      };
      setUser(offlineUser);
      localStorage.setItem('auth_pin', pin);
      localStorage.setItem('auth_user', JSON.stringify(offlineUser));
      localStorage.setItem('is_authenticated', 'true');
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_pin');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('active_client');
  };

  return (
    <AuthContext.Provider value={{ user, permisos, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook personalizado para acceder a los datos de autenticación desde cualquier componente.
 * @throws Error si se usa fuera de un AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
