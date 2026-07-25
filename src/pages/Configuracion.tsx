import React, { useState, useEffect, useRef } from "react";
import { 
  Info, 
  Settings, 
  Database, 
  ShieldCheck, 
  RotateCcw, 
  Trash2, 
  Zap, 
  History, 
  RefreshCw, 
  Server, 
  Github, 
  Mail,
  HardDrive,
  Coins,
  Image as ImageIcon,
  Upload,
  Download,
  FileText
} from "lucide-react";

import { resetApplicationData } from "../lib/reset";
import { xmlSyncService } from "../lib/xmlSync";
import { logger } from "../lib/logger";
import { syncEngine } from "../sync/syncEngine";
import { useSyncStore } from "../store/useSyncStore";
import { useAuth } from "../context/AuthContext";
import AccessDenied from "../components/AccessDenied";

export default function Configuracion() {
  const { user } = useAuth();
  const [currency, setCurrency] = useState(() => localStorage.getItem("system_currency") || "CLP");
  const { isSyncing, pendingCount, lastSync, isOnline } = useSyncStore();
  const [syncStatus, setSyncStatus] = useState<string>("");

  const [cloneMode, setCloneMode] = useState<'merge' | 'overwrite'>('merge');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneMessage, setCloneMessage] = useState("");

  const handleCloneProductionDb = async () => {
    if (cloneMode === 'overwrite') {
      if (!confirm("⚠️ ADVERTENCIA: Has seleccionado el modo REEMPLAZO TOTAL. Esto vaciará todas las tablas locales de desarrollo antes de insertar los datos de producción. ¿Está completamente seguro?")) {
        return;
      }
    } else {
      if (!confirm("Esto sincronizará (fusionará) los registros de producción en la base de datos de desarrollo. ¿Desea continuar?")) {
        return;
      }
    }

    setIsCloning(true);
    setCloneMessage("Conectando y sincronizando tablas...");
    
    try {
      const response = await fetch("/api/admin/clone-production-db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionStorage.getItem("auth_token") ? { Authorization: `Bearer ${sessionStorage.getItem("auth_token")}` } : {}),
        },
        body: JSON.stringify({
          mode: cloneMode,
          confirmation: cloneMode === 'overwrite' ? 'CLONE_PRODUCTION_OVERWRITE' : undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al sincronizar base de datos.");
      }

      localStorage.removeItem("prod_db_url");
      setCloneMessage("¡Sincronización de Producción Exitosa!");
      alert("✅ Datos de producción sincronizados con éxito en el entorno de desarrollo.");
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setCloneMessage(`Error: ${err.message}`);
      alert(`❌ Error al importar desde producción: ${err.message}`);
    } finally {
      setIsCloning(false);
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      alert("Error: Dispositivo fuera de línea. Active su conexión a Internet.");
      return;
    }
    setSyncStatus("Sincronizando...");
    try {
      await syncEngine.fullSync(true);
      setSyncStatus("¡Sincronización completada!");
      setTimeout(() => setSyncStatus(""), 3000);
    } catch (e: any) {
      setSyncStatus(`Error: ${e.message}`);
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const xmlInputRef = useRef<HTMLInputElement>(null);

  const handleExportXML = async () => {
    setIsExporting(true);
    try {
      await xmlSyncService.exportToXML();
      alert("Respaldo XML generado y descargado con éxito.");
    } catch (e) {
      alert("Error al exportar XML. Revise la consola.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportXML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Esta acción integrará los datos del archivo XML en su base de datos local. Los registros existentes con el mismo UUID se actualizarán. ¿Desea continuar?")) {
      return;
    }

    setIsImporting(true);
    try {
      const count = await xmlSyncService.importFromXML(file);
      alert(`Importación exitosa: ${count} registros procesados. El sistema se recargará para aplicar los cambios.`);
      window.location.reload();
    } catch (e: any) {
      alert("Error en la importación: " + e.message);
    } finally {
      setIsImporting(false);
    }
  };

// =========================================================
  // 1. ESTADO Y LÓGICA DE SUBIDA DE LOGO (Persistencia Local)
  // =========================================================
  const [appLogo, setAppLogo] = useState(() => localStorage.getItem("system_logo"));
  const fileInputRef = useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAppLogo(base64);
        localStorage.setItem("system_logo", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setAppLogo(null);
    localStorage.removeItem("system_logo");
  };
  
  useEffect(() => {
    localStorage.setItem("system_currency", currency);
  }, [currency]);

  const handleResetApplication = async () => {
    if (confirm("¿Está seguro de realizar un RESET TOTAL del sistema? Se eliminarán todos los datos locales (IndexedDB), sesiones, logos y configuraciones. Deberá iniciar sesión nuevamente.")) {
      await resetApplicationData();
    }
  };

  if (user?.perfil !== "administrador") {
    return <AccessDenied requiredPermission="Configurar el sistema" />;
  }

  return (
    <div className="flex flex-col gap-8 text-left animate-in fade-in duration-500 pb-20">
      <div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Configuración de Sistema</h2>
        <p className="text-slate-500 text-sm font-medium">Información técnica y mantenimiento de base de datos local.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            
            <SectionBox title="Acerca del Sistema" icon={<Info className="w-4 h-4" />}>
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-6 mb-6 text-container-contrast">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-[24px] flex items-center justify-center shadow-2xl shadow-blue-600/20">
                     <Zap className="w-8 h-8 fill-current" />
                  </div>
                  <div>
                     <h4 className="text-lg font-black text-slate-900 leading-none">STK HVAC EXPERT</h4>
                     <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Versión 2026.04.24-RC1</p>
                  </div>
               </div>
               <p className="text-sm text-slate-600 font-medium leading-relaxed italic">
                 Plataforma avanzada de gestión de activos y mantenimiento para sistemas de climatización industrial. Diseñada por y para especialistas técnicos de terreno.
               </p>
            </SectionBox>

            <SectionBox title="Marca e Identidad" icon={<ImageIcon className="w-4 h-4" />}>
                 <div className="p-6 bg-blue-50 border border-blue-100 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-3 bg-white rounded-2xl text-blue-600 shadow-sm">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black uppercase tracking-tight text-blue-900 leading-none mb-1">Logo Corporativo</h4>
                        <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest leading-none">Para documentos e informes oficiales</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleLogoUpload} 
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="bg-white hover:bg-slate-50 text-slate-900 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm"
                      >
                         <Upload className="w-3.5 h-3.5" /> Subir Logo
                      </button>
                      {appLogo && (
                        <button 
                          onClick={removeLogo} 
                          className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                        >
                           <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                 </div>
              </SectionBox>


            <SectionBox title="Preferencias de Moneda" icon={<Coins className="w-4 h-4" />}>
               <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase text-slate-400">Moneda del Sistema</label>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['CLP', 'UF', 'USD', 'EUR'].map((curr) => (
                           <button
                              key={curr}
                              onClick={() => setCurrency(curr)}
                              className={`py-3 px-4 rounded-2xl text-xs font-black transition-all border ${
                                 currency === curr 
                                 ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20" 
                                 : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                              }`}
                           >
                              {curr}
                           </button>
                        ))}
                     </div>
                     <p className="text-[9px] font-medium text-slate-400 mt-2 italic">Afecta visualmente a costos de mantenimiento e reports.</p>
                  </div>
               </div>
            </SectionBox>

            <SectionBox title="Estadísticas de Uso Local" icon={<HardDrive className="w-4 h-4" />}>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <StatRow label="Almacenamiento Local" value="Gestionado por el navegador" percent={0} />
                  <StatRow label="Operaciones Pendientes" value={`${pendingCount} registros`} percent={0} />
               </div>
            </SectionBox>

            <SectionBox title="Fuentes de Datos" icon={<Server className="w-4 h-4" />}>
               <div className="space-y-4">
                  <SourceItem label="API del sistema" status={isOnline ? "DISPONIBLE" : "SIN RED"} latency="No medido" />
                  <SourceItem label="Base local Dexie" status="DISPONIBLE" latency="Local" />
               </div>
            </SectionBox>
         </div>

         <div className="lg:col-span-1 space-y-8">
            <SectionBox title="Sincronización Nube (Neon)" icon={<Server className="w-4 h-4" />} variant="dark">
               <div className="space-y-4 text-left">
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                     <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">Vínculo de Red</span>
                     <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                     </span>
                  </div>

                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                     <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">Cola Dexie Local</span>
                     <span className="text-xs font-black text-white font-mono">{pendingCount} pendientes</span>
                  </div>

                  <div className="flex flex-col bg-white/5 p-4 rounded-2xl border border-white/10 gap-1 font-mono">
                     <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">Último Envío Exitoso</span>
                     <span className="text-xs font-black text-white">
                        {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Ninguno registrado'}
                     </span>
                  </div>

                  <button 
                     onClick={handleManualSync}
                     disabled={isSyncing}
                     className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer"
                  >
                     <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                     {isSyncing ? 'Sincronizando...' : 'Forzar Sincronización'}
                  </button>

                  {syncStatus && (
                     <p className="text-[9px] font-black text-center text-emerald-400 uppercase tracking-widest animate-pulse mt-1">
                        {syncStatus}
                     </p>
                  )}
               </div>
            </SectionBox>

            <SectionBox title="Clonar Prod a Desarrollo" icon={<Database className="w-4 h-4" />} variant="dark">
               <div className="space-y-4 text-left">
                  <p className="text-[10px] font-semibold text-white/60">
                    La conexión de producción se obtiene exclusivamente del secreto servidor <code>PROD_DATABASE_URL</code>.
                  </p>

                  <div>
                     <span className="text-[10px] font-black uppercase text-white/60 tracking-widest block mb-1.5">Método de Sincronización</span>
                     <div className="grid grid-cols-2 gap-2">
                        <button 
                           type="button"
                           onClick={() => setCloneMode('merge')}
                           className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                              cloneMode === 'merge' 
                              ? "bg-blue-600 text-white border-blue-600 animate-in fade-in" 
                              : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                           }`}
                        >
                           Fusionar (Upsert)
                        </button>
                        <button 
                           type="button"
                           onClick={() => setCloneMode('overwrite')}
                           className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                              cloneMode === 'overwrite' 
                              ? "bg-red-650 text-white border-red-650 animate-in fade-in" 
                              : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                           }`}
                        >
                           Reemplazar Todo
                        </button>
                     </div>
                  </div>

                  <button 
                     onClick={handleCloneProductionDb}
                     disabled={isCloning}
                     className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50 cursor-pointer"
                  >
                     <RefreshCw className={`w-4 h-4 ${isCloning ? 'animate-spin' : ''}`} />
                     {isCloning ? 'Sincronizando...' : 'Clonar Base de Datos'}
                  </button>

                  {cloneMessage && (
                     <p className={`text-[9px] font-extrabold text-center uppercase tracking-widest ${cloneMessage.startsWith('Error') ? 'text-red-450' : 'text-indigo-400'} animate-pulse mt-1`}>
                        {cloneMessage}
                     </p>
                  )}
               </div>
            </SectionBox>

            <SectionBox title="Gestión de Datos" icon={<Database className="w-4 h-4" />} variant="dark">
               <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2 p-4 bg-white/5 rounded-[24px] border border-white/10">
                     <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">Respaldo Maestro</span>
                     </div>
                     <div className="flex gap-2">
                        <button 
                           onClick={handleExportXML} 
                           disabled={isExporting}
                           className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
                        >
                           {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                           Exportar XML
                        </button>
                        <button 
                           onClick={() => xmlInputRef.current?.click()} 
                           disabled={isImporting}
                           className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50"
                        >
                           {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                           Importar XML
                        </button>
                        <input 
                           type="file" 
                           ref={xmlInputRef} 
                           className="hidden" 
                           accept=".xml" 
                           onChange={handleImportXML} 
                        />
                     </div>
                  </div>

                  <button onClick={() => window.location.reload()} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase rounded-2xl transition-all flex items-center justify-center gap-2">
                     <RefreshCw className="w-4 h-4" /> Recargar Sistema
                  </button>
                  <button onClick={handleResetApplication} className="w-full py-4 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-[10px] font-black uppercase rounded-2xl transition-all flex items-center justify-center gap-2 border border-red-500/20">
                     <Trash2 className="w-4 h-4" /> Reset Maestro de Datos
                  </button>
               </div>
               <p className="text-[9px] font-medium text-white/40 mt-6 leading-relaxed italic">
                 El respaldo XML mapea todas las tablas de IndexedDB. La importación incorporará los datos respetando los UUIDs existentes.
               </p>
            </SectionBox>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 space-y-6">
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Soporte Técnico</h3>
               <div className="space-y-4">
                  <a href="#" className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                     <Mail className="w-4 h-4 text-slate-400" />
                     <span className="text-xs font-black text-slate-900 uppercase">Enviar Ticket Soporte</span>
                  </a>
                  <a href="#" className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                     <Github className="w-4 h-4 text-slate-400" />
                     <span className="text-xs font-black text-slate-900 uppercase">Documentación Dev</span>
                  </a>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function SectionBox({ title, icon, children, variant = 'light' }: { title: string, icon: React.ReactNode, children: React.ReactNode, variant?: 'light' | 'dark' }) {
  return (
    <div className={`p-8 rounded-[40px] border shadow-sm flex flex-col text-left ${
      variant === 'dark' 
        ? "bg-slate-900 text-white border-slate-800" 
        : "bg-white text-slate-900 border-slate-200"
    }`}>
       <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-4">
          <div className={`${variant === 'dark' ? 'text-blue-400' : 'text-slate-400'}`}>{icon}</div>
          <h3 className={`text-xs font-black uppercase tracking-widest ${variant === 'dark' ? 'text-white' : 'text-slate-400'}`}>{title}</h3>
       </div>
       {children}
    </div>
  );
}

function StatRow({ label, value, percent }: { label: string, value: string, percent: number }) {
  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2">
       <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400">
          <span>{label}</span>
          <span className="text-slate-900">{value}</span>
       </div>
       <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${percent}%` }}></div>
       </div>
    </div>
  );
}

function SourceItem({ label, status, latency }: { label: string, status: string, latency: string }) {
  const available = status === "DISPONIBLE";
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 italic">
       <span className="text-xs font-bold uppercase text-slate-700">{label}</span>
       <div className="flex items-center gap-4">
          <span className="text-[10px] font-black text-slate-400 uppercase">{latency}</span>
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${available ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>{status}</span>
       </div>
    </div>
  );
}
