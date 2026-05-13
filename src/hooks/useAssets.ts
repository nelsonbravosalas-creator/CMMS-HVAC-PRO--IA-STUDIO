import { useAppStore } from '../store/useAppStore';
import { activosRepo } from '../repositories/ActivosRepository';
import { LocalActivo } from '../db/database';

export const useAssets = () => {
  const { activos, addActivo, updateActivo, deleteActivo } = useAppStore();

  const createAsset = async (data: Partial<LocalActivo>) => {
    const newAsset: LocalActivo = {
      ...data,
      uuid_sincro: crypto.randomUUID(),
      modificado_en: Date.now(),
      sync_status: 'pending_insert'
    } as LocalActivo;

    await activosRepo.save(newAsset);
    addActivo(newAsset);
    return newAsset;
  };

  const editAsset = async (uuid: string, data: Partial<LocalActivo>) => {
    const existing = await activosRepo.getById(uuid);
    if (!existing) throw new Error('Asset not found');

    const updatedAsset: LocalActivo = {
      ...existing,
      ...data,
      modificado_en: Date.now(),
      sync_status: 'pending_update'
    };

    await activosRepo.save(updatedAsset);
    updateActivo(updatedAsset);
    return updatedAsset;
  };

  const removeAsset = async (uuid: string) => {
    await activosRepo.delete(uuid);
    deleteActivo(uuid);
  };

  return {
    activos,
    createAsset,
    editAsset,
    removeAsset
  };
};
