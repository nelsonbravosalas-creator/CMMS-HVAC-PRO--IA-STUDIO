import React, { useState } from "react";
import { 
  Building2, 
  Plus, 
  RotateCcw, 
  Edit2, 
  Search,
  ChevronRight,
  AlertTriangle
} from "lucide-react";
import { ClientModal } from "../components/modals/ClientModal";
import { useAppStore } from "../store/useAppStore";
import { LocalCliente, LocalSucursal } from "../db/database";
import { syncEngine } from "../sync/syncEngine";

export default function Clientes() {
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<{ client: LocalCliente, branches: LocalSucursal[] } | null>(null);
  const [filter, setFilter] = useState("");

  const clients = useAppStore(state => state.clients);
  const branches = useAppStore(state => state.branches);

  const handleEditClient = (client: LocalCliente) => {
    const clientBranches = branches.filter(b => b.cliente_id === client.uuid_sync);
    setEditingClient({ client, branches: clientBranches });
    setShowClientModal(true);
  };

  const handleAddClient = () => {
    setEditingClient(null);
    setShowClientModal(true);
  };

  const handleRefresh = async () => {
    await syncEngine.triggerSync(true);
  };

  const activeClients = clients.filter(c => 
    c.activo !== false && 
    (c.nombre?.toLowerCase().includes(filter.toLowerCase()) || 
     (c.rut || "").toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-8 text-left animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Gestión de Clientes</h2>
          <p className="text-slate-500 text-sm font-medium">Administración de carteras de clientes, contratos y sus respectivas sucursales en terreno.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4" /> Sincronizar
          </button>
          <button 
            onClick={handleAddClient}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-slate-900/10"
          >
            <Plus className="w-4 h-4" /> Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm p-6">
        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" 
            placeholder="Buscar por nombre de cliente o RUT..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold transition-all focus:ring-2 focus:ring-slate-900/10" 
          />
        </div>

        <div className="space-y-4">
          {activeClients.length === 0 ? (
            <div className="text-center p-12 bg-slate-50 rounded-[32px] border border-dashed border-slate-350">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">No se encontraron clientes registrados</p>
            </div>
          ) : (
            activeClients.map(c => {
              const clientBranches = branches.filter(b => b.cliente_id === c.uuid_sync);
              return (
                <div key={c.uuid_sync} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-slate-900 text-white rounded-3xl"><Building2 className="w-6 h-6" /></div>
                      <div>
                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{c.nombre}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.rut || c.empresa} • {c.email || 'Sin correo asignado'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleEditClient(c)} 
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-2"
                      >
                        <Edit2 className="w-3 h-3" /> Editar Ficha
                      </button>
                    </div>
                  </div>
                  
                  {c.sync_status === 'conflicted' && (
                    <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col gap-4 text-left">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-black text-amber-800 uppercase tracking-wider">⚠️ SISTEMA DE RESOLUCIÓN DE CONFLICTOS ACTIVADO</p>
                          <p className="text-slate-600 text-xs font-medium mt-1 leading-relaxed">
                            Este cliente fue creado o modificado originalmente en modo <strong className="text-amber-800">offline first</strong> y al intentar sincronizarse con la base de datos central ha generado una réplica (duplicado de RUT o de Nombre de Empresa). Por favor verifique y compare los datos ingresados.
                          </p>
                        </div>
                      </div>
                      <div className="bg-white/80 p-4 rounded-2xl border border-amber-100 text-[11px] text-slate-700 leading-relaxed shadow-sm">
                        <span className="font-extrabold text-amber-800 uppercase block mb-1">💡 Medida sugerida por el auditor de seguridad:</span>
                        Si los RUT coinciden exactamente, le recomendamos realizar una <strong>Fusión de Ficha Maestra</strong>. Bajo esta medida, el sistema absorbe automáticamente todas las sucursales secundarias y equipos de ambas fichas bajo un único registro principal unificado, sanando la redundancia y manteniendo la integridad del inventario industrial y el etiquetado QR.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Sucursales</span>
                      <span className="text-xl font-black text-slate-900">{clientBranches.length}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Estado Contractual</span>
                      <span className="text-[10px] font-black text-emerald-650 uppercase">Activo</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 col-span-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Dirección Central</span>
                      <span className="text-xs font-bold text-slate-600 line-clamp-1">{c.direccion || 'No registrada'}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ClientModal 
        isOpen={showClientModal} 
        onClose={() => setShowClientModal(false)}
        editingClient={editingClient}
      />
    </div>
  );
}
