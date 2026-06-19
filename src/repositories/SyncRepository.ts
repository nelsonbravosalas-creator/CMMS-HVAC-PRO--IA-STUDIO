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

  async addAuditLog(action: string, userId: string, details: string) {
    return db.audit_logs.add({
      id: crypto.randomUUID(),
      action,
      userId,
      details,
      timestamp: Date.now()
    });
  }
}

export const syncRepo = new SyncRepository();
