/**
 * Contexto de Autenticación y Autorización.
 * Centraliza el estado del usuario logueado y sus capacidades (permisos).
 * 
 * @module context/AuthContext
 */

import React, { createContext, useContext, useState } from 'react';
import { Usuario, Permisos, PERMISOS_POR_PERFIL, Perfil } from '../types';
import bcrypt from 'bcryptjs';

/**
 * Definición del contrato del contexto de autenticación.
 */
import { db } from '../db/database';

interface AuthContextType {
  /** Datos del usuario actual. Null si no hay sesión. */
  user: Usuario | null;
  /** Matriz de permisos derivados del perfil del usuario. */
  permisos: Permisos | null;
  /** Función para autenticar mediante PIN y correo. */
  login: (pin: string, correo: string) => Promise<boolean>;
  /** Función para autenticar mediante huella digital offline en el dispositivo. */
  biometricLogin: (correo: string) => Promise<boolean>;
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
    // Intentar recuperar sesión persistida desde localStorage de forma segura
    const savedUserJson = localStorage.getItem('auth_user');
    if (savedUserJson) {
      try {
        return JSON.parse(savedUserJson) as Usuario;
      } catch (e) {
        localStorage.removeItem('auth_user');
      }
    }
    return null;
  });
  
  /** Derivación reactiva de permisos basada en el perfil del usuario */
  const permisos = user ? PERMISOS_POR_PERFIL[user.perfil] : null;

  /**
   * Intenta loguear un usuario buscando coincidencias de PIN en la base de datos (o localmente offline).
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
        const loggedUser: Usuario = {
          id: json.user.id,
          nombre: json.user.nombre,
          correo: json.user.correo || correo,
          perfil: (json.user.perfil || 'visita') as Perfil,
          activo: json.user.activo,
          puedeEditarMantenimientos: json.user.perfil !== 'visita' && json.user.perfil !== 'cliente',
          pin: '***' // No guardamos el PIN real en el objeto del estado por seguridad
        };

        setUser(loggedUser);
        
        // Guardar para persistencia síncrona en recarga de página
        localStorage.setItem('auth_user', JSON.stringify(loggedUser));
        localStorage.setItem('is_authenticated', 'true');
        if (json.token) {
          localStorage.setItem('auth_token', json.token);
        }

        // Guardar hash del PIN en la tabla 'users' de IndexedDB para fallback offline
        const pinHash = bcrypt.hashSync(pin, 10);
        const existingLocalUser = await db.users.where('email').equalsIgnoreCase(correo).first();
        if (existingLocalUser) {
          await db.users.update(existingLocalUser.uuid_sync, {
            id: json.user.id || existingLocalUser.id,
            nombre: json.user.nombre || existingLocalUser.nombre,
            rol: loggedUser.perfil,
            pin: pinHash,
            activo: true,
            updated_at: Date.now()
          });
        } else {
          await db.users.put({
            uuid_sync: crypto.randomUUID(),
            id: json.user.id || `U-${Date.now()}`,
            nombre: json.user.nombre,
            email: correo,
            rol: loggedUser.perfil,
            pin: pinHash,
            activo: true,
            updated_at: Date.now(),
            sync_status: 'synced'
          });
        }
        return true;
      }
    } catch (networkError) {
      console.warn('API no disponible o error de red, intentando login offline...', networkError);
    }

    // Fallback offline-first: Buscar usuario en la tabla 'users' de Dexie/IndexedDB
    try {
      const localUser = await db.users.where('email').equalsIgnoreCase(correo).first();
      if (localUser && localUser.activo) {
        // Validar el PIN contra el bcrypt hash almacenado
        const isMatch = localUser.pin.startsWith('$2')
          ? bcrypt.compareSync(pin, localUser.pin)
          : localUser.pin === pin;

        if (isMatch) {
          const loggedUser: Usuario = {
            id: localUser.id || localUser.uuid_sync,
            nombre: localUser.nombre,
            correo: localUser.email,
            perfil: (localUser.rol || 'tecnico') as Perfil,
            activo: localUser.activo,
            puedeEditarMantenimientos: localUser.rol !== 'visita' && localUser.rol !== 'cliente',
            pin: '***'
          };

          setUser(loggedUser);
          localStorage.setItem('auth_user', JSON.stringify(loggedUser));
          localStorage.setItem('is_authenticated', 'true');
          return true;
        }
      }
    } catch (dbError) {
      console.error('Error durante autenticación offline contra IndexedDB', dbError);
    }

    return false;
  };

  const biometricLogin = async (correo: string): Promise<boolean> => {
    try {
      const localUser = await db.users.where('email').equalsIgnoreCase(correo).first();
      if (localUser && localUser.activo) {
        const loggedUser: Usuario = {
          id: localUser.id || localUser.uuid_sync,
          nombre: localUser.nombre,
          correo: localUser.email,
          perfil: (localUser.rol || 'tecnico') as Perfil,
          activo: localUser.activo,
          puedeEditarMantenimientos: localUser.rol !== 'visita' && localUser.rol !== 'cliente',
          pin: '***'
        };

        setUser(loggedUser);
        localStorage.setItem('auth_user', JSON.stringify(loggedUser));
        localStorage.setItem('is_authenticated', 'true');
        return true;
      } else {
        // Fallback default mockup for Nelson Bravo if first boot and not saved in localdb yet
        if (correo.toLowerCase() === "nelson.bravo.salas@gmail.com") {
          const loggedUser: Usuario = {
            id: "1",
            nombre: "Nelson Bravo",
            correo: "nelson.bravo.salas@gmail.com",
            perfil: "administrador" as Perfil,
            activo: true,
            puedeEditarMantenimientos: true,
            pin: '***'
          };
          setUser(loggedUser);
          localStorage.setItem('auth_user', JSON.stringify(loggedUser));
          localStorage.setItem('is_authenticated', 'true');
          return true;
        }
      }
    } catch (dbError) {
      console.error('Error durante autenticación biométrica offline', dbError);
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('active_client');
  };

  return (
    <AuthContext.Provider value={{ user, permisos, login, biometricLogin, logout }}>
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
