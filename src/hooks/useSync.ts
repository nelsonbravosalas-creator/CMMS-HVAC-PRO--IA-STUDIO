import { useEffect } from 'react';
import { syncEngine } from '../sync/syncEngine';

export const useSync = () => {
  useEffect(() => {
    // syncEngine.init() usually handles the listeners
  }, []);

  return { syncData: () => syncEngine.triggerSync() };
};
