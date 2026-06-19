import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

interface SyncItem {
  id: string;
  table: string;
  operation: string;
  status: SyncStatus;
  error?: string;
  timestamp: number;
}

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: number | null;
  pendingCount: number;
  syncHistory: SyncItem[];
  
  // Actions
  setOnline: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
  setLastSync: (time: number) => void;
  setPendingCount: (count: number) => void;
  addSyncResult: (item: SyncItem) => void;
  clearHistory: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      isOnline: navigator.onLine,
      isSyncing: false,
      lastSync: null,
      pendingCount: 0,
      syncHistory: [],

      setOnline: (status) => set({ isOnline: status }),
      setSyncing: (status) => set({ isSyncing: status }),
      setLastSync: (time) => set({ lastSync: time }),
      setPendingCount: (count) => set({ pendingCount: count }),
      addSyncResult: (item) => set((state) => ({ 
        syncHistory: [item, ...state.syncHistory].slice(0, 50) 
      })),
      clearHistory: () => set({ syncHistory: [] }),
    }),
    {
      name: 'cmms-sync-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ syncHistory: state.syncHistory, lastSync: state.lastSync }),
    }
  )
);
