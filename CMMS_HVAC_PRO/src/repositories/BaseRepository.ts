import { db, CMMSDatabase, SyncStatus, LocalBase } from '../db/database';
import { Table } from 'dexie';

export abstract class BaseRepository<T extends LocalBase> {
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

  async create(data: Omit<T, keyof LocalBase> & Partial<LocalBase>): Promise<T> {
    const now = Date.now();
    const uuidSync = data.uuid_sync || crypto.randomUUID();
    const record = {
      ...data,
      uuid_sync: uuidSync,
      id: data.id || `PEND-${uuidSync}`,
      updated_at: now,
      version: 1,
      retry_count: 0,
      sync_status: 'pending_insert' as SyncStatus
    } as unknown as T;

    await this.table.put(record);
    await this.enqueueSync(record.uuid_sync, 'insert', record);
    return record;
  }

  async update(uuid: string, data: Partial<T>): Promise<T> {
    const existing = await this.getById(uuid);
    if (!existing) throw new Error('Record not found');

    const now = Date.now();
    const record = {
      ...existing,
      ...data,
      updated_at: now,
      version: (existing.version || 0) + 1,
      retry_count: 0,
      sync_status: 'pending_update' as SyncStatus
    } as unknown as T;

    await this.table.put(record);
    await this.enqueueSync(uuid, 'update', record);
    return record;
  }

  async enqueueSync(uuid_sync: string, operation: 'insert' | 'update' | 'delete', data: any) {
    const existingQueued = await db.sync_queue
      .where('[uuid_sync+operation]')
      .equals([uuid_sync, operation])
      .first();

    const queueItem = {
      table: this.table.name,
      uuid_sync,
      operation,
      data,
      timestamp: Date.now()
    };

    if (existingQueued?.id) {
      await db.sync_queue.update(existingQueued.id, {
        ...queueItem,
        retry_count: 0,
        last_error: undefined,
        next_retry_at: undefined
      });
      return;
    }

    await db.sync_queue.add(queueItem);
  }

  async hydrate(): Promise<T[]> {
    return this.table.where('sync_status').notEqual('pending_delete').toArray();
  }

  async save(data: T): Promise<T> {
    const existing = await this.getById(data.uuid_sync);
    if (existing) {
      if (existing.sync_status === 'pending_insert') {
        const now = Date.now();
        const record = {
          ...existing,
          ...data,
          updated_at: now,
          version: (existing.version || 0) + 1,
          retry_count: 0,
          sync_status: 'pending_insert' as SyncStatus
        } as unknown as T;

        await this.table.put(record);
        await this.enqueueSync(record.uuid_sync, 'insert', record);
        return record;
      }

      return this.update(data.uuid_sync, data);
    } else {
      return this.create(data);
    }
  }

  async delete(uuid: string): Promise<void> {
    const existing = await this.getById(uuid);
    if (!existing) return;

    const now = Date.now();
    await this.table.update(uuid, {
      sync_status: 'pending_delete' as SyncStatus,
      updated_at: now,
      deleted_at: now,
      retry_count: 0
    } as any);

    await this.enqueueSync(uuid, 'delete', { uuid_sync: uuid, deleted_at: now });
  }

  async list(limit: number = 100, offset: number = 0): Promise<T[]> {
    return this.table.offset(offset).limit(limit).toArray();
  }

  async search(query: string, fields: (keyof T)[]): Promise<T[]> {
    return this.table.filter(item => {
      if (item.sync_status === 'pending_delete') return false;
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
      last_synced_at: now,
      retry_count: 0
    } as any);
  }

  async markFailed(uuid: string, incrementRetry: boolean = true): Promise<void> {
    const existing = await this.getById(uuid);
    if (!existing) return;
    
    await this.table.update(uuid, {
      sync_status: 'failed' as SyncStatus,
      retry_count: incrementRetry ? existing.retry_count + 1 : existing.retry_count
    } as any);
  }

  async resolveConflict(uuid: string, serverData: Partial<T>): Promise<T> {
    // Basic conflict resolver: server wins but locally we mark as synced
    const existing = await this.getById(uuid);
    if (!existing) throw new Error('Record not found');

    const merged = {
      ...existing,
      ...serverData,
      sync_status: 'synced' as SyncStatus,
      updated_at: Date.now(),
      version: serverData.version || existing.version,
      retry_count: 0
    };

    await this.table.put(merged as T);
    return merged as T;
  }

  async getSyncQueue(): Promise<any[]> {
    return db.sync_queue.where('table').equals(this.table.name).toArray();
  }
}
