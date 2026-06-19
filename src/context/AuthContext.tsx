/**
 * Contexto de Autenticación y Autorización.
 * Centraliza el estado del usuario logueado y sus capacidades (permisos).
 * 
 * @module context/AuthContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
 * Normaliza cualquier perfil / rol String (con mayúsculas, acentos u otros)
 * para asegurar que sea una llave válida de PERMISOS_POR_PERFIL.
 */
export function normalizePerfil(rol: string | undefined | null): Perfil {
  if (!rol) return 'visita';
  const r = rol.toLowerCase().trim();
  if (r.includes('admin')) return 'administrador';
  if (r.includes('tecn') || r.includes('técn')) return 'tecnico';
  if (r.includes('superv')) return 'supervisor';
  if (r.includes('visita')) return 'visita';
  if (r.includes('client')) return 'cliente';
  if (r.includes('contrat')) return 'contratista';
  if (r.includes('program')) return 'programador';
  return 'visita';
}

/**
 * Proveedor de Autenticación.
 * Envuelve la aplicación para inyectar los datos del usuario.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(() => {
    // Intentar recuperar sesión persistida desde localStorage de forma segura
    let savedUserJson = localStorage.getItem('auth_user');
    
    if (localStorage.getItem('is_authenticated') === 'true' && !savedUserJson) {
      localStorage.removeItem('is_authenticated');
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
    }
    localStorage.removeItem('auth_token');

    if (savedUserJson && !sessionStorage.getItem('auth_token')) {
      localStorage.removeItem('auth_user');
      localStorage.removeItem('is_authenticated');
      return null;
    }

    if (savedUserJson) {
      try {
        const u = JSON.parse(savedUserJson) as Usuario;
        if (u) {
          u.perfil = normalizePerfil(u.perfil);
          u.puedeEditarMantenimientos = u.perfil !== 'visita' && u.perfil !== 'cliente';
        }
        return u;
      } catch (e) {
        localStorage.removeItem('auth_user');
      }
    }
    return null;
  });
  
  /** Derivación reactiva de permisos basada en el perfil del usuario con fallback a administrador en caso de desajuste */
  const permisos = user ? (PERMISOS_POR_PERFIL[user.perfil] || PERMISOS_POR_PERFIL.administrador) : null;

  /**
   * Intenta loguear un usuario buscando coincidencias de PIN en la base de datos (o localmente offline).
   */
  const login = async (pin: string, correo: string): Promise<boolean> => {
    const normalizedCorreo = correo.trim().toLowerCase();
    const normalizedPin = pin.trim();

    // 1. Intentar login contra API real (email + PIN)
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: normalizedPin, correo: normalizedCorreo, email: normalizedCorreo })
      });
      const json = await response.json();
      if (json.success && json.user) {
        const normalizedPerfil = normalizePerfil(json.user.perfil || json.user.rol);
        const loggedUser: Usuario = {
          id: json.user.id,
          nombre: json.user.nombre,
          correo: json.user.correo || normalizedCorreo,
          perfil: normalizedPerfil,
          activo: json.user.activo,
          puedeEditarMantenimientos: normalizedPerfil !== 'visita' && normalizedPerfil !== 'cliente',
          pin: '***' // No guardamos el PIN real en el objeto del estado por seguridad
        };

        setUser(loggedUser);
        
        // Guardar para persistencia síncrona en recarga de página
        localStorage.setItem('auth_user', JSON.stringify(loggedUser));
        localStorage.setItem('is_authenticated', 'true');
        if (json.token) {
          sessionStorage.setItem('auth_token', json.token);
          localStorage.removeItem('auth_token');
        }

        // Guardar hash del PIN en la tabla 'users' de IndexedDB para fallback offline
        const pinHash = bcrypt.hashSync(normalizedPin, 10);
        const existingLocalUser = await db.users.where('email').equalsIgnoreCase(normalizedCorreo).first();
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
            email: normalizedCorreo,
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

    // Fallback offline-first: solo valida credenciales locales, no abre sesión sin token emitido por el servidor.
    try {
      const localUser = await db.users.where('email').equalsIgnoreCase(normalizedCorreo).first();
      if (localUser && localUser.activo) {
        // Validar el PIN contra el bcrypt hash almacenado
        const isMatch = localUser.pin.startsWith('$2')
          ? bcrypt.compareSync(normalizedPin, localUser.pin)
          : localUser.pin === normalizedPin;

        if (isMatch) return false;
      }
    } catch (dbError) {
      console.error('Error durante autenticación offline contra IndexedDB', dbError);
    }

    return false;
  };

  const biometricLogin = async (correo: string): Promise<boolean> => {
    try {
      if (!sessionStorage.getItem('auth_token')) {
        return false;
      }
      const localUser = await db.users.where('email').equalsIgnoreCase(correo).first();
      if (localUser && localUser.activo) {
        const normalizedPerfil = normalizePerfil(localUser.rol);
        const loggedUser: Usuario = {
          id: localUser.id || localUser.uuid_sync,
          nombre: localUser.nombre,
          correo: localUser.email,
          perfil: normalizedPerfil,
          activo: localUser.activo,
          puedeEditarMantenimientos: normalizedPerfil !== 'visita' && normalizedPerfil !== 'cliente',
          pin: '***'
        };

        setUser(loggedUser);
        localStorage.setItem('auth_user', JSON.stringify(loggedUser));
        localStorage.setItem('is_authenticated', 'true');
        return true;
      }
    } catch (dbError) {
      console.error('Error durante autenticación biométrica offline', dbError);
    }
    return false;
  };

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('active_client');
  }, []);

  // BR-AUTH-004: Inactivity Timeout (30 minutes)
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      // 30 minutes in milliseconds = 30 * 60 * 1000 = 1800000
      inactivityTimer = setTimeout(() => {
        if (user) {
          console.log("30 minutes of inactivity detected. Automatically logging out to prevent processing costs.");
          logout();
        }
      }, 1800000);
    };

    if (user) {
      resetTimer();
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      
      events.forEach(event => document.addEventListener(event, resetTimer, { passive: true }));

      return () => {
        clearTimeout(inactivityTimer);
        events.forEach(event => document.removeEventListener(event, resetTimer));
      };
    }
  }, [user, logout]);

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
