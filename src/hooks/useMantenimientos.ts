import { db, LocalMantenimiento, SyncOperation } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { syncEngine } from '../sync/syncEngine';
import { handleError } from '../lib/errorHandler';

export const useMantenimientos = () => {
  const addMantToStore = useAppStore(state => state.addMantenimiento);
  const updateMantInStore = useAppStore(state => state.updateMantenimiento);
  const deleteMantFromStore = useAppStore(state => state.deleteMantenimiento);

  const createMantenimiento = async (data: Partial<LocalMantenimiento>): Promise<LocalMantenimiento> => {
    try {
      const now = Date.now();
      const newMant: LocalMantenimiento = {
        ...data,
        uuid_sync: typeof data.uuid_sync === 'string' ? data.uuid_sync : crypto.randomUUID(),
        updated_at: now,
        sync_status: 'pending_insert'
      } as LocalMantenimiento;

      // Guarda el objeto en Dexie
      await db.preventive_maintenance.put(newMant);

      // Inserta inmediatamente en la cola local
      const syncOp: SyncOperation = {
        table: 'preventive_maintenance',
        uuid_sync: newMant.uuid_sync,
        operation: 'insert',
        data: newMant,
        timestamp: now
      };
      await db.sync_queue.put(syncOp);

      addMantToStore(newMant);
      syncEngine.triggerSync().catch(e => handleError('useMantenimientos:triggerSync', e));
      
      return newMant;
    } catch (error) {
      handleError('useMantenimientos:crear', error);
      throw error;
    }
  };

  const updateMantenimiento = async (uuid: string, updates: Partial<LocalMantenimiento>): Promise<LocalMantenimiento> => {
    try {
      const existing = await db.preventive_maintenance.get(uuid);
      if (!existing) throw new Error('Mantenimiento no encontrado');

      const now = Date.now();
      const updated: LocalMantenimiento = {
        ...existing,
        ...updates,
        updated_at: now,
        sync_status: existing.sync_status === 'pending_insert' ? 'pending_insert' : 'pending_update'
      };

      await db.preventive_maintenance.put(updated);
      
      const syncOp: SyncOperation = {
        table: 'preventive_maintenance',
        uuid_sync: updated.uuid_sync,
        operation: existing.sync_status === 'pending_insert' ? 'insert' : 'update',
        data: updated,
        timestamp: now
      };
      await db.sync_queue.put(syncOp);

      updateMantInStore(updated);
      syncEngine.triggerSync().catch(e => handleError('useMantenimientos:triggerSync', e));

      return updated;
    } catch (error) {
      handleError('useMantenimientos:actualizar', error);
      throw error;
    }
  };

  const deleteMantenimiento = async (uuid: string): Promise<void> => {
    try {
      const existing = await db.preventive_maintenance.get(uuid);
      if (!existing) return;

      const now = Date.now();

      if (existing.sync_status === 'pending_insert') {
        await db.preventive_maintenance.delete(uuid);
        await db.sync_queue.where('uuid_sync').equals(uuid).delete();
      } else {
        const deletedRecord: LocalMantenimiento = {
          ...existing,
          deleted_at: now,
          updated_at: now,
          sync_status: 'pending_delete'
        };

        await db.preventive_maintenance.put(deletedRecord);
        const syncOp: SyncOperation = {
          table: 'preventive_maintenance',
          uuid_sync: uuid,
          operation: 'delete',
          data: deletedRecord,
          timestamp: now
        };
        await db.sync_queue.put(syncOp);
      }

      deleteMantFromStore(uuid);
      syncEngine.triggerSync().catch(e => handleError('useMantenimientos:triggerSync', e));
    } catch (error) {
      handleError('useMantenimientos:eliminar', error);
      throw error;
    }
  };

  return {
    createMantenimiento,
    updateMantenimiento,
    deleteMantenimiento,
    syncNow: () => syncEngine.triggerSync(true).catch(e => handleError('useMantenimientos:triggerSync', e))
  };
};
