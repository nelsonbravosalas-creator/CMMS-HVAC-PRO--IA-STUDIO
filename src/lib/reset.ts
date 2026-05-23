import { db } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSyncStore } from '../store/useSyncStore';
import { logger } from './logger';

export const resetApplicationData = async () => {
  logger.warn('System', 'Iniciando reset completo de datos de la aplicación...');
  
  try {
    // 1. Limpiar IndexedDB
    await db.delete();
    await db.open();
    logger.info('System', 'IndexedDB reseteado');

    // 2. Limpiar Zustand Stores
    useAppStore.getState().hydrate(); // This will clear if DB is empty
    useSyncStore.getState().setPendingCount(0);
    
    // 3. Limpiar LocalStorage
    localStorage.clear();
    logger.info('System', 'LocalStorage limpiado');

    // 4. Recargar
    window.location.href = '/login';
  } catch (error) {
    logger.error('System', 'Error durante el reset de datos', error);
  }
};
