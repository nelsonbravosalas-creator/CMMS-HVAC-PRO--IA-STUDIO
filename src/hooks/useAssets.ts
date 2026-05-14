import { useAppStore } from '../store/useAppStore';
import { activosRepo } from '../repositories/ActivosRepository';
import { LocalActivo } from '../db/database';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSyncStore } from '../store/useSyncStore';
import { syncEngine } from '../sync/syncEngine';

export const useAssets = () => {
  const { activos, addActivo, updateActivo, deleteActivo } = useAppStore();
  const queryClient = useQueryClient();

  // Background sync from remote (reads latest version)
  useQuery({
    queryKey: ['assets_remote'],
    queryFn: async () => {
      // Background query logic goes here instead of direct fetch overwrites
      return [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<LocalActivo>) => {
      const savedAsset = await activosRepo.save({
        ...data,
      } as LocalActivo);
      return savedAsset;
    },
    onMutate: async (newAsset) => {
      // Optimistic local update via Zustand
      // We wait for DB save above, so optimistic update can be immediate or after save.
      // We do it after save to have the uuid_sincro natively
    },
    onSuccess: (savedAsset) => {
      addActivo(savedAsset);
      syncEngine.triggerSync();
      queryClient.invalidateQueries({ queryKey: ['assets_remote'] });
    }
  });

  const editMutation = useMutation({
    mutationFn: async ({ uuid, data }: { uuid: string, data: Partial<LocalActivo> }) => {
      return await activosRepo.update(uuid, data);
    },
    onSuccess: (updatedAsset) => {
      updateActivo(updatedAsset);
      syncEngine.triggerSync();
      queryClient.invalidateQueries({ queryKey: ['assets_remote'] });
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (uuid: string) => {
      await activosRepo.delete(uuid);
      return uuid;
    },
    onSuccess: (uuid) => {
      deleteActivo(uuid);
      syncEngine.triggerSync();
      queryClient.invalidateQueries({ queryKey: ['assets_remote'] });
    }
  });

  return {
    activos,
    createAsset: createMutation.mutateAsync,
    editAsset: (uuid: string, data: Partial<LocalActivo>) => editMutation.mutateAsync({ uuid, data }),
    removeAsset: removeMutation.mutateAsync,
    syncNow: () => syncEngine.triggerSync()
  };
};

