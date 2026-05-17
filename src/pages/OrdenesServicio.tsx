import React, { useState } from "react";
import { FileText, Eye, Plus, Search, Filter, CheckCircle2, ScanLine, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useServiceOrders } from "../hooks/useServiceOrders";
import { StatusIndicator } from "../components/StatusIndicator";

export default function OrdenesServicio() {
  const [filter, setFilter] = useState("");
  const [, setLocation] = useLocation();
  const { serviceOrders, deleteServiceOrder } = useServiceOrders();

  const normalized = serviceOrders.map(os => ({ uuid_sync: os.uuid_sync, id: os.id, sync_status: os.sync_status, ...os.data }));
  const filtered = normalized.filter(os => `${os.id || ''} ${os.generalData?.tag || ''} ${os.generalData?.tecnico || ''} ${os.tag || ''}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Órdenes de Servicio</h2><p className="text-slate-500 text-sm font-medium">Órdenes de servicio offline-first sincronizadas con Neon.</p></div>
        <div className="flex items-center gap-3"><button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2"><ScanLine className="w-4 h-4" /> Escanear QR</button><button onClick={() => setLocation("/ordenes-servicio/nuevo")} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/20"><Plus className="w-4 h-4" /> Nueva Orden</button></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><StatusSummary label="Borradores" count={normalized.filter(o => o.status === 'borrador').length.toString()} color="slate" /><StatusSummary label="Encoladas" count={normalized.filter(o => o.sync_status !== 'synced').length.toString()} color="blue" /><StatusSummary label="Firmadas" count={normalized.filter(o => o.status === 'firmada').length.toString()} color="emerald" /><StatusSummary label="Total" count={normalized.length.toString()} color="amber" /></div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4"><div className="flex-1 relative"><Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Buscar por OS, TAG o Técnico..." className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none" value={filter} onChange={(e) => setFilter(e.target.value)} /></div><button className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"><Filter className="w-4 h-4" /></button></div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"><table className="w-full text-left border-collapse"><thead><tr className="bg-slate-50/50 border-b border-slate-100 italic"><th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">OS / Fecha</th><th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Equipo TAG</th><th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo Servicio</th><th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th><th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-50">
        {filtered.map(os => <tr key={os.uuid_sync} className="hover:bg-slate-50/50 transition-colors group"><td className="px-6 py-4"><div className="text-xs font-black text-slate-900">{os.id}</div><div className="text-[10px] font-bold text-slate-400">{os.fecha || os.generalData?.fecha}</div></td><td className="px-6 py-4"><div className="text-xs font-black text-blue-600">{os.tag || os.generalData?.tag || os.generalData?.descripcionEquipo}</div><div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight line-clamp-1">{os.equipoNombre || os.generalData?.descripcionEquipo}</div></td><td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">{os.tipoServicio || os.generalData?.tipoServicio}</td><td className="px-6 py-4"><span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 w-fit bg-slate-100 text-slate-600">{os.status || os.estado}<StatusIndicator status={os.sync_status} /></span></td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-1"><Link href={`/ordenes-servicio/${os.id}`}><button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600"><Eye className="w-3.5 h-3.5" /></button></Link><button onClick={() => confirm('¿Anular orden de servicio?') && deleteServiceOrder(os.uuid_sync)} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div></td></tr>)}
        {filtered.length === 0 && <tr><td colSpan={5} className="p-20 text-center text-slate-400 italic text-xs font-bold uppercase">No hay órdenes de servicio locales sincronizables</td></tr>}
      </tbody></table></div>
    </div>
  );
}

function StatusSummary({ label, count, color }: { label: string; count: string; color: string }) {
  const colors: Record<string, string> = { slate: "bg-slate-50 text-slate-600", blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600" };
  return <div className={`p-5 rounded-3xl border border-slate-200 ${colors[color]} flex items-center justify-between`}><div><div className="text-2xl font-black">{count}</div><div className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</div></div><CheckCircle2 className="w-6 h-6 opacity-20" /></div>;
}
