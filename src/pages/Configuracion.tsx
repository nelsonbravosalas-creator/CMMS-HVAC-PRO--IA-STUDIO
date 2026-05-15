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
  Upload
} from "lucide-react";

import { resetApplicationData } from "../lib/reset";

export default function Configuracion() {
  const [currency, setCurrency] = useState(() => localStorage.getItem("system_currency") || "CLP");

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

  return (
    <div className="flex flex-col gap-8 text-left animate-in fade-in duration-500 pb-20">
      <div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Configuración de Sistema</h2>
        <p className="text-slate-500 text-sm font-medium">Información técnica y mantenimiento de base de datos local.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            
            <SectionBox title="Acerca del Sistema" icon={<Info className="w-4 h-4" />}>
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-6 mb-6">
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
                  <StatRow label="Almacenamiento Local" value="4.2 MB / 10 MB" percent={42} />
                  <StatRow label="Tickets en Caché" value="12 Registrados" percent={10} />
                  <StatRow label="Presets Guardados" value="8 Configuraciones" percent={80} />
                  <StatRow label="Informes Offline" value="0 Pendientes" percent={0} />
               </div>
            </SectionBox>

            <SectionBox title="Fuentes de Datos" icon={<Server className="w-4 h-4" />}>
               <div className="space-y-4">
                  <SourceItem label="Master Equipment DB" status="ONLINE" latency="12ms" />
                  <SourceItem label="Service History API" status="ONLINE" latency="45ms" />
                  <SourceItem label="User Auth Provider" status="ONLINE" latency="8ms" />
               </div>
            </SectionBox>
         </div>

         <div className="lg:col-span-1 space-y-8">
            <SectionBox title="Gestión de Datos" icon={<Database className="w-4 h-4" />} variant="dark">
               <div className="space-y-4">
                  <button onClick={() => window.location.reload()} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase rounded-2xl transition-all flex items-center justify-center gap-2">
                     <RefreshCw className="w-4 h-4" /> Recargar Sistema
                  </button>
                  <button onClick={handleResetApplication} className="w-full py-4 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-[10px] font-black uppercase rounded-2xl transition-all flex items-center justify-center gap-2 border border-red-500/20">
                     <Trash2 className="w-4 h-4" /> Reset Maestro de Datos
                  </button>
               </div>
               <p className="text-[9px] font-medium text-white/40 mt-6 leading-relaxed italic">
                 La limpieza eliminará todos los filtros guardados y estados de sesión. Úselo solo si experimenta comportamientos inesperados.
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
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 italic">
       <span className="text-xs font-bold uppercase text-slate-700">{label}</span>
       <div className="flex items-center gap-4">
          <span className="text-[10px] font-black text-slate-400 uppercase">{latency}</span>
          <span className="text-[9px] font-black text-emerald-600 uppercase px-2 py-0.5 bg-emerald-50 rounded-full">{status}</span>
       </div>
    </div>
  );
}
