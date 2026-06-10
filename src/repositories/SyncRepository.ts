import { db, SyncOperation } from '../db/database';

export class SyncRepository {
  async getQueue() {
    return db.sync_queue.orderBy('id').toArray();
  }

  async getPendingCount() {
    return db.sync_queue.count();
  }

  async removeFromQueue(id: number) {
    return db.sync_queue.delete(id);
  }

  async clearQueue() {
    return db.sync_queue.clear();
  }

  async getAuditLogs(limit = 100) {
    return db.audit_logs.orderBy('timestamp').reverse().limit(limit).toArray();
  }

  async addAuditLog(action: string, userId: string, entityType: string, entityId: string, payload?: any) {
    return db.audit_logs.add({
      id: crypto.randomUUID(),
      action,
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      uuid_sync: crypto.randomUUID(),
      updated_at: Date.now(),
      sync_status: 'pending_insert',
      timestamp: Date.now()
    });
  }
}

export const syncRepo = new SyncRepository();
