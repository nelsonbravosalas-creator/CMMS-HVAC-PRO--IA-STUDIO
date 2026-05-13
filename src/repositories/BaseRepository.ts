import { db, CMMSDatabase, SyncStatus } from '../db/database';
import { Table } from 'dexie';

export abstract class BaseRepository<T extends { uuid_sincro: string; modificado_en: number; sync_status: SyncStatus }> {
  protected table: Table<T>;

  constructor(tableName: keyof CMMSDatabase) {
    this.table = db[tableName] as Table<T>;
  }

  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  async getById(uuid: string): Promise<T | undefined> {
    return this.table.get(uuid);
  }

  async save(data: T): Promise<T> {
    const now = Date.now();
    const existing = await this.getById(data.uuid_sincro);
    
    const record = {
      ...data,
      modificado_en: now,
      version: (existing?.version || 0) + 1,
      retry_count: 0,
      sync_status: (existing ? 'pending_update' : 'pending_insert') as SyncStatus
    };
    
    await this.table.put(record);
    
    // Add to sync queue with more metadata
    await db.sync_queue.add({
      table: this.table.name,
      uuid_sincro: record.uuid_sincro,
      operation: existing ? 'update' : 'insert',
      data: record,
      timestamp: now
    });

    return record;
  }

  async delete(uuid: string): Promise<void> {
    const existing = await this.getById(uuid);
    if (!existing) return;

    const now = Date.now();
    await this.table.update(uuid, {
      sync_status: 'pending_delete' as SyncStatus,
      modificado_en: now,
      deleted_at: now
    } as any);

    await db.sync_queue.add({
      table: this.table.name,
      uuid_sincro: uuid,
      operation: 'delete',
      data: { uuid_sincro: uuid, deleted_at: now },
      timestamp: now
    });
  }

  async list(limit: number = 100, offset: number = 0): Promise<T[]> {
    return this.table.offset(offset).limit(limit).toArray();
  }

  async search(query: string, fields: (keyof T)[]): Promise<T[]> {
    return this.table.filter(item => {
      return fields.some(field => {
        const val = item[field];
        return typeof val === 'string' && val.toLowerCase().includes(query.toLowerCase());
      });
    }).toArray();
  }

  async markSynced(uuid: string): Promise<void> {
    const now = Date.now();
    await this.table.update(uuid, {
      sync_status: 'synced' as SyncStatus,
      modificado_en: now,
      last_synced_at: now,
      retry_count: 0
    } as any);
  }

  async markFailed(uuid: string): Promise<void> {
    // Optional: add a failed status or increment retry count
    console.warn(`[Repository] Sync failed for ${this.table.name}:${uuid}`);
  }

  async getSyncQueue(): Promise<any[]> {
    return db.sync_queue.where('table').equals(this.table.name).toArray();
  }
}
