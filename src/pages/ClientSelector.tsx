import { Building, LogOut, ChevronRight, Check, Globe2, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { useAuth } from "../context/AuthContext";
import { ClientModal } from "../components/modals/ClientModal";

export default function ClientSelector() {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const { user, logout } = useAuth();
  const isAdmin = user?.perfil === "administrador";
  const canSelectClient = isAdmin || user?.perfil === "supervisor" || user?.perfil === "tecnico";

  const clients = useAppStore(state => state.clients);
  const isLoading = useAppStore(state => state.isLoading);
  const hydrate = useAppStore(state => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const allowedClientIds = new Set([
    ...(user?.cliente_ids || []),
    ...(user?.cliente_id ? [user.cliente_id] : [])
  ]);
  const activeClients = clients.filter(c =>
    !c.deleted_at &&
    c.activo !== false &&
    (isAdmin || allowedClientIds.has(c.uuid_sync) || allowedClientIds.has(c.id))
  );

  const handleSelect = (client: typeof activeClients[number]) => {
    setSelected(client.id);
    localStorage.setItem("active_client", client.id);
    localStorage.setItem("active_client_name", client.nombre);
    localStorage.removeItem("last_sync_timestamp");
    localStorage.removeItem("admin_global_view");
    setTimeout(() => {
      // Check if there was a pending tag
      const pendingTag = localStorage.getItem("pending_tag");
      if (pendingTag) {
        // In a real app we'd redirect to the equipment card of that tag
        // For now, let's just go to scanner or dashboard
        localStorage.removeItem("pending_tag");
      }
      window.location.href = "/";
    }, 500);
  };

  const handleGlobalView = () => {
    localStorage.removeItem("active_client");
    localStorage.removeItem("active_client_name");
    localStorage.setItem("admin_global_view", "true");
    setLocation("/");
  };

  const handleLogout = () => {
    logout();
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
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          <LogOut className="w-3.5 h-3.5" /> CERRAR SESIÓN
        </button>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-12 flex items-center justify-center">
        <div className="max-w-4xl w-full">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Seleccionar Cliente</h1>
              <p className="text-slate-500 font-medium">
                {isAdmin
                  ? "Selecciona un cliente para operar en su contexto o continúa con la vista global."
                  : `Tienes acceso a ${activeClients.length} centros de control habilitados.`}
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowClientModal(true)}
                className="flex min-h-11 self-center items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/10 transition-all hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 md:self-auto"
              >
                <Plus className="w-4 h-4" /> Nuevo cliente
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoading ? (
              <div className="col-span-full text-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Cargando Clientes...</p>
              </div>
            ) : (
              <>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleGlobalView}
                  className="group relative bg-slate-900 p-6 rounded-2xl border border-slate-900 text-left transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-xl bg-blue-600 text-white">
                      <Globe2 className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="font-bold text-white text-lg uppercase tracking-tight">Vista global</h3>
                  <p className="text-xs font-medium text-slate-400 mt-1">Operar sin un cliente preseleccionado.</p>
                  <div className="mt-6 border-t border-white/10 pt-4">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-emerald-500/15 text-emerald-400">
                      Administrador
                    </span>
                  </div>
                </button>
              )}

              {activeClients.map((client) => (
                <button
                  type="button"
                  key={client.uuid_sync}
                  onClick={() => handleSelect(client)}
                  className={`group relative bg-white p-6 rounded-2xl border text-left transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 ${
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
                    <h3 className="font-bold text-slate-900 text-lg uppercase tracking-tight leading-snug">{client.nombre}</h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                      <span className="uppercase">{client.direccion || 'Sin Sucursal'}</span>
                      <span className="opacity-20">|</span>
                      <span>{client.rut}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                      true ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      Activo
                    </span>
                    <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-bold text-xs uppercase">
                      Configurar <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>
              ))}

              {activeClients.length === 0 && !isAdmin && (
              <div className="col-span-full bg-white p-12 rounded-[32px] border border-slate-200 text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Building className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">No hay clientes configurados</h3>
                <p className="text-slate-500 font-medium mb-8 max-w-sm mx-auto">
                  El administrador debe asignar al menos un cliente a tu usuario.
                </p>
              </div>
              )}
              </>
            )}
          </div>
        </div>
      </main>

      {isAdmin && canSelectClient && (
        <ClientModal
          isOpen={showClientModal}
          onClose={() => setShowClientModal(false)}
          editingClient={null}
        />
      )}
    </div>
  );
}
