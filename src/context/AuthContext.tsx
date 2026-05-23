import React, { createContext, useContext, useEffect, useState } from 'react';
import { Usuario, Permisos, PERMISOS_POR_PERFIL } from '../types';
import { USUARIOS_MOCK } from '../data/usuarios';

interface AuthContextType {
  user: Usuario | null;
  permisos: Permisos | null;
  login: (email: string, pin: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const permisos = user ? PERMISOS_POR_PERFIL[user.perfil] : null;

  useEffect(() => {
    const storedUserId = localStorage.getItem("auth_user_id");
    if (storedUserId) {
      const storedUser = USUARIOS_MOCK.find(u => u.id === storedUserId && u.activo) || null;
      setUser(storedUser);
    }
  }, []);

  const login = (email: string, pin: string) => {
    const found = USUARIOS_MOCK.find(u => u.correo.toLowerCase() === email.toLowerCase() && u.pin === pin && u.activo);
    if (found) {
      localStorage.setItem("is_authenticated", "true");
      localStorage.setItem("auth_user_id", found.id);
      setUser(found);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem("is_authenticated");
    localStorage.removeItem("auth_user_id");
    setUser(null);
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
