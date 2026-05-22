import { db, LocalMantenimiento } from '../db/database';

export const saveMantenimiento = async (data: LocalMantenimiento) => {
  return await db.transaction('rw', db.preventive_maintenance, db.sync_queue, async () => {
    const now = Date.now();
    
    // 1. Guardado local (ARQ-01)
    const recordToSave: LocalMantenimiento = {
      ...data,
      sync_status: 'pending_insert',
      updated_at: now
    };
    await db.preventive_maintenance.put(recordToSave);
    
    // 2. Encolado obligatorio (ARQ-02)
    await db.sync_queue.put({
      uuid_sync: data.uuid_sync,
      table: 'preventive_maintenance',
      operation: 'insert',
      data: recordToSave,
      timestamp: now,
      retry_count: 0
    });
    
    return recordToSave;
  });
};

export const useMantenimiento = () => {
  return {
    saveMantenimiento
  };
};
