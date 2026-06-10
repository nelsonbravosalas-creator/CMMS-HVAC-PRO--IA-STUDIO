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
  lastErrors: string[];
  failedCount: number;

  // Actions
  setOnline: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
  setLastSync: (time: number) => void;
  setPendingCount: (count: number) => void;
  addSyncResult: (item: SyncItem) => void;
  clearHistory: () => void;
  addError: (msg: string) => void;
  clearErrors: () => void;
  setFailedCount: (count: number) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      isOnline: navigator.onLine,
      isSyncing: false,
      lastSync: null,
      pendingCount: 0,
      syncHistory: [],
      lastErrors: [],
      failedCount: 0,

      setOnline: (status) => set({ isOnline: status }),
      setSyncing: (status) => set({ isSyncing: status }),
      setLastSync: (time) => set({ lastSync: time }),
      setPendingCount: (count) => set({ pendingCount: count }),
      addSyncResult: (item) => set((state) => ({
        syncHistory: [item, ...state.syncHistory].slice(0, 50)
      })),
      clearHistory: () => set({ syncHistory: [] }),
      addError: (msg) => set((state) => ({
        lastErrors: [msg, ...state.lastErrors].slice(0, 10)
      })),
      clearErrors: () => set({ lastErrors: [] }),
      setFailedCount: (count) => set({ failedCount: count }),
    }),
    {
      name: 'cmms-sync-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ syncHistory: state.syncHistory, lastSync: state.lastSync }),
    }
  )
);
