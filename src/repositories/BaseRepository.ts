import { db, CMMSDatabase, SyncStatus } from '../lib/dbLocal';
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

  async save(data: T): Promise<string> {
    const now = Date.now();
    const record = {
      ...data,
      modificado_en: now,
      sync_status: data.sync_status || 'pending_insert'
    };
    
    await this.table.put(record);
    
    // Add to sync queue
    await db.sync_queue.add({
      table: this.table.name,
      uuid_sincro: record.uuid_sincro,
      operation: record.sync_status === 'pending_insert' ? 'insert' : 'update',
      data: record,
      timestamp: now
    });

    return record.uuid_sincro;
  }

  async delete(uuid: string): Promise<void> {
    const existing = await this.getById(uuid);
    if (!existing) return;

    await this.table.update(uuid, {
      sync_status: 'pending_delete' as SyncStatus,
      modificado_en: Date.now()
    } as any);

    await db.sync_queue.add({
      table: this.table.name,
      uuid_sincro: uuid,
      operation: 'delete',
      data: { uuid_sincro: uuid },
      timestamp: Date.now()
    });
  }
}
