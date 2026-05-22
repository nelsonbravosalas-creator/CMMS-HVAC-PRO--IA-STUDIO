import React, { useState } from "react";
import { 
  FileText, 
  FileDown, 
  Eye, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Send, 
  Lock, 
  CheckCircle2,
  ScanLine,
  ChevronRight,
  MoreVertical,
  Download
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { ReportBulkUploadModal } from "../components/modals/ReportBulkUploadModal";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";

export default function InformesHVAC() {
  const [filter, setFilter] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [, setLocation] = useLocation();

  const rawReports = useLiveQuery(() => db.reports.toArray(), []) || [];
  const activeClientUid = localStorage.getItem("active_client");

  const filtered = rawReports.filter(inf => {
    const data = inf.data || {};
    if (activeClientUid && data.generalData?.cliente !== activeClientUid) {
      return false;
    }
    const tg = data.generalData?.equipoTag || "";
    const tec = data.generalData?.tecnico || "";
    // filter logic
    return tg.toLowerCase().includes(filter.toLowerCase()) ||
           tec.toLowerCase().includes(filter.toLowerCase()) ||
           inf.id.toLowerCase().includes(filter.toLowerCase());
  }).map(inf => ({
    id: inf.id,
    fecha: inf.data?.generalData?.fecha || new Date(inf.updated_at || Date.now()).toISOString().split('T')[0],
    tag: inf.data?.generalData?.equipoTag || "S/T",
    equipoNombre: inf.data?.generalData?.descripcionEquipo || "Equipo sin descripción",
    tipoServicio: inf.data?.generalData?.tipoMantenimiento || "Preventivo",
    tecnico: inf.data?.generalData?.tecnico || "No Asignado",
    estado: (inf as any).estado || (inf.data?.status || "borrador")
  }));

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Gestión de Informes</h2>
          <p className="text-slate-500 text-sm font-medium">Informes técnicos, protocolos de firma y entregables.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowBulkUpload(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" /> Carga Masiva
          </button>
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all">
            <ScanLine className="w-4 h-4" /> Escanear QR
          </button>
          <button 
            onClick={() => setLocation("/informes/nuevo")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" /> Crear Informe
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusSummary label="Borradores" count={filtered.filter(i => i.estado === 'borrador').length.toString()} color="slate" />
        <StatusSummary label="Enviados" count={filtered.filter(i => i.estado === 'enviado').length.toString()} color="blue" />
        <StatusSummary label="Firmados" count={filtered.filter(i => i.estado === 'firmado').length.toString()} color="emerald" />
        <StatusSummary label="Bloqueados" count={filtered.filter(i => i.estado === 'bloqueado').length.toString()} color="amber" />
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por Informe, TAG o Técnico..." 
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
           <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none min-w-[120px]">
              <option>Cualquier Estado</option>
              <option>Borrador</option>
              <option>Firmado</option>
           </select>
           <button className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"><Filter className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 italic">
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Informe / Fecha</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Equipo TAG</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Servicio</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(inf => (
              <tr key={inf.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="text-xs font-black text-slate-900">{inf.id}</div>
                  <div className="text-[10px] font-bold text-slate-400">{inf.fecha}</div>
                </td>
                <td className="px-6 py-4">
                   <div className="text-xs font-black text-blue-600">{inf.tag}</div>
                   <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight line-clamp-1">{inf.equipoNombre}</div>
                </td>
                <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">{inf.tipoServicio}</td>
                <td className="px-6 py-4">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${
                    inf.estado === 'firmado' ? 'bg-emerald-100 text-emerald-600' : 
                    inf.estado === 'enviado' ? 'bg-blue-100 text-blue-600' : 
                    inf.estado === 'en revision' ? 'bg-amber-100 text-amber-600' : 
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {inf.estado === 'firmado' && <CheckCircle2 className="w-2.5 h-2.5" />}
                    {inf.estado === 'en revision' && <Lock className="w-2.5 h-2.5" />}
                    {inf.estado}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                   <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/informes/${inf.id}`}>
                        <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 shadow-sm"><Eye className="w-3.5 h-3.5" /></button>
                      </Link>
                      <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm"><FileDown className="w-3.5 h-3.5" /></button>
                      <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {showBulkUpload && (
        <ReportBulkUploadModal onClose={() => setShowBulkUpload(false)} />
      )}
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
