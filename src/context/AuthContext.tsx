/**
 * Contexto de Autenticación y Autorización.
 * Centraliza el estado del usuario logueado y sus capacidades (permisos).
 * 
 * @module context/AuthContext
 */

import React, { createContext, useContext, useState } from 'react';
import { Usuario, Permisos, PERMISOS_POR_PERFIL } from '../types';
import { apiFetch } from '../lib/apiFetch';

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
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const json = await response.json();
      if (json.success && json.user) {
        setUser(json.user);
        if (json.token) {
          sessionStorage.setItem('auth_token', json.token);
          localStorage.removeItem('auth_token');
        }
        localStorage.setItem('auth_user', JSON.stringify(json.user));
        localStorage.setItem('is_authenticated', 'true');
        window.dispatchEvent(new Event('auth-token-updated'));
        return true;
      }

      if (response.status < 500 && !json.offline) return false;
    } catch (networkError) {
      console.warn('API no disponible, intentando login offline...');
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('active_client');
    localStorage.removeItem('pending_tag');
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
