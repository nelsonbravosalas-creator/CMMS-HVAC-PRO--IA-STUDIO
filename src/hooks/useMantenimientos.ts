import { useAppStore } from '../store/useAppStore';
import { mantenimientosRepo } from '../repositories/MantenimientosRepository';
import { LocalMantenimiento } from '../db/database';

export const useMantenimientos = () => {
  const addMantToStore = useAppStore(state => state.addMantenimiento);
  const updateMantInStore = useAppStore(state => state.updateMantenimiento);
  const deleteMantFromStore = useAppStore(state => state.deleteMantenimiento);

  const createMantenimiento = async (data: Partial<LocalMantenimiento>) => {
    const newMant: LocalMantenimiento = {
      ...data,
      uuid_sincro: crypto.randomUUID(),
      modificado_en: Date.now(),
      sync_status: 'pending_insert'
    } as LocalMantenimiento;

    const savedMant = await mantenimientosRepo.save(newMant);
    addMantToStore(savedMant);
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
    return savedMant;
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
