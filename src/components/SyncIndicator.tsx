import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { db } from '../db/database';
import { syncEngine } from '../sync/syncEngine';
import { motion, AnimatePresence } from 'motion/react';

export const SyncIndicator = () => {
  const isOnline = useAppStore(state => state.isOnline);
  const { isSyncing, setPendingCount, pendingCount } = useSyncStore();

  useEffect(() => {
    const updateCount = async () => {
       const count = await db.sync_queue.count();
       setPendingCount(count);
    };

    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, [isOnline]);

  return (
    <div className="fixed bottom-4 right-4 z-40 hidden flex-col items-end gap-2 pointer-events-auto lg:flex">
      <AnimatePresence>
        {pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white p-3 rounded-xl shadow-xl border border-slate-100 flex items-center gap-3"
          >
            <div className={`p-2 rounded-lg ${isOnline ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
              {isOnline ? (
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              ) : (
                <CloudOff className="w-4 h-4" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">
                {isOnline ? (isSyncing ? 'Sincronizando...' : 'Pendiente') : 'Modo Offline'}
              </p>
              <p className="text-[10px] text-slate-500">
                {pendingCount} {pendingCount === 1 ? 'cambio pendiente' : 'cambios pendientes'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        type="button"
        aria-label="Forzar sincronización"
        onClick={() => {
          syncEngine.triggerSync(true);
        }}
        disabled={isSyncing || !isOnline}
        className={`flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-wider shadow-sm transition-transform hover:scale-105 active:scale-95 ${
          isOnline 
            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' 
            : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? (isSyncing ? 'bg-emerald-500 animate-spin' : 'bg-emerald-500 animate-pulse') : 'bg-slate-400'}`} />
        {isOnline ? (isSyncing ? 'Sincronizando...' : 'Forzar Sincronización') : 'Offline'}
      </button>
    </div>
  );
};
