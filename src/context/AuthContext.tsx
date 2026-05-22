/**
 * Contexto de Autenticación y Autorización.
 * Centraliza el estado del usuario logueado y sus capacidades (permisos).
 * 
 * @module context/AuthContext
 */

import React, { createContext, useContext, useState } from 'react';
import { Usuario, Permisos, PERMISOS_POR_PERFIL } from '../types';
import { USUARIOS_MOCK } from '../data/users';

/**
 * Definición del contrato del contexto de autenticación.
 */
import { db } from '../db/database'; // we might need this for db storage

interface AuthContextType {
  /** Datos del usuario actual. Null si no hay sesión. */
  user: Usuario | null;
  /** Matriz de permisos derivados del perfil del usuario. */
  permisos: Permisos | null;
  /** Función para autenticar mediante PIN y correo. */
  login: (pin: string, correo: string) => Promise<boolean>;
  /** Función para destruir la sesión actual. */
  logout: () => void;
}

// Below we redefine sha256 to be used
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
      const foundUser = USUARIOS_MOCK.find(u => (u as any).pin === savedPin && u.activo);
      if (foundUser) {
        return foundUser as Usuario;
      } else {
        // If the pin is stale (e.g. mock data changed), remove it so they can re-login
        // or we can fallback to the mock user 0 if is_authenticated is true.
        localStorage.removeItem('auth_pin');
      }
    }
    
    // Si estamos en entorno de desarrollo local, o si se saltó el login
    if (localStorage.getItem("is_authenticated") === "true") {
       return USUARIOS_MOCK[0] as Usuario; // Fallback
    }
    return null;
  });
  
  /** Derivación reactiva de permisos basada en el perfil del usuario */
  const permisos = user ? PERMISOS_POR_PERFIL[user.perfil] : null;

  /**
   * Intenta loguear un usuario buscando coincidencias de PIN en la base de datos (o mock).
   * @param pin Código de acceso del técnico/operario.
   */
  const login = async (pin: string, correo: string): Promise<boolean> => {
    // 1. Intentar login contra API real (email + PIN)
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, correo })
      });
      const json = await response.json();
      if (json.success && json.user) {
        setUser(json.user);
        // Guardar hash del PIN en IndexedDB para fallback offline
        const pinHash = await sha256(pin);
        await db.settings.put({ key: 'auth_pin_hash', value: pinHash, updated_at: Date.now(), sync_status: 'synced' });
        await db.settings.put({ key: 'auth_user', value: JSON.stringify(json.user), updated_at: Date.now(), sync_status: 'synced' });
        localStorage.setItem('is_authenticated', 'true');
        return true;
      }
    } catch (networkError) {
      console.warn('API no disponible, intentando login offline...');
      // Fallback: comparar pin con hash almacenado en IndexedDB
      const storedHashRecord = await db.settings.get('auth_pin_hash');
      const storedUserRecord = await db.settings.get('auth_user');
      if (storedHashRecord?.value && storedUserRecord?.value) {
        const inputHash = await sha256(pin);
        if (inputHash === storedHashRecord.value) {
          setUser(JSON.parse(storedUserRecord.value) as any);
          localStorage.setItem('is_authenticated', 'true');
          return true;
        }
      }
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
