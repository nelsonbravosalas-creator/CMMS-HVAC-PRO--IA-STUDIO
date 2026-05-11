/**
 * Contexto de Autenticación y Autorización.
 * Centraliza el estado del usuario logueado y sus capacidades (permisos).
 * 
 * @module context/AuthContext
 */

import React, { createContext, useContext, useState } from 'react';
import { Usuario, Permisos, PERMISOS_POR_PERFIL } from '../types';
import { USUARIOS_MOCK } from '../data/usuarios';

/**
 * Definición del contrato del contexto de autenticación.
 */
interface AuthContextType {
  /** Datos del usuario actual. Null si no hay sesión. */
  user: Usuario | null;
  /** Matriz de permisos derivados del perfil del usuario. */
  permisos: Permisos | null;
  /** Función para autenticar mediante PIN. */
  login: (pin: string) => boolean;
  /** Función para destruir la sesión actual. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Proveedor de Autenticación.
 * Envuelve la aplicación para inyectar los datos del usuario.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(USUARIOS_MOCK[0]); // Por defecto el primer mock para desarrollo
  
  /** Derivación reactiva de permisos basada en el perfil del usuario */
  const permisos = user ? PERMISOS_POR_PERFIL[user.perfil] : null;

  /**
   * Intenta loguear un usuario buscando coincidencias de PIN en la base de datos (o mock).
   * @param pin Código de acceso del técnico/operario.
   */
  const login = (pin: string) => {
    const found = USUARIOS_MOCK.find(u => u.pin === pin && u.activo);
    if (found) {
      setUser(found);
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

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
