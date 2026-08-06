import type { LocalInforme, LocalOrdenServicio } from '../db/database';

export type ReportLifecycleState = 'borrador' | 'finalizado';

export function getReportState(report: Pick<LocalInforme, 'data'>): ReportLifecycleState {
  const raw = String(report.data?.estado || report.data?.status || 'borrador').toLowerCase();
  return raw === 'finalizado' || raw === 'firmado' || raw === 'bloqueado'
    ? 'finalizado'
    : 'borrador';
}

export function isOrderClosed(order: Pick<LocalOrdenServicio, 'estado'>) {
  return order.estado === 'cerrado' || order.estado === 'firmado';
}

export function canCloseOrder(reports: Array<Pick<LocalInforme, 'data'>>) {
  return reports.length === 0 || reports.every(report => getReportState(report) === 'finalizado');
}

export function canMoveReport(
  source: Pick<LocalOrdenServicio, 'estado' | 'cliente_id' | 'sucursal_id'>,
  target: Pick<LocalOrdenServicio, 'estado' | 'cliente_id' | 'sucursal_id'>
) {
  return !isOrderClosed(source)
    && !isOrderClosed(target)
    && source.cliente_id === target.cliente_id
    && source.sucursal_id === target.sucursal_id;
}

