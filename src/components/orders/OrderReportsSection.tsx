import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { CheckCircle2, Download, Eye, FilePlus2, FileText, MoveRight, RotateCcw, Trash2 } from 'lucide-react';
import { db, type LocalOrdenServicio } from '../../db/database';
import { reportsRepo } from '../../repositories/ReportRepository';
import { useAuth } from '../../context/AuthContext';
import { canMoveReport, getReportState, isOrderClosed } from '../../rules/orderReportRules';
import { confirmAction } from '../../lib/confirmAction';

interface Props {
  orderUuid: string;
  clienteId: string;
  sucursalId: string;
  orderState: LocalOrdenServicio['estado'];
  ensureOrderSaved: () => Promise<LocalOrdenServicio>;
}

export default function OrderReportsSection({
  orderUuid,
  clienteId,
  sucursalId,
  orderState,
  ensureOrderSaved
}: Props) {
  const [, setLocation] = useLocation();
  const { user, permisos } = useAuth();
  const [movingReportId, setMovingReportId] = useState<string | null>(null);
  const [targetOrderUuid, setTargetOrderUuid] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = user?.perfil === 'administrador';
  const closed = orderState === 'cerrado' || orderState === 'firmado';

  const reports = useLiveQuery(
    () => db.reports
      .where('[cliente_id+orden_servicio_uuid]')
      .equals([clienteId, orderUuid])
      .filter(report => !report.deleted_at && report.sync_status !== 'pending_delete')
      .sortBy('updated_at'),
    [clienteId, orderUuid]
  ) || [];

  const candidateOrders = useLiveQuery(
    () => db.ordenes_servicio
      .filter(order => order.uuid_sync !== orderUuid
        && !order.deleted_at
        && order.cliente_id === clienteId
        && order.sucursal_id === sucursalId
        && !isOrderClosed(order))
      .toArray(),
    [orderUuid, clienteId, sucursalId]
  ) || [];

  const createReport = async () => {
    if (!permisos?.crear_informe || closed) return;
    setBusy(true);
    try {
      await ensureOrderSaved();
      const reportUuid = crypto.randomUUID();
      await reportsRepo.create({
        uuid_sync: reportUuid,
        id: `INF-PENDIENTE-${reportUuid.slice(0, 6).toUpperCase()}`,
        cliente_id: clienteId,
        sucursal_id: sucursalId,
        orden_servicio_uuid: orderUuid,
        creado_por: user?.id,
        data: {
          estado: 'borrador',
          generalData: {
            cliente: clienteId,
            sucursal: sucursalId,
            region: '',
            direccion: '',
            fecha: new Date().toISOString().split('T')[0],
            tecnico: user?.nombre || '',
            nombreCliente: '',
            tipoServicio: 'Preventivo',
            folio: ''
          },
          machineData: {
            tipo: '', tag: '', marca: '', modelo: '', serie: '',
            refrigerante: '', capacidad: '', voltaje: ''
          },
          circuits: [{
            numCompressors: 1,
            pb: '', pa: '', te: '', tc: '', tsub: '', tsob: '',
            compressors: [{ rla: '', r: '', s: '', t: '' }]
          }],
          checklist: {},
          observaciones: '',
          galeria: []
        }
      } as any);
      setLocation(`/ordenes-servicio/${orderUuid}/informes/${reportUuid}`);
    } catch (error: any) {
      alert(error?.message || 'No fue posible crear el informe.');
    } finally {
      setBusy(false);
    }
  };

  const deleteDraft = async (report: any) => {
    const canDelete = getReportState(report) === 'borrador'
      && !closed
      && (isAdmin || !report.creado_por || report.creado_por === user?.id);
    if (!canDelete) return;
    if (!await confirmAction(`¿Eliminar el borrador ${report.id}?`, {
      title: 'Eliminar informe',
      confirmLabel: 'Eliminar',
      tone: 'danger'
    })) return;
    await reportsRepo.delete(report.uuid_sync);
  };

  const returnToDraft = async (report: any) => {
    if (!isAdmin || closed || getReportState(report) !== 'finalizado') return;
    await reportsRepo.update(report.uuid_sync, {
      data: { ...report.data, estado: 'borrador', status: 'borrador' }
    });
  };

  const moveReport = async (report: any) => {
    const target = candidateOrders.find(order => order.uuid_sync === targetOrderUuid);
    const source = await db.ordenes_servicio.get(orderUuid);
    if (!isAdmin || !source || !target || !canMoveReport(source, target)) return;
    await reportsRepo.update(report.uuid_sync, {
      orden_servicio_uuid: target.uuid_sync,
      sucursal_id: target.sucursal_id || sucursalId
    });
    setMovingReportId(null);
    setTargetOrderUuid('');
  };

  const finalizedCount = reports.filter(report => getReportState(report) === 'finalizado').length;
  const draftCount = reports.length - finalizedCount;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Summary label="Total" value={reports.length} />
        <Summary label="Borradores" value={draftCount} tone="amber" />
        <Summary label="Finalizados" value={finalizedCount} tone="emerald" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Informes de la orden</h3>
          <p className="text-xs text-slate-500 mt-1">Cada informe corresponde a un equipo de esta sucursal.</p>
        </div>
        {!closed && permisos?.crear_informe && (
          <button
            type="button"
            disabled={busy || !clienteId || !sucursalId}
            onClick={createReport}
            className="px-4 py-3 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <FilePlus2 className="w-4 h-4" /> {busy ? 'Guardando orden…' : 'Nuevo informe'}
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
          <FileText className="w-9 h-9 text-slate-300 mx-auto mb-3" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Orden sin informes</p>
          <p className="text-xs text-slate-400 mt-2">Puede cerrarse como visita a terreno sin inspección.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...reports].reverse().map((report, index) => {
            const state = getReportState(report);
            const general = report.data?.generalData || {};
            const machine = report.data?.machineData || {};
            const canDelete = state === 'borrador'
              && !closed
              && (isAdmin || !report.creado_por || report.creado_por === user?.id);
            return (
              <div key={report.uuid_sync} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 flex-1">
                    <Info label={`Informe ${reports.length - index}`} value={general.folio || report.id} />
                    <Info label="Equipo / TAG" value={machine.tag || 'Pendiente de selección'} />
                    <Info label="Tipo" value={general.tipoServicio || 'Sin definir'} />
                    <Info label="Técnico" value={general.tecnico || 'Sin asignar'} />
                    <Info label="Fecha" value={general.fecha || 'Sin fecha'} />
                    <Info
                      label="Hallazgos críticos"
                      value={Object.values(report.data?.checklist || {}).filter((item: any) => item?.status === 'falla').length.toString()}
                    />
                    <Info
                      label="Firmas"
                      value={report.data?.firmas?.tecnico || report.data?.firmas?.cliente ? 'Registradas' : 'Sin firmas'}
                    />
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Estado</span>
                      <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                        state === 'finalizado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {state === 'finalizado' && <CheckCircle2 className="w-3 h-3" />}{state}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLocation(`/ordenes-servicio/${orderUuid}/informes/${report.uuid_sync}`)}
                      className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:text-blue-600"
                      aria-label={`Abrir informe ${report.id}`}
                    ><Eye className="w-4 h-4" /></button>
                    <button
                      type="button"
                      onClick={() => setLocation(`/ordenes-servicio/${orderUuid}/informes/${report.uuid_sync}?pdf=1`)}
                      className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:text-blue-600"
                      aria-label={`Descargar PDF del informe ${report.id}`}
                      title="Descargar PDF"
                    ><Download className="w-4 h-4" /></button>
                    {isAdmin && !closed && state === 'finalizado' && (
                      <button type="button" onClick={() => returnToDraft(report)} className="p-2.5 rounded-xl bg-amber-50 text-amber-700" title="Devolver a borrador"><RotateCcw className="w-4 h-4" /></button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => deleteDraft(report)} className="p-2.5 rounded-xl bg-rose-50 text-rose-600" title="Eliminar borrador"><Trash2 className="w-4 h-4" /></button>
                    )}
                    {isAdmin && !closed && candidateOrders.length > 0 && (
                      <button type="button" onClick={() => setMovingReportId(movingReportId === report.uuid_sync ? null : report.uuid_sync)} className="p-2.5 rounded-xl bg-blue-50 text-blue-600" title="Trasladar informe"><MoveRight className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
                {movingReportId === report.uuid_sync && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    <select value={targetOrderUuid} onChange={event => setTargetOrderUuid(event.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">
                      <option value="">Seleccione una orden abierta de la misma sucursal…</option>
                      {candidateOrders.map(order => <option key={order.uuid_sync} value={order.uuid_sync}>{order.id}</option>)}
                    </select>
                    <button type="button" disabled={!targetOrderUuid} onClick={() => moveReport(report)} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50">Confirmar traslado</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Summary({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'amber' | 'emerald' }) {
  const colors = { slate: 'text-slate-900', amber: 'text-amber-600', emerald: 'text-emerald-600' };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</div><div className={`text-2xl font-black ${colors[tone]}`}>{value}</div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</div><div className="mt-1 truncate text-xs font-bold text-slate-700" title={value}>{value}</div></div>;
}
