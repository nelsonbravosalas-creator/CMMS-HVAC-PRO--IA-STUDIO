import { useAppStore } from '../store/useAppStore';
import { mantenimientosRepo } from '../repositories/PmRepository';
import { LocalMantenimiento } from '../db/database';
import { syncEngine } from '../sync/syncEngine';

export const useMantenimientos = () => {
  const addMantToStore = useAppStore(state => state.addMantenimiento);
  const updateMantInStore = useAppStore(state => state.updateMantenimiento);
  const deleteMantFromStore = useAppStore(state => state.deleteMantenimiento);

  const createMantenimiento = async (data: Partial<LocalMantenimiento>) => {
    const newMant: LocalMantenimiento = {
      ...data,
      uuid_sync: crypto.randomUUID(),
      updated_at: Date.now(),
      sync_status: 'pending_insert'
    } as LocalMantenimiento;

    const savedMant = await mantenimientosRepo.save(newMant);
    addMantToStore(savedMant);
    syncEngine.triggerSync();
    return savedMant;
  };

  const updateMantenimiento = async (uuid: string, updates: Partial<LocalMantenimiento>) => {
    const existing = await mantenimientosRepo.getById(uuid);
    if (!existing) throw new Error('Mantenimiento not found');

    const updated: LocalMantenimiento = {
      ...existing,
      ...updates
    };

    const savedMant = await mantenimientosRepo.save(updated);
    updateMantInStore(savedMant);
    syncEngine.triggerSync();
    return savedMant;
  };

  const deleteMantenimiento = async (uuid: string) => {
    await mantenimientosRepo.delete(uuid);
    deleteMantFromStore(uuid);
    syncEngine.triggerSync();
  };

  return {
    createMantenimiento,
    updateMantenimiento,
    deleteMantenimiento,
    syncNow: () => syncEngine.triggerSync()
  };
};
