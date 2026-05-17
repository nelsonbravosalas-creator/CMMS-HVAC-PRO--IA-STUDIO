import { db, CMMSDatabase, SyncStatus, LocalBase } from '../db/database';
import { Table } from 'dexie';
import { syncQueue } from '../sync/syncQueue';

export abstract class BaseRepository<T extends LocalBase> {
  protected table: Table<T>;
  protected tableName: keyof CMMSDatabase;

  constructor(tableName: keyof CMMSDatabase) {
    this.tableName = tableName;
    this.table = db[tableName] as Table<T>;
  }

  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  async getById(uuid?: string | null): Promise<T | undefined> {
    if (!this.isValidUuid(uuid)) return undefined;
    return this.table.get(uuid);
  }

  async create(data: Omit<T, keyof LocalBase> & Partial<LocalBase>): Promise<T> {
    const now = Date.now();
    const uuid_sync = this.ensureUuid(data.uuid_sync);
    const record = {
      ...data,
      uuid_sync,
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
    const safeUuid = this.ensureUuid(uuid);
    const existing = await this.getById(safeUuid);
    if (!existing) throw new Error(`Record not found in ${String(this.tableName)}: ${safeUuid}`);

    const now = Date.now();
    const record = {
      ...existing,
      ...data,
      uuid_sync: safeUuid,
      updated_at: now,
      version: (existing.version || 0) + 1,
      retry_count: 0,
      sync_status: 'pending_update' as SyncStatus
    } as unknown as T;

    await this.table.put(record);
    await this.enqueueSync(safeUuid, 'update', record);
    return record;
  }

  async enqueueSync(uuid_sync: string, operation: 'insert' | 'update' | 'delete', data: any) {
    const safeUuid = this.ensureUuid(uuid_sync);
    await syncQueue.enqueue({
      table: this.table.name,
      uuid_sync: safeUuid,
      operation,
      data,
      timestamp: Date.now()
    });
  }

  async hydrate(): Promise<T[]> {
    return this.table.where('sync_status').notEqual('pending_delete').toArray();
  }

  async save(data: T): Promise<T> {
    const uuid_sync = this.ensureUuid(data.uuid_sync);
    const normalized = { ...data, uuid_sync } as T;
    const existing = await this.getById(uuid_sync);
    if (existing) {
      return this.update(uuid_sync, normalized);
    }
    return this.create(normalized);
  }

  async delete(uuid: string): Promise<void> {
    const safeUuid = this.ensureUuid(uuid);
    const existing = await this.getById(safeUuid);
    if (!existing) return;

    const now = Date.now();
    await this.table.update(safeUuid, {
      sync_status: 'pending_delete' as SyncStatus,
      updated_at: now,
      deleted_at: now,
      retry_count: 0
    } as any);

    await this.enqueueSync(safeUuid, 'delete', { uuid_sync: safeUuid, deleted_at: now });
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
    const safeUuid = this.ensureUuid(uuid);
    const now = Date.now();
    await this.table.update(safeUuid, {
      sync_status: 'synced' as SyncStatus,
      last_synced_at: now,
      retry_count: 0
    } as any);
  }

  async markFailed(uuid: string, incrementRetry: boolean = true): Promise<void> {
    const safeUuid = this.ensureUuid(uuid);
    const existing = await this.getById(safeUuid);
    if (!existing) return;
    
    await this.table.update(safeUuid, {
      sync_status: 'failed' as SyncStatus,
      retry_count: incrementRetry ? existing.retry_count + 1 : existing.retry_count
    } as any);
  }

  async resolveConflict(uuid: string, serverData: Partial<T>): Promise<T> {
    // Basic conflict resolver: server wins but locally we mark as synced
    const safeUuid = this.ensureUuid(uuid);
    const existing = await this.getById(safeUuid);
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

  private isValidUuid(uuid: unknown): uuid is string {
    return typeof uuid === 'string' && uuid.trim().length > 0;
  }

  private ensureUuid(uuid: unknown): string {
    if (this.isValidUuid(uuid)) return uuid.trim();
    return crypto.randomUUID();
  }
}
