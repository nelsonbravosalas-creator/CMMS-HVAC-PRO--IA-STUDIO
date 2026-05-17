import { useAppStore } from '../store/useAppStore';
import { db, LocalInforme } from '../db/database';
import { reportRepo } from '../repositories/ReportRepository';
import { syncEngine } from '../sync/syncEngine';

export const useReports = () => {
  const reports = useAppStore(state => state.reports);
  const addReport = useAppStore(state => state.addReport);
  const updateReportInStore = useAppStore(state => state.updateReport);
  const deleteReportFromStore = useAppStore(state => state.deleteReport);

  const saveDraft = async (data: Partial<LocalInforme> & { id: string; data: any }) => {
    const now = Date.now();
    const draft = {
      ...data,
      uuid_sync: data.uuid_sync || data.id || crypto.randomUUID(),
      updated_at: now,
      version: data.version || 1,
      retry_count: data.retry_count || 0,
      sync_status: 'synced' as const,
      data: { ...data.data, status: data.data?.status || 'draft' }
    } as LocalInforme;
    await db.reports.put(draft);
    if (reports.some(r => r.uuid_sync === draft.uuid_sync)) updateReportInStore(draft);
    else addReport(draft);
    return draft;
  };


  const finalizeReport = async (data: Partial<LocalInforme> & { id: string; data: any }) => {
    const saved = await reportRepo.save({
      ...data,
      uuid_sync: data.uuid_sync || data.id || crypto.randomUUID(),
      data: { ...data.data, status: data.data?.status || 'firmado' }
    } as LocalInforme);
    if (reports.some(r => r.uuid_sync === saved.uuid_sync)) updateReportInStore(saved);
    else addReport(saved);
    syncEngine.triggerSync();
    return saved;
  };

  const deleteReport = async (uuid: string) => {
    await reportRepo.delete(uuid);
    deleteReportFromStore(uuid);
    syncEngine.triggerSync();
  };

  return { reports, saveDraft, finalizeReport, deleteReport, syncNow: () => syncEngine.triggerSync() };
};
