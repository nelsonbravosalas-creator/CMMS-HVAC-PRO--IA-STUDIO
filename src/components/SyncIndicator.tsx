import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { db } from '../db/database';
import { motion, AnimatePresence } from 'motion/react';
import { useIsModalOpen } from '../hooks/useIsModalOpen';

export const SyncIndicator = () => {
  const isOnline = useAppStore(state => state.isOnline);
  const { isSyncing, setPendingCount, pendingCount, lastErrors, failedCount, clearErrors } = useSyncStore();
  const isModalOpen = useIsModalOpen();
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    const updateCount = async () => {
       const count = await db.sync_queue.count();
       setPendingCount(count);
    };

    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, [isOnline]);

  if (isModalOpen) return null;

  const hasErrors = failedCount > 0 || lastErrors.length > 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-auto">
      <AnimatePresence>
        {hasErrors && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white rounded-xl shadow-xl border border-red-100 max-w-xs w-72"
          >
            <button
              onClick={() => setShowErrors(v => !v)}
              className="w-full flex items-center gap-3 p-3 text-left"
            >
              <div className="p-2 rounded-lg bg-red-50 text-red-600 shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-700">
                  {failedCount} {failedCount === 1 ? 'registro sin sincronizar' : 'registros sin sincronizar'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {lastErrors[0] || 'Error de sincronización con la nube'}
                </p>
              </div>
              {showErrors ? <ChevronUp className="w-3 h-3 text-slate-400 shrink-0" /> : <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />}
            </button>

            <AnimatePresence>
              {showErrors && lastErrors.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-red-50"
                >
                  <div className="p-2 max-h-32 overflow-y-auto space-y-1">
                    {lastErrors.map((e, i) => (
                      <p key={i} className="text-[9px] text-red-600 font-mono leading-tight">{e}</p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2 px-3 pb-3">
              <button
                onClick={() => {
                  import('../sync/syncEngine').then(({ syncEngine }) => {
                    syncEngine.retryFailed();
                  });
                }}
                disabled={isSyncing || !isOnline}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reintentar fallidos
              </button>
              <button
                onClick={clearErrors}
                className="px-2 py-1.5 rounded-lg text-[10px] text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Descartar
              </button>
            </div>
          </motion.div>
        )}

        {pendingCount > 0 && !hasErrors && (
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
        onClick={() => {
          import('../sync/syncEngine').then(({ syncEngine }) => {
            syncEngine.triggerSync(true);
          });
        }}
        disabled={isSyncing || !isOnline}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border cursor-pointer hover:scale-105 transition-transform active:scale-95 ${
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
