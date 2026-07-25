import React, { useState } from "react";
import { 
  FileText, 
  Eye, 
  Plus, 
  Search, 
  CheckCircle2,
  ScanLine
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { useAuth } from "../context/AuthContext";

export default function OrdenesServicio() {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [, setLocation] = useLocation();
  const { permisos } = useAuth();

  const rawOrdenes = useLiveQuery(() => db.ordenes_servicio.toArray(), []) || [];
  const activeClientUid = localStorage.getItem("active_client");

  const filtered = rawOrdenes.filter(os => {
    const data = os.data || {};
    const orderClient = os.cliente_id || data.generalData?.cliente;
    if (!activeClientUid || orderClient !== activeClientUid || os.sync_status === 'pending_delete') {
      return false;
    }
    const tg = data.generalData?.equipoTag || "";
    const tec = data.generalData?.tecnico || "";
    const idStr = os.id || "";
    const filterLower = (filter || "").toLowerCase();
    const matchesText = tg.toLowerCase().includes(filterLower) ||
      tec.toLowerCase().includes(filterLower) ||
      idStr.toLowerCase().includes(filterLower);
    const matchesStatus = statusFilter === "todos" || os.estado === statusFilter;
    return matchesText && matchesStatus;
  }).map(os => ({
    id: os.id,
    fecha: os.data?.generalData?.fecha || new Date(os.updated_at || Date.now()).toISOString().split('T')[0],
    tag: os.data?.generalData?.equipoTag || "S/T",
    equipoNombre: os.data?.generalData?.descripcionEquipo || "Equipo sin descripción",
    tipoServicio: os.data?.generalData?.tipoServicio || "Preventivo",
    tecnico: os.data?.generalData?.tecnico || "No Asignado",
    estado: os.estado || "abierto"
  }));
  const statusCounts = filtered.reduce((acc, order) => {
    acc[order.estado] = (acc[order.estado] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Órdenes de Servicio</h2>
          <p className="text-slate-500 text-sm font-medium">Gestión de órdenes de servicio, checklists y hallazgos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/scanner")}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all"
          >
            <ScanLine className="w-4 h-4" /> Escanear QR
          </button>
          {permisos?.crear_orden_servicio && (
            <button
              onClick={() => setLocation("/ordenes-servicio/nuevo")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" /> Nueva Orden
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusSummary label="Abiertos" count={(statusCounts.abierto || 0).toString()} color="slate" />
        <StatusSummary label="En progreso" count={(statusCounts.en_progreso || 0).toString()} color="blue" />
        <StatusSummary label="Completados" count={(statusCounts.completado || 0).toString()} color="amber" />
        <StatusSummary label="Firmados/Cerrados" count={((statusCounts.firmado || 0) + (statusCounts.cerrado || 0)).toString()} color="emerald" />
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por OS, TAG o Técnico..." 
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
           <select
             aria-label="Filtrar órdenes por estado"
             value={statusFilter}
             onChange={(event) => setStatusFilter(event.target.value)}
             className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none min-w-[120px]"
           >
              <option value="todos">Cualquier Estado</option>
              <option value="abierto">Abierto</option>
              <option value="en_progreso">En progreso</option>
              <option value="completado">Completado</option>
              <option value="firmado">Firmado</option>
              <option value="cerrado">Cerrado</option>
           </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 italic">
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">OS / Fecha</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Equipo TAG</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo Servicio</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(os => (
              <tr key={os.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="text-xs font-black text-slate-900">{os.id}</div>
                  <div className="text-[10px] font-bold text-slate-400">{os.fecha}</div>
                </td>
                <td className="px-6 py-4">
                   <div className="text-xs font-black text-blue-600">{os.tag}</div>
                   <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight line-clamp-1">{os.equipoNombre}</div>
                </td>
                <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">{os.tipoServicio}</td>
                <td className="px-6 py-4">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${
                    os.estado === 'firmado' ? 'bg-emerald-100 text-emerald-600' : 
                    os.estado === 'completado' ? 'bg-blue-100 text-blue-600' :
                    os.estado === 'en_progreso' ? 'bg-amber-100 text-amber-600' :
                    os.estado === 'cerrado' ? 'bg-slate-200 text-slate-600' : 
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {os.estado === 'firmado' && <CheckCircle2 className="w-2.5 h-2.5" />}
                    {os.estado}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                   <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/ordenes-servicio/${os.id}`}>
                        <button
                          aria-label={`Ver orden ${os.id}`}
                          className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusSummary({ label, count, color }: { label: string, count: string, color: string }) {
  const colors: Record<string, string> = {
    slate: "text-slate-400",
    blue: "text-blue-500",
    emerald: "text-emerald-500",
    amber: "text-amber-500"
  };
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-1 text-left">
       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
       <div className={`text-2xl font-black ${colors[color]}`}>{count}</div>
    </div>
  );
}
