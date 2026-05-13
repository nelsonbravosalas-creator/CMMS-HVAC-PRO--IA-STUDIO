import React, { useState, useMemo, useEffect } from "react";
import { 
  Ticket as TicketIcon, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Play, 
  Check, 
  X,
  User,
  Tag as TagIcon,
  AlertTriangle,
  Image as ImageIcon,
  MessageSquare,
  Download,
  Cloud
} from "lucide-react";
import { TicketForm } from "../components/modals/TicketForm";
import { FilterPresetsDropdown } from "../components/modals/FilterPresetsDropdown";
import { useAuth } from "../context/AuthContext";
import { useAppStore } from "../store/useAppStore";
import { useTickets } from "../hooks/useTickets";

export default function Tickets() {
  const { permisos } = useAuth();
  const tickets = useAppStore(state => state.tickets);
  const loading = useAppStore(state => state.isLoading);
  const { updateTicket } = useTickets();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("");

  if (!permisos?.ver_dashboard) return <div className="p-20 text-center text-slate-400 font-black uppercase italic">Acceso Denegado</div>;

  const filtered = useMemo(() => tickets.filter(t => 
    t.titulo.toLowerCase().includes(filter.toLowerCase()) ||
    t.equipo_tag.toLowerCase().includes(filter.toLowerCase()) ||
    t.id.toLowerCase().includes(filter.toLowerCase())
  ), [tickets, filter]);

  if (loading && tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 animate-pulse">
        <Clock className="w-12 h-12 text-slate-200 mb-4 animate-spin-slow" />
        <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Sincronizando Historial de Tickets...</p>
      </div>
    );
  }

  const exportToCSV = () => {
    const headers = ["ID", "TAG", "Título", "Estado", "Prioridad", "Fecha", "Creador", "Asignado", "Sync"];
    const rows = filtered.map(t => [
      t.id,
      t.equipo_tag,
      t.titulo,
      t.estado,
      t.prioridad,
      t.fecha_creacion,
      t.creado_por,
      t.asignado_a,
      t.sync_status
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tickets_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statuses = [
    { id: 'abierto', label: 'Abiertos', color: 'bg-red-500', bg: 'bg-red-50' },
    { id: 'en_proceso', label: 'En Proceso', color: 'bg-amber-500', bg: 'bg-amber-50' },
    { id: 'resuelto', label: 'Resueltos', color: 'bg-emerald-500', bg: 'bg-emerald-50' },
    { id: 'cerrado', label: 'Cerrados', color: 'bg-slate-500', bg: 'bg-slate-50' }
  ];

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Centro de Tickets</h2>
          <p className="text-slate-500 text-sm font-medium">Gestión de incidencias y solicitudes técnicas.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          {permisos?.crear_ticket && (
            <button 
              onClick={() => setShowModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-red-600/20"
            >
              <Plus className="w-4 h-4" /> Nuevo Ticket
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex-1 relative">
           <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
           <input 
             type="text" 
             placeholder="Buscar por Título o TAG..." 
             className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 shadow-sm"
             value={filter}
             onChange={(e) => setFilter(e.target.value)}
           />
        </div>
        <div className="flex items-center gap-2 col-span-3">
           <FilterPresetsDropdown onApply={() => {}} />
           {statuses.map(s => (
             <button key={s.id} className={`${s.bg} border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-white transition-all flex items-center gap-2`}>
                <div className={`w-2 h-2 rounded-full ${s.color}`}></div>
                {s.label}
             </button>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center gap-4">
             <TicketIcon className="w-16 h-16 text-slate-100" />
             <div className="text-center">
                <h3 className="text-sm font-black text-slate-900 uppercase">Sin Actividad</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No hay tickets que coincidan con la búsqueda</p>
             </div>
             {permisos?.crear_ticket && <button onClick={() => setShowModal(true)} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Crear primer ticket</button>}
          </div>
        ) : (
          filtered.map(t => (
            <TicketCard key={t.uuid_sincro} ticket={t} />
          ))
        )}
      </div>

      {showModal && <TicketForm onClose={() => setShowModal(false)} />}
    </div>
  );
}

const SyncIndicator: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'synced') return <Cloud className="w-4 h-4 text-emerald-500" />;
  return <Cloud className="w-4 h-4 text-amber-500 animate-pulse" />;
};

const TicketCard: React.FC<{ ticket: any }> = ({ ticket }) => {
  const { updateTicket } = useTickets();
  const priorities: Record<string, string> = {
    Alta: "bg-orange-100 text-orange-600",
    Critica: "bg-red-100 text-red-600",
    Media: "bg-blue-100 text-blue-600",
    Baja: "bg-slate-100 text-slate-600",
    alta: "bg-orange-100 text-orange-600",
    critica: "bg-red-100 text-red-600",
    media: "bg-blue-100 text-blue-600",
    baja: "bg-slate-100 text-slate-600"
  };

  return (
    <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm hover:shadow-2xl transition-all group flex flex-col gap-6 relative overflow-hidden">
       <div className="flex justify-between items-start">
          <div className={`p-2.5 rounded-2xl ${priorities[ticket.prioridad] || "bg-slate-100 text-slate-600"}`}>
             <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <SyncIndicator status={ticket.sync_status} />
            <button className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><MoreVertical className="w-4 h-4" /></button>
          </div>
       </div>

       <div>
          <div className="flex items-center gap-2 mb-1">
             <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{ticket.id}</span>
             <div className="w-1 h-1 rounded-full bg-slate-300"></div>
             <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">{ticket.equipo_tag}</span>
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-1">{ticket.titulo}</h3>
          <p className="text-[10px] font-medium text-slate-500 mt-2 line-clamp-2">{ticket.descripcion}</p>
       </div>

       <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
          <div className="flex -space-x-2">
             <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-600">NB</div>
             <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-blue-600">GB</div>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400">
             <MessageSquare className="w-3 h-3" /> 4 Notas
          </div>
       </div>

       <div className="flex items-center gap-2">
          {ticket.estado === 'abierto' && (
            <button 
              onClick={() => updateTicket(ticket.uuid_sincro, { estado: 'en_proceso' })}
              className="flex-1 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all font-black"
            >
               <Play className="w-3.5 h-3.5 fill-current" /> Iniciar
            </button>
          )}
          {(ticket.estado === 'abierto' || ticket.estado === 'en_proceso') && (
            <button 
              onClick={() => updateTicket(ticket.uuid_sincro, { estado: 'resuelto' })}
              className="flex-1 py-3 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all font-black"
            >
               <Check className="w-3.5 h-3.5" /> Resolver
            </button>
          )}
          {ticket.estado === 'resuelto' && (
            <button 
              onClick={() => updateTicket(ticket.uuid_sincro, { estado: 'cerrado' })}
              className="w-full py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-2xl font-black"
            >
               Cerrar Ticket
            </button>
          )}
       </div>
    </div>
  );
}
