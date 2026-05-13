import { useCMMSStore } from '../store/useCMMSStore';
import { mantenimientosRepo } from '../repositories/MantenimientosRepository';
import { LocalMantenimiento } from '../lib/dbLocal';

export const useMantenimientos = () => {
  const addMantToStore = useCMMSStore(state => state.addMantenimiento);
  const updateMantInStore = useCMMSStore(state => state.updateMantenimiento);
  const deleteMantFromStore = useCMMSStore(state => state.deleteMantenimiento);

  const createMantenimiento = async (data: Partial<LocalMantenimiento>) => {
    const newMant: LocalMantenimiento = {
      ...data,
      uuid_sincro: crypto.randomUUID(),
      modificado_en: Date.now(),
      sync_status: 'pending_insert'
    } as LocalMantenimiento;

    await mantenimientosRepo.save(newMant);
    addMantToStore(newMant);
    return newMant;
  };

  const updateMantenimiento = async (uuid: string, updates: Partial<LocalMantenimiento>) => {
    const existing = await mantenimientosRepo.getById(uuid);
    if (!existing) throw new Error('Mantenimiento not found');

    const updated: LocalMantenimiento = {
      ...existing,
      ...updates,
      modificado_en: Date.now(),
      sync_status: 'pending_update'
    };

    await mantenimientosRepo.save(updated);
    updateMantInStore(updated);
    return updated;
  };

  const deleteMantenimiento = async (uuid: string) => {
    await mantenimientosRepo.delete(uuid);
    deleteMantFromStore(uuid);
  };

  return {
    createMantenimiento,
    updateMantenimiento,
    deleteMantenimiento
  };
};
