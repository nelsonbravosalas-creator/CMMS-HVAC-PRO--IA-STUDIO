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
import { reportsRepo } from "../repositories/ReportRepository";
import { confirmAction } from "../lib/confirmAction";

export default function InformesHVAC() {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [, setLocation] = useLocation();
  const rawReports = useLiveQuery(() => db.reports.toArray(), []) || [];
  const activeClientUid = localStorage.getItem("active_client") || "";

  const getReportStatus = (inf: any) => inf.data?.estado || inf.data?.status || "borrador";
  const visibleReports = rawReports.filter(inf => {
    if (inf.sync_status === 'pending_delete') return false;
    const reportClient = inf.data?.generalData?.cliente || (inf as any).cliente_id;
    return !!activeClientUid && reportClient === activeClientUid;
  });
  const statusCounts = visibleReports.reduce((acc, inf) => {
    const status = getReportStatus(inf);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleCreateInforme = async () => {
    const draftsCount = visibleReports.filter(inf => getReportStatus(inf) === 'borrador').length;

    if (draftsCount >= 5) {
      alert(`No puedes tener más de 5 informes en estado de borrador. Actualmente hay ${draftsCount}.`);
      return;
    }

    const newUuid = crypto.randomUUID();
    const shortId = `INF-PENDIENTE-${newUuid.substring(0, 6).toUpperCase()}`;

    // Create draft in Dexie DB so it appears in the list immediately
    await db.reports.put({
      uuid_sync: newUuid,
      id: shortId,
      updated_at: Date.now(),
      version: 1,
      sync_status: 'pending_insert',
      data: {
        estado: 'borrador',
        status: 'borrador',
        generalData: {
          cliente: activeClientUid,
          sucursal: '',
          region: '',
          direccion: '',
          fecha: new Date().toISOString().split('T')[0],
          tecnico: 'Nelson Bravo',
          tipoServicio: 'Preventivo',
          folio: shortId
        },
        machineData: {
          tipo: '',
          tag: '',
          marca: '',
          modelo: '',
          serie: '',
          refrigerante: '',
          capacidad: '',
          voltaje: ''
        },
        circuits: [],
        checklist: {},
        observaciones: '',
        galeria: []
      }
    });

    setLocation(`/informes/${newUuid}`);
  };

  const handleDeleteInforme = async (uuidSync: string) => {
    if (!await confirmAction("¿Eliminar este informe? Se marcará como eliminado y se sincronizará el cambio.", {
      title: "Eliminar informe",
      confirmLabel: "Eliminar"
    })) {
      return;
    }

    await reportsRepo.delete(uuidSync);
  };

  const filtered = visibleReports.filter(inf => {
    const data = inf.data || {};
    const estado = getReportStatus(inf);
    if (statusFilter !== "todos" && estado !== statusFilter) {
      return false;
    }
    const tg = String(data.generalData?.equipoTag || data.machineData?.tag || data.equipo_tag || "");
    const tec = String(data.generalData?.tecnico || "");
    const idStr = String(inf.id || "");
    const filterLower = (filter || "").toLowerCase();
    // filter logic
    return tg.toLowerCase().includes(filterLower) ||
           tec.toLowerCase().includes(filterLower) ||
           idStr.toLowerCase().includes(filterLower);
  }).map(inf => ({
    uuid_sync: inf.uuid_sync,
    id: inf.id,
    fecha: inf.data?.generalData?.fecha || new Date(inf.updated_at || Date.now()).toISOString().split('T')[0],
    tag: inf.data?.generalData?.equipoTag || inf.data?.machineData?.tag || inf.data?.equipo_tag || "S/T",
    equipoNombre: inf.data?.generalData?.descripcionEquipo || inf.data?.machineData?.tipo || "Equipo sin descripción",
    tipoServicio: inf.data?.generalData?.tipoServicio || inf.data?.generalData?.tipoMantenimiento || "Preventivo",
    tecnico: inf.data?.generalData?.tecnico || "No Asignado",
    estado: inf.data?.estado || inf.data?.status || "borrador"
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
          <button
            onClick={() => setLocation("/scanner")}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all"
          >
            <ScanLine className="w-4 h-4" /> Escanear QR
          </button>
          <button 
            onClick={handleCreateInforme}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" /> Crear Informe
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatusSummary
          label="Todos"
          count={visibleReports.length.toString()}
          color="slate"
          active={statusFilter === "todos"}
          onClick={() => setStatusFilter("todos")}
        />
        <StatusSummary
          label="Borradores"
          count={(statusCounts.borrador || 0).toString()}
          color="slate"
          active={statusFilter === "borrador"}
          onClick={() => setStatusFilter(statusFilter === "borrador" ? "todos" : "borrador")}
        />
        <StatusSummary
          label="Enviados"
          count={(statusCounts.enviado || 0).toString()}
          color="blue"
          active={statusFilter === "enviado"}
          onClick={() => setStatusFilter(statusFilter === "enviado" ? "todos" : "enviado")}
        />
        <StatusSummary
          label="Firmados"
          count={(statusCounts.firmado || 0).toString()}
          color="emerald"
          active={statusFilter === "firmado"}
          onClick={() => setStatusFilter(statusFilter === "firmado" ? "todos" : "firmado")}
        />
        <StatusSummary
          label="Bloqueados"
          count={(statusCounts.bloqueado || 0).toString()}
          color="amber"
          active={statusFilter === "bloqueado"}
          onClick={() => setStatusFilter(statusFilter === "bloqueado" ? "todos" : "bloqueado")}
        />
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
           <select
             value={statusFilter}
             onChange={(event) => setStatusFilter(event.target.value)}
             className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none min-w-[120px]"
           >
              <option value="todos">Cualquier Estado</option>
              <option value="borrador">Borrador</option>
              <option value="enviado">Enviado</option>
              <option value="firmado">Firmado</option>
              <option value="bloqueado">Bloqueado</option>
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
              <tr key={inf.uuid_sync} className="hover:bg-slate-50/50 transition-colors group">
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
                      <Link href={`/informes/${inf.uuid_sync}`}>
                        <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 shadow-sm"><Eye className="w-3.5 h-3.5" /></button>
                      </Link>
                      <Link href={`/informes/${inf.uuid_sync}`}>
                        <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm"><FileDown className="w-3.5 h-3.5" /></button>
                      </Link>
                      <button onClick={() => handleDeleteInforme(inf.uuid_sync)} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>
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

function StatusSummary({
  label,
  count,
  color,
  active,
  onClick
}: {
  label: string;
  count: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const colors: Record<string, string> = {
    slate: "text-slate-400",
    blue: "text-blue-500",
    emerald: "text-emerald-500",
    amber: "text-amber-500"
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col gap-1 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
        active ? "border-blue-500 ring-2 ring-blue-500/10" : "border-slate-200"
      }`}
      aria-pressed={active}
    >
       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
       <div className={`text-2xl font-black ${colors[color]}`}>{count}</div>
    </button>
  );
}
