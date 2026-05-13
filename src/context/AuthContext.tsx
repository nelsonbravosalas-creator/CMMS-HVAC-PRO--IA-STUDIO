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
    // Intentar recuperar sesión persistida
    const savedPin = localStorage.getItem('auth_pin');
    
    if (savedPin) {
      const foundUser = USUARIOS_MOCK.find(u => u.pin === savedPin && u.activo);
      if (foundUser) {
        return foundUser;
      } else {
        // If the pin is stale (e.g. mock data changed), remove it so they can re-login
        // or we can fallback to the mock user 0 if is_authenticated is true.
        localStorage.removeItem('auth_pin');
      }
    }
    
    // Si estamos en entorno de desarrollo local, o si se saltó el login
    if (localStorage.getItem("is_authenticated") === "true") {
       return USUARIOS_MOCK[0]; // Fallback
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

    // 2. Fallback offline: buscar en USUARIOS_MOCK
    const found = USUARIOS_MOCK.find(u => u.pin === pin && u.activo);
    if (found) {
      setUser(found as any);
      localStorage.setItem('auth_pin', pin);
      localStorage.setItem('auth_user', JSON.stringify(found));
      localStorage.setItem('is_authenticated', 'true');
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_pin');
    localStorage.removeItem('is_authenticated');
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
