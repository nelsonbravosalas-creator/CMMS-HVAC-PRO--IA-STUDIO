import React, { useState } from "react";
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
import { Mantenimiento } from "../data/preventive_maintenance";
import { DataStore, useDataStore } from "../services/dataStore";
import { NuevoMantenimientoModal } from "../components/modals/NuevoMantenimientoModal";
import { MaintenanceCalendar } from "../components/modals/MaintenanceCalendar";
import { FilterPresetsDropdown } from "../components/modals/FilterPresetsDropdown";
import { useAuth } from "../context/AuthContext";

export default function Mantenimientos() {
  const { permisos } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [filter, setFilter] = useState("");
  const mats = useDataStore(() => DataStore.getMantenimientos());

  if (!permisos?.ver_mantenimientos) return <div className="p-20 text-center text-slate-400 font-black uppercase italic">Acceso Denegado</div>;

  const filtered = mats.filter(m => 
    m.tag.toLowerCase().includes(filter.toLowerCase()) || 
    m.tecnico.toLowerCase().includes(filter.toLowerCase()) ||
    m.id.toLowerCase().includes(filter.toLowerCase())
  );

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
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">ID / Fecha</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Equipo (TAG)</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Servicio</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Técnico</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Estado</th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900 italic tracking-tighter">#{m.id}</span>
                    <span className="text-[10px] font-bold text-slate-400">{m.fecha}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                   <Link href={`/equipos/${m.tag}`}>
                    <span className="text-xs font-black text-blue-600 hover:underline cursor-pointer tracking-widest">{m.tag}</span>
                   </Link>
                </td>
                <td className="px-6 py-4">
                   <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${m.tipo === 'correctivo' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                      <span className="text-[10px] font-black uppercase text-slate-600">{m.tipo}</span>
                   </div>
                </td>
                <td className="px-6 py-4 text-xs font-bold text-slate-500">{m.tecnico}</td>
                <td className="px-6 py-4">
                   <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${
                     m.estado === 'realizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                     m.estado === 'programado' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                     'bg-amber-50 text-amber-600 border-amber-100'
                   }`}>
                     {m.estado}
                   </span>
                </td>
                <td className="px-6 py-4 text-right">
                   <button className="p-2 text-slate-300 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-4 h-4" />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <NuevoMantenimientoModal onClose={() => setShowModal(false)} />}
      {showCalendar && <MaintenanceCalendar onClose={() => setShowCalendar(false)} events={[]} />}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: string, color: 'emerald' | 'blue' | 'red' | 'slate' }) {
  const colors = {
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
