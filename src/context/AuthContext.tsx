/**
 * Contexto de Autenticación y Autorización.
 * Centraliza el estado del usuario logueado y sus capacidades (permisos).
 *
 * @module context/AuthContext
 */

import React, { createContext, useContext, useState } from 'react';
import { Usuario, Permisos, PERMISOS_POR_PERFIL } from '../types';
import { apiFetch } from '../lib/apiFetch';

interface AuthContextType {
  user: Usuario | null;
  permisos: Permisos | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const permisos = user ? PERMISOS_POR_PERFIL[user.perfil] : null;

  const login = async (pin: string): Promise<boolean> => {
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
    } catch {
      console.warn('API no disponible para login.');
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
