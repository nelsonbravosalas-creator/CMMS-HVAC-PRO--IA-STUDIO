import React, { createContext, useContext, useState } from 'react';
import { Usuario, Permisos, PERMISOS_POR_PERFIL } from '../types';
import { USUARIOS_MOCK } from '../data/usuarios';

interface AuthContextType {
  user: Usuario | null;
  permisos: Permisos | null;
  login: (pin: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(USUARIOS_MOCK[0]); // Default to first mock user for dev
  const permisos = user ? PERMISOS_POR_PERFIL[user.perfil] : null;

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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
