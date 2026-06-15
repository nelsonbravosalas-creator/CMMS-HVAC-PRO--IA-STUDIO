import { db, CMMSDatabase, SyncStatus, LocalBase } from '../db/database';
import { Table } from 'dexie';
import { useAuthStore } from '../store/useAuthStore';

export abstract class BaseRepository<T extends LocalBase> {
  protected table: Table<T>;

  constructor(tableName: keyof CMMSDatabase) {
    this.table = db[tableName] as Table<T>;
  }

  async getAll(): Promise<T[]> {
    const clienteId = useAuthStore.getState().clienteActivo?.id;
    if (!clienteId) return this.table.where('sync_status').notEqual('pending_delete').toArray();
    return this.table
      .filter(item => item.sync_status !== 'pending_delete' && (item as any).cliente_id === clienteId)
      .toArray();
  }

  async getById(uuid: string): Promise<T | undefined> {
    return this.table.get(uuid);
  }

  async create(data: Omit<T, keyof LocalBase> & Partial<LocalBase>): Promise<T> {
    const now = Date.now();
    const record = {
      ...data,
      uuid_sync: data.uuid_sync || crypto.randomUUID(),
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
    return db.transaction('rw', this.table, db.sync_queue, async () => {
      const existing = await this.table.get(uuid);
      if (!existing) throw new Error('Record not found');

      const record = {
        ...existing,
        ...data,
        updated_at: Date.now(),
        version: (existing.version ?? 0) + 1,
        retry_count: 0,
        sync_status: 'pending_update' as SyncStatus
      } as unknown as T;

      await this.table.put(record);
      await this.enqueueSync(uuid, 'update', record);
      return record;
    });
  }

  async enqueueSync(uuid_sync: string, operation: 'insert' | 'update' | 'delete', data: any) {
    const cliente_id = useAuthStore.getState().clienteActivo?.id
      || localStorage.getItem('active_client')
      || undefined;

    await db.transaction('rw', db.sync_queue, async () => {
      const existing = await db.sync_queue
        .where({ uuid_sync, operation })
        .first();

      if (existing) {
        await db.sync_queue.update(existing.id!, {
          data,
          timestamp: Date.now()
        });
      } else {
        await db.sync_queue.add({
          table: this.table.name,
          uuid_sync,
          operation,
          data,
          timestamp: Date.now(),
          cliente_id,
          idempotencyKey: crypto.randomUUID()
        });
      }
    });
  }

  async hydrate(): Promise<T[]> {
    return this.table.where('sync_status').notEqual('pending_delete').toArray();
  }

  async save(data: T): Promise<T> {
    const existing = await this.getById(data.uuid_sync);
    if (existing) {
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
    const clienteId = useAuthStore.getState().clienteActivo?.id;
    return this.table.filter(item => {
      if (item.sync_status === 'pending_delete') return false;
      if (clienteId && (item as any).cliente_id && (item as any).cliente_id !== clienteId) return false;
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
      retry_count: incrementRetry ? (existing.retry_count ?? 0) + 1 : (existing.retry_count ?? 0)
    } as any);
  }

  async resolveConflict(uuid: string, serverData: Partial<T>): Promise<T> {
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
