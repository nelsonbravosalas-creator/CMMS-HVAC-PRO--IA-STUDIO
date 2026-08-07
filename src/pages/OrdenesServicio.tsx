import React, { useState } from "react";
import { 
  FileText, 
  Eye, 
  Plus, 
  Search, 
  CheckCircle2,
  ScanLine,
  Trash2
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { useAuth } from "../context/AuthContext";
import { useAppStore } from "../store/useAppStore";
import { serviceOrdersRepo } from "../repositories/ServiceOrderRepository";
import { syncEngine } from "../sync/syncEngine";
import { confirmAction } from "../lib/confirmAction";

export default function OrdenesServicio() {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [, setLocation] = useLocation();
  const { user, permisos } = useAuth();
  const branches = useAppStore(state => state.branches);
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
  const isAdmin = user?.perfil === 'administrador';

  const rawOrdenes = useLiveQuery(() => db.ordenes_servicio.toArray(), []) || [];
  const rawReports = useLiveQuery(() => db.reports.toArray(), []) || [];
  const activeClientUid = localStorage.getItem("active_client");

  const filtered = rawOrdenes.filter(os => {
    const data = os.data || {};
    const orderClient = os.cliente_id || data.generalData?.cliente;
    if (!activeClientUid || orderClient !== activeClientUid || os.sync_status === 'pending_delete') {
      return false;
    }
    const branch = data.generalData?.sucursal || os.sucursal_id || "";
    const tec = data.generalData?.tecnico || "";
    const idStr = os.id || "";
    const filterLower = (filter || "").toLowerCase();
    const matchesText = branch.toLowerCase().includes(filterLower) ||
      tec.toLowerCase().includes(filterLower) ||
      idStr.toLowerCase().includes(filterLower);
    const matchesStatus = statusFilter === "todos" || os.estado === statusFilter;
    return matchesText && matchesStatus;
  }).map(os => ({
    uuid: os.uuid_sync,
    id: os.id,
    fecha: os.data?.generalData?.fecha || new Date(os.updated_at || Date.now()).toISOString().split('T')[0],
    sucursal: (() => {
      const branchRef = os.data?.generalData?.sucursal || os.sucursal_id || "";
      return branches.find(branch => branch.uuid_sync === branchRef || branch.id === branchRef)?.nombre
        || branchRef
        || "Sin sucursal";
    })(),
    informes: rawReports.filter(report => report.orden_servicio_uuid === os.uuid_sync && !report.deleted_at && report.sync_status !== 'pending_delete'),
    tipoServicio: os.data?.generalData?.tipoServicio || "Preventivo",
    tecnico: os.data?.generalData?.tecnico || "No Asignado",
    estado: os.estado || "abierto"
  }));
  const statusCounts = filtered.reduce((acc, order) => {
    acc[order.estado] = (acc[order.estado] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deleteEmptyOrder = async (order: typeof filtered[number]) => {
    if (!isAdmin || order.informes.length > 0 || ['cerrado', 'firmado'].includes(order.estado)) return;
    const accepted = await confirmAction(`¿Eliminar definitivamente la orden ${order.id}?`, {
      title: 'Eliminar orden vacía',
      confirmLabel: 'Eliminar orden',
      tone: 'danger'
    });
    if (!accepted) return;

    setDeletingUuid(order.uuid);
    try {
      await serviceOrdersRepo.delete(order.uuid);
      void syncEngine.triggerSync();
    } catch (error: any) {
      alert(error?.message || 'No fue posible eliminar la orden.');
    } finally {
      setDeletingUuid(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Órdenes de Servicio</h2>
          <p className="text-slate-500 text-sm font-medium">Visitas a terreno e informes técnicos organizados por orden.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 md:flex md:w-auto md:items-center">
          <button
            onClick={() => setLocation("/scanner")}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <ScanLine className="w-4 h-4" /> Escanear QR
          </button>
          {permisos?.crear_orden_servicio && (
            <button
              onClick={() => setLocation("/ordenes-servicio/nuevo")}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Plus className="w-4 h-4" /> Nueva Orden
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatusSummary label="Abiertos" count={(statusCounts.abierto || 0).toString()} color="slate" />
        <StatusSummary label="En progreso" count={(statusCounts.en_progreso || 0).toString()} color="blue" />
        <StatusSummary label="Completados" count={(statusCounts.completado || 0).toString()} color="amber" />
        <StatusSummary label="Firmados/Cerrados" count={((statusCounts.firmado || 0) + (statusCounts.cerrado || 0)).toString()} color="emerald" />
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <label htmlFor="service-order-search" className="sr-only">Buscar órdenes de servicio</label>
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="service-order-search"
            type="text"
            aria-label="Buscar órdenes de servicio"
            placeholder="Buscar por OS, sucursal o técnico..."
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-12 pr-4 text-sm font-bold uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
           <select
             aria-label="Filtrar órdenes por estado"
             value={statusFilter}
             onChange={(event) => setStatusFilter(event.target.value)}
             className="min-h-11 w-full min-w-[120px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 md:w-auto"
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

      <div className="grid gap-3 md:hidden" aria-label="Listado de órdenes de servicio">
        {filtered.map(os => (
          <article key={os.uuid} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-all text-sm font-black text-slate-900">{os.id}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">{os.fecha}</p>
              </div>
              <OrderStatus estado={os.estado} />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
              <div className="col-span-2">
                <dt className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sucursal</dt>
                <dd className="mt-1 text-xs font-black text-blue-600">{os.sucursal}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-black uppercase tracking-widest text-slate-400">Informes</dt>
                <dd className="mt-1 text-xs font-black text-slate-700">
                  {os.informes.length} · {os.informes.filter(report => report.data?.estado === 'borrador').length} borrador(es)
                </dd>
              </div>
              <div>
                <dt className="text-[9px] font-black uppercase tracking-widest text-slate-400">Servicio</dt>
                <dd className="mt-1 text-xs font-bold uppercase text-slate-600">{os.tipoServicio}</dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-2">
              <Link href={`/ordenes-servicio/${os.uuid}`} className="flex-1">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <Eye className="h-4 w-4" /> Ver orden
                </button>
              </Link>
              {isAdmin && os.informes.length === 0 && !['cerrado', 'firmado'].includes(os.estado) && (
                <button
                  type="button"
                  disabled={deletingUuid === os.uuid}
                  onClick={() => deleteEmptyOrder(os)}
                  aria-label={`Eliminar orden vacía ${os.id}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-200 text-rose-600 transition-colors hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 italic">
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">OS / Fecha</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Sucursal</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Informes</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo Servicio</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(os => (
              <tr key={os.uuid} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="text-xs font-black text-slate-900">{os.id}</div>
                  <div className="text-[10px] font-bold text-slate-400">{os.fecha}</div>
                </td>
                <td className="px-6 py-4">
                   <div className="text-xs font-black text-blue-600">{os.sucursal}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs font-black text-slate-700">{os.informes.length}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase">{os.informes.filter(report => report.data?.estado === 'borrador').length} borrador(es)</div>
                </td>
                <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">{os.tipoServicio}</td>
                <td className="px-6 py-4">
                  <OrderStatus estado={os.estado} />
                </td>
                <td className="px-6 py-4 text-right">
                   <div className="flex justify-end gap-1">
                      <Link href={`/ordenes-servicio/${os.uuid}`}>
                        <button
                          aria-label={`Ver orden ${os.id}`}
                          title={`Ver orden ${os.id}`}
                          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-500 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          <Eye className="h-4 w-4" /> Ver
                        </button>
                      </Link>
                      {isAdmin && os.informes.length === 0 && !['cerrado', 'firmado'].includes(os.estado) && (
                        <button
                          type="button"
                          disabled={deletingUuid === os.uuid}
                          onClick={() => deleteEmptyOrder(os)}
                          aria-label={`Eliminar orden vacía ${os.id}`}
                          title="Eliminar orden vacía"
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 shadow-sm transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
    <div className="flex min-h-24 flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm md:min-h-0 md:rounded-3xl md:p-6">
       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
       <div className={`text-2xl font-black ${colors[color]}`}>{count}</div>
    </div>
  );
}

function OrderStatus({ estado }: { estado: string }) {
  return (
    <span className={`flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase ${
      estado === 'firmado' ? 'bg-emerald-100 text-emerald-700' :
      estado === 'completado' ? 'bg-blue-100 text-blue-700' :
      estado === 'en_progreso' ? 'bg-amber-100 text-amber-700' :
      estado === 'cerrado' ? 'bg-slate-200 text-slate-700' :
      'bg-slate-100 text-slate-700'
    }`}>
      {estado === 'firmado' && <CheckCircle2 className="h-3 w-3" />}
      {estado}
    </span>
  );
}
