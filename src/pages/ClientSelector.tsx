import { Building, LogOut, ChevronRight, Check } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { CLIENTS } from "../data/clients";

export default function ClientSelector() {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (clientId: string) => {
    setSelected(clientId);
    localStorage.setItem("active_client", clientId);
    setTimeout(() => {
      // Check if there was a pending tag
      const pendingTag = localStorage.getItem("pending_tag");
      if (pendingTag) {
        // In a real app we'd redirect to the equipment card of that tag
        // For now, let's just go to scanner or dashboard
        localStorage.removeItem("pending_tag");
      }
      setLocation("/");
    }, 500);
  };

  const handleLogout = () => {
    localStorage.removeItem("is_authenticated");
    localStorage.removeItem("auth_pin");
    localStorage.removeItem("active_client");
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-8 h-16 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2 leading-none">
          <div className="w-6 h-6 bg-blue-600 rounded"></div>
          <span className="font-bold text-slate-800 uppercase tracking-tighter">Control HVAC</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> CERRAR SESIÓN
        </button>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-12 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="mb-8 text-center md:text-left">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Seleccionar Cliente</h1>
            <p className="text-slate-500 font-medium">Tienes acceso a {CLIENTS.length} centros de control habilitados.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CLIENTS.length > 0 ? (
              CLIENTS.map((client) => (
                <div
                  key={client.id}
                  onClick={() => handleSelect(client.id)}
                  className={`group relative bg-white p-6 rounded-2xl border transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 ${
                    selected === client.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl transition-colors ${selected === client.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                      <Building className="w-6 h-6" />
                    </div>
                    {selected === client.id && <Check className="w-5 h-5 text-blue-500" />}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 text-lg uppercase tracking-tight leading-snug">{client.name}</h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                      <span className="uppercase">{client.site}</span>
                      <span className="opacity-20">|</span>
                      <span>{client.rut}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                      client.plan === 'Enterprise Pro' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {client.plan}
                    </span>
                    <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-bold text-xs uppercase">
                      Configurar <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full bg-white p-12 rounded-[32px] border border-slate-200 text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Building className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">No hay clientes configurados</h3>
                <p className="text-slate-500 font-medium mb-8 max-w-sm mx-auto">
                  Debe configurar su primer cliente en el panel de administración o continuar al entorno general.
                </p>
                <button 
                  onClick={() => {
                    localStorage.removeItem("active_client");
                    setLocation("/");
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all active:scale-95"
                >
                  Ir al Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
