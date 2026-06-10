import { useEffect } from 'react';
import { syncEngine } from '../services/syncEngine';
import { useSyncStore } from '../store/useSyncStore';

export const useSync = () => {
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const isOnline = useSyncStore((state) => state.isOnline);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const lastSync = useSyncStore((state) => state.lastSync);

  useEffect(() => {
    // Auto-sync on hooks mounts
    syncEngine.triggerSync();
  }, []);

  const syncData = async (force: boolean = true) => {
    await syncEngine.triggerSync(force);
  };

  return {
    syncing: isSyncing,
    isSyncing,
    isOnline,
    pendingCount,
    lastSync,
    syncData
  };
};

export default useSync;
