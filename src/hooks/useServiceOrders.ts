import { useAppStore } from '../store/useAppStore';
import { db, LocalOrdenServicio } from '../db/database';
import { serviceOrderRepo } from '../repositories/ServiceOrderRepository';
import { syncEngine } from '../sync/syncEngine';

export const useServiceOrders = () => {
  const serviceOrders = useAppStore(state => state.ordenes_servicio);
  const addServiceOrder = useAppStore(state => state.addServiceOrder);
  const updateServiceOrderInStore = useAppStore(state => state.updateServiceOrder);
  const deleteServiceOrderFromStore = useAppStore(state => state.deleteServiceOrder);

  const saveDraft = async (data: Partial<LocalOrdenServicio> & { id: string; data: any }) => {
    const now = Date.now();
    const draft = {
      ...data,
      uuid_sync: data.uuid_sync || data.id || crypto.randomUUID(),
      updated_at: now,
      version: data.version || 1,
      retry_count: data.retry_count || 0,
      sync_status: 'synced' as const,
      data: { ...data.data, status: data.data?.status || 'borrador' }
    } as LocalOrdenServicio;
    await db.ordenes_servicio.put(draft);
    if (serviceOrders.some(os => os.uuid_sync === draft.uuid_sync)) updateServiceOrderInStore(draft);
    else addServiceOrder(draft);
    return draft;
  };


  const finalizeServiceOrder = async (data: Partial<LocalOrdenServicio> & { id: string; data: any }) => {
    const saved = await serviceOrderRepo.save({
      ...data,
      uuid_sync: data.uuid_sync || data.id || crypto.randomUUID(),
      data: { ...data.data, status: data.data?.status || 'firmada' }
    } as LocalOrdenServicio);
    if (serviceOrders.some(os => os.uuid_sync === saved.uuid_sync)) updateServiceOrderInStore(saved);
    else addServiceOrder(saved);
    syncEngine.triggerSync();
    return saved;
  };

  const deleteServiceOrder = async (uuid: string) => {
    await serviceOrderRepo.delete(uuid);
    deleteServiceOrderFromStore(uuid);
    syncEngine.triggerSync();
  };

  return { serviceOrders, saveDraft, finalizeServiceOrder, deleteServiceOrder, syncNow: () => syncEngine.triggerSync() };
};
