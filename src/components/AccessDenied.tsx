import React from "react";
import { Link, useLocation } from "wouter";
import { ShieldAlert, ArrowLeft, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AccessDeniedProps {
  requiredPermission?: string;
}

export default function AccessDenied({ requiredPermission }: AccessDeniedProps) {
  const { logout, user } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 md:p-12 animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800 rounded-3xl p-8 hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-300 text-center flex flex-col items-center">
        
        {/* Animated Icon Ring */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-red-500/20 dark:bg-red-500/30 rounded-full blur-xl animate-pulse"></div>
          <div className="relative w-16 h-16 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center border border-red-100 dark:border-red-900/30">
            <ShieldAlert className="w-8 h-8" />
          </div>
        </div>

        {/* Text Area */}
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
          Acceso Restringido
        </h3>
        
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1 mb-4">
          Privilegios Insuficientes
        </p>

        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-sm mb-8">
          Tu cuenta <strong className="text-slate-900 dark:text-white font-black">{user?.correo || "actual"}</strong> con perfil <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide">{user?.perfil || "visita"}</span> no tiene habilitada esta sección.
          {requiredPermission && (
            <span className="block mt-2 text-xs font-semibold text-slate-400">
              Requerido: {requiredPermission}
            </span>
          )}
        </p>

        {/* Action Panel */}
        <div className="w-full flex flex-col gap-3">
          <Link href="/">
            <a className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-[10px] font-black uppercase rounded-2xl tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
              <ArrowLeft className="w-4 h-4" /> Volver al Inicio
            </a>
          </Link>

          {user?.perfil === "administrador" && (
            <Link href="/client-selector">
              <a className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 active:scale-[0.98] text-slate-900 dark:text-white text-[10px] font-black uppercase rounded-2xl tracking-widest transition-all border border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Selector de Clientes
              </a>
            </Link>
          )}

          <button 
            onClick={handleLogout}
            className="w-full py-3.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 active:scale-[0.98] text-red-600 dark:text-red-400 text-[10px] font-black uppercase rounded-2xl tracking-widest transition-all flex items-center justify-center gap-2 border border-red-100/30 dark:border-red-900/10"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>

      </div>
    </div>
  );
}
