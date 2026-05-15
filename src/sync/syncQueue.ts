import { db } from '../db/database';
import { SyncOperation } from '../db/database';

export class SyncQueue {
  async enqueue(operation: SyncOperation) {
    // Avoid duplicate inserts for the same entity and operation type
    const existing = await db.sync_queue
      .where({ uuid_sync: operation.uuid_sync, operation: operation.operation })
      .first();
      
    if (existing) {
      await db.sync_queue.update(existing.id!, {
        data: operation.data,
        timestamp: Date.now()
      });
      return;
    }
    
    await db.sync_queue.add(operation);
  }

  async dequeue(): Promise<SyncOperation | undefined> {
    const items = await db.sync_queue.orderBy('timestamp').limit(1).toArray();
    return items.length > 0 ? items[0] : undefined;
  }

  async peekAll(): Promise<SyncOperation[]> {
    return db.sync_queue.orderBy('timestamp').toArray();
  }

  async remove(id: number) {
    await db.sync_queue.delete(id);
  }

  async clear() {
    await db.sync_queue.clear();
  }
}

export const syncQueue = new SyncQueue();
