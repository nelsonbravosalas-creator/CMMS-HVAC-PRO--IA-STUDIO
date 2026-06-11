import { db } from '../db/database';
import { SyncOperation } from '../db/database';

export class SyncQueue {
  async enqueue(operation: SyncOperation) {
    await db.transaction('rw', db.sync_queue, async () => {
      const existing = await db.sync_queue
        .where({ uuid_sync: operation.uuid_sync, operation: operation.operation })
        .first();

      if (existing) {
        await db.sync_queue.update(existing.id!, {
          data: operation.data,
          timestamp: Date.now()
        });
      } else {
        await db.sync_queue.add(operation);
      }
    });
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

  async markFailed(id: number, error: string) {
    const existing = await db.sync_queue.get(id);
    if (existing) {
      const newRetries = (existing.retry_count || 0) + 1;
      let backoffMs = 0;
      if (newRetries === 1) backoffMs = 30000; // Intento 2: 30s later (intento 1 was immediate)
      else if (newRetries === 2) backoffMs = 300000; // Intento 3: 5 mins later
      else if (newRetries >= 3) backoffMs = 0; // permanent fail, no backoff needed since we filter it out

      await db.sync_queue.update(id, {
        retry_count: newRetries,
        last_error: error,
        next_retry_at: backoffMs ? Date.now() + backoffMs : undefined
      });
    }
  }

  async clear() {
    await db.sync_queue.clear();
  }
}

export const syncQueue = new SyncQueue();
