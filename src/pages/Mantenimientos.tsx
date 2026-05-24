import React, { useState, useMemo } from "react";
import { 
  Wrench, 
  Calendar, 
  History, 
  ClipboardList, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Copy, 
  RotateCcw,
  Eye,
  Camera,
  Paperclip,
  CheckCircle2,
  X
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useMantenimientos } from "../hooks/useMantenimientos";
import { NuevoMantenimientoModal } from "../components/modals/NuevoMantenimientoModal";
import { MaintenanceCalendar } from "../components/modals/MaintenanceCalendar";
import { FilterPresetsDropdown } from "../components/modals/FilterPresetsDropdown";
import { useAuth } from "../context/AuthContext";

export default function Mantenimientos() {
  const { permisos } = useAuth();
  const preventive_maintenance = useAppStore(state => state.preventive_maintenance);
  const assets = useAppStore(state => state.assets);
  const loading = useAppStore(state => state.isLoading);
  const { createMantenimiento, deleteMantenimiento } = useMantenimientos();
  
  const [showModal, setShowModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [filter, setFilter] = useState("");

  if (!permisos?.ver_mantenimientos) return <div className="p-20 text-center text-slate-400 font-black uppercase italic">Acceso Denegado</div>;

  const assetToClientMap = useMemo(() => {
    const map: Record<string, string> = {};
    assets.forEach(a => {
      if (a.cliente_id) {
        map[a.tag] = a.cliente_id;
      }
    });
    return map;
  }, [assets]);

  const filtered = useMemo(() => {
    const activeClientUuid = localStorage.getItem("active_client");
    return preventive_maintenance.filter(m => {
      if (activeClientUuid) {
        const client_id = assetToClientMap[m.equipo_tag];
        if (client_id && client_id !== activeClientUuid) {
          return false;
        }
      }
      return m.equipo_tag.toLowerCase().includes(filter.toLowerCase()) || 
             m.tecnico.toLowerCase().includes(filter.toLowerCase()) ||
             m.id.toLowerCase().includes(filter.toLowerCase());
    });
  }, [preventive_maintenance, filter, assetToClientMap]);

  if (loading && preventive_maintenance.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 animate-pulse">
        <Wrench className="w-12 h-12 text-slate-200 mb-4 animate-bounce" />
        <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Recuperando Bitácora de Mantenimientos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Registro de Mantenimientos</h2>
          <p className="text-slate-500 text-sm font-medium">Control de servicios preventivos y correctivos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowCalendar(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all">
            <Calendar className="w-4 h-4" /> Calendario
          </button>
          {permisos?.crear_mantenimiento && (
            <button 
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" /> Nuevo Registro
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Realizados" value="128" color="emerald" />
        <StatCard label="Programados" value="12" color="blue" />
        <StatCard label="Atrasados" value="3" color="red" />
        <StatCard label="Rendimiento" value="98%" color="slate" />
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por TAG, Técnico o ID..." 
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
           <FilterPresetsDropdown onApply={() => {}} />
           <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none min-w-[120px]">
              <option>Todos los Tipos</option>
              <option>Preventivo</option>
              <option>Correctivo</option>
           </select>
           <button className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"><Filter className="w-4 h-4" /></button>
        </div>
      </div>

      {/* List Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 italic">
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">ID / Fecha</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Equipo TAG</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Técnico</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(m => (
              <tr key={m.uuid_sync} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="text-xs font-black text-slate-900">{m.id}</div>
                  <div className="text-[10px] font-bold text-slate-400">{m.fecha}</div>
                </td>
                <td className="px-6 py-4 font-bold text-blue-600 text-xs">{m.equipo_tag}</td>
                <td className="px-6 py-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{m.tipo}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    m.estado === 'atrasado' ? 'bg-red-100 text-red-600' : 
                    m.estado === 'programado' ? 'bg-blue-100 text-blue-600' : 
                    'bg-emerald-100 text-emerald-600'
                  }`}>
                    {m.estado}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">{m.tecnico}</td>
                <td className="px-6 py-4 text-right">
                   <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 shadow-sm"><Eye className="w-3.5 h-3.5" /></button>
                      <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button 
                        onClick={() => deleteMantenimiento(m.uuid_sync)}
                        className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <NuevoMantenimientoModal onClose={() => setShowModal(false)} />}
      {showCalendar && <MaintenanceCalendar onClose={() => setShowCalendar(false)} />}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    red: "bg-red-50 text-red-600 border-red-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100"
  };
  return (
    <div className={`p-6 rounded-3xl border border-slate-200 bg-white space-y-1 text-left`}>
       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
       <div className="text-2xl font-black text-slate-900">{value}</div>
       <div className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase ${colors[color]}`}>+12% vs mes anterior</div>
    </div>
  );
}
