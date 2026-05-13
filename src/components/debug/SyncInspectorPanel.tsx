import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Database, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search
} from 'lucide-react';
import { useSyncStore } from '../../store/useSyncStore';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../db/database';
import { motion, AnimatePresence } from 'motion/react';

export const SyncInspectorPanel = () => {
  const { isOnline, isSyncing, pendingCount, syncHistory, clearHistory } = useSyncStore();
  const [isOpen, setIsOpen] = useState(false);
  const [queue, setQueue] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');

  const fetchQueue = async () => {
    const items = await db.sync_queue.limit(50).toArray();
    setQueue(items);
  };

  useEffect(() => {
    if (isOpen) {
      fetchQueue();
      const interval = setInterval(fetchQueue, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-[450px] h-[600px] bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl overflow-hidden flex flex-col mb-4"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${isOnline ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                  {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                </div>
                <div>
                   <h3 className="text-xs font-black text-white uppercase tracking-widest">Sync Inspector</h3>
                   <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase">
                      <span>{isOnline ? 'Online' : 'Offline'}</span>
                      <span>•</span>
                      <span>{pendingCount} Pendientes</span>
                   </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation */}
            <div className="flex border-b border-slate-700 bg-slate-800/50">
              <button 
                onClick={() => setActiveTab('queue')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'queue' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-slate-500'
                }`}
              >
                Sync Queue ({pendingCount})
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'history' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-slate-500'
                }`}
              >
                History
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
              {activeTab === 'queue' ? (
                <div className="space-y-2">
                  {queue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20">
                      <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Cola vacía</p>
                    </div>
                  ) : (
                    queue.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-800 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                              item.operation === 'insert' ? 'bg-emerald-500/20 text-emerald-400' :
                              item.operation === 'update' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {item.operation}
                            </span>
                            <span className="text-[10px] font-black text-white uppercase">{item.table}</span>
                          </div>
                          <span className="text-[8px] font-bold text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 truncate">
                          UUID: {item.uuid_sincro}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-4 px-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Últimas 50 transacciones</span>
                    <button 
                      onClick={clearHistory}
                      className="text-[10px] font-black text-red-400 uppercase hover:text-red-300 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  </div>
                  {syncHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20">
                      <Clock className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Sin historial</p>
                    </div>
                  ) : (
                    syncHistory.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700/30">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg ${item.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                              {item.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-black text-white uppercase">{item.table}</span>
                                 <span className="text-[8px] font-bold text-slate-500">{item.operation}</span>
                               </div>
                               {item.error && <p className="text-[8px] font-medium text-red-400 mt-0.5">{item.error}</p>}
                            </div>
                          </div>
                          <span className="text-[8px] font-bold text-slate-600">{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-800 border-t border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Database className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400">DEXIE OK</span>
                </div>
                {isSyncing && (
                  <div className="flex items-center gap-2 text-blue-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando...</span>
                  </div>
                )}
              </div>
              <Activity className="w-4 h-4 text-slate-700" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${
          isSyncing ? 'bg-blue-600 animate-pulse' : 
          pendingCount > 0 ? 'bg-amber-500' : 'bg-slate-800'
        } text-white`}
      >
        {isSyncing ? <RefreshCw className="w-6 h-6 animate-spin" /> : 
         pendingCount > 0 ? <AlertTriangle className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
        {pendingCount > 0 && !isSyncing && (
           <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 rounded-full border-4 border-slate-50 flex items-center justify-center text-[10px] font-black">
             {pendingCount}
           </span>
        )}
      </button>
    </div>
  );
};
