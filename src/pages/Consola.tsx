import React, { useState, useEffect, useRef } from "react";
import { 
  Terminal, 
  RotateCcw, 
  Download, 
  Trash2, 
  Search, 
  Filter, 
  Database, 
  Cpu, 
  ShieldAlert, 
  FileText,
  ChevronRight,
  Clock
} from "lucide-react";
import { logger } from "../lib/logger";
import { useSyncStore } from "../store/useSyncStore";
import { db } from "../db/database";

export default function Consola() {
  const [logs, setLogs] = useState(logger.getLogs());
  const [filter, setFilter] = useState("");
  const { pendingCount, isSyncing } = useSyncStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs([...logger.getLogs()]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const filtered = logs.filter(e => 
    e.message.toLowerCase().includes(filter.toLowerCase()) ||
    e.context.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 text-left h-full pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Consola de Eventos</h2>
          <p className="text-slate-500 text-sm font-medium">Auditoría en tiempo real de operaciones del sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all">
            <RotateCcw className="w-4 h-4" /> Actualizar
          </button>
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all">
            <Download className="w-4 h-4" /> Exportar JSON
          </button>
          <button className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-red-100 transition-all">
            <Trash2 className="w-4 h-4" /> Limpiar
          </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[40px] border-8 border-slate-800 shadow-2xl flex flex-col flex-1 min-h-[600px] overflow-hidden">
         {/* Console Header / Filter */}
         <div className="p-6 bg-slate-800/50 flex flex-col md:flex-row gap-4 border-b border-slate-700/50">
            <div className="flex-1 relative">
               <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
               <input 
                 type="text" 
                 placeholder="Buscar eventos..." 
                 className="w-full pl-12 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-2xl text-xs font-bold text-blue-400 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all uppercase"
                 value={filter}
                 onChange={(e) => setFilter(e.target.value)}
               />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
               <TypeChip label="Operación" color="text-blue-400" />
               <TypeChip label="Sistema" color="text-purple-400" />
               <TypeChip label="Alertas" color="text-red-400" />
               <TypeChip label="Doc" color="text-emerald-400" />
            </div>
         </div>

         {/* Log Viewport */}
         <div 
           ref={scrollRef}
           className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed relative custom-scrollbar-terminal"
         >
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
               <Terminal className="w-32 h-32 text-white" />
            </div>
            
            <div className="space-y-1">
               {filtered.map((e, i) => (
                 <div key={i} className="flex gap-4 p-2 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-all group">
                    <span className="text-slate-500 shrink-0 select-none">[{new Date(e.timestamp).toLocaleTimeString()}]</span>
                    <span className={`uppercase font-black shrink-0 w-24 ${
                      e.level === 'error' ? 'text-red-500' : e.level === 'warn' ? 'text-amber-500' : 'text-blue-500'
                    }`}>
                      {e.level}
                    </span>
                    <span className="text-emerald-500 shrink-0 w-24">[{e.context}]</span>
                    <span className="text-slate-300 flex-1">{e.message}</span>
                 </div>
               ))}
               
               {/* Terminal Cursor Animation */}
               <div className="flex items-center gap-2 p-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500" />
                  <div className="w-2 h-4 bg-emerald-500 animate-pulse"></div>
               </div>
            </div>
         </div>

         {/* Console Footer */}
         <div className="p-4 bg-slate-800/30 border-t border-slate-700/50 flex justify-between items-center px-8">
            <div className="flex items-center gap-6">
               <FooterStat icon={<Database className="w-3.5 h-3.5" />} label="Pendiente" value={`${pendingCount} items`} />
               <FooterStat icon={<Cpu className="w-3.5 h-3.5" />} label="Syncing" value={isSyncing ? 'SÍ' : 'NO'} />
               <FooterStat icon={<ShieldAlert className="w-3.5 h-3.5" />} label="Logs" value={`${logs.length}`} />
            </div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
               Modo Inspección Activo • Root User
            </div>
         </div>
      </div>
    </div>
  );
}

function TypeChip({ label, color }: { label: string, color: string }) {
  return (
    <button className={`px-3 py-1.5 bg-slate-800 border border-slate-700/50 rounded-xl text-[9px] font-black uppercase ${color} hover:bg-slate-700 transition-all`}>
       {label}
    </button>
  );
}

function FooterStat({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center gap-2">
       <div className="text-slate-500">{icon}</div>
       <div className="text-[9px] font-black uppercase text-slate-400">{label}: <span className="text-white">{value}</span></div>
    </div>
  );
}
