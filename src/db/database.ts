import Dexie, { Table } from 'dexie';

export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete' | 'failed' | 'conflicted';

export interface LocalBase {
  uuid_sync: string;
  updated_at: number;
  sync_status: SyncStatus;
  version: number;
  retry_count: number;
  last_synced_at?: number;
  deleted_at?: number;
}

export interface LocalActivo extends LocalBase {
  tag: string;
  nombre: string;
  tipo: string;
  marca: string;
  modelo: string;
  serie: string;
  ubicacion: string;
  area: string;
  capacidad: string;
  voltaje: string;
  corriente: string;
  refrigerante: string;
  fecha_instalacion: string;
  vida_util: number;
  estado: 'operativo' | 'falla' | 'mantenimiento' | 'baja';
  ultimo_mantenimiento: string;
  proximo_mantenimiento: string;
  horas_operacion: number;
  tecnicos: string[];
  notas: string;
  cliente_id?: string;
  sucursal_id?: string;
  lat?: number;
  lng?: number;
}

export interface LocalTicket extends LocalBase {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  equipo_tag: string;
  cliente_id: string;
  creado_por: string;
  asignado_a: string;
  fecha_creacion: string;
}

export interface LocalMantenimiento extends LocalBase {
  id: string;
  equipo_tag: string;
  tecnico: string;
  tipo: string;
  fecha: string;
  estado: string;
  hallazgos: string;
  acciones: string;
  repuestos: string;
}

export interface LocalCliente extends LocalBase {
  id: string;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  direccion: string;
}

export interface LocalUsuario extends LocalBase {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  pin: string;
  activo: boolean;
}

export interface LocalSucursal extends LocalBase {
  id: string;
  nombre: string;
  cliente_id: string;
  direccion: string;
  ciudad: string;
  region: string;
}

export interface LocalInforme extends LocalBase {
  id: string;
  data: any;
}

export interface LocalEvento extends LocalBase {
  id: string;
  data: any;
}

export interface LocalOrdenServicio extends LocalBase {
  id: string;
  data: any;
}

export interface SyncOperation {
  id?: number;
  table: string;
  uuid_sync: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export interface AuditLog {
  id?: string;
  action: string;
  userId: string;
  details: string;
  timestamp: number;
}

export class CMMSDatabase extends Dexie {
  assets!: Table<LocalActivo>;
  work_orders!: Table<LocalTicket>;
  preventive_maintenance!: Table<LocalMantenimiento>;
  clients!: Table<LocalCliente>;
  users!: Table<LocalUsuario>;
  branches!: Table<LocalSucursal>;
  reports!: Table<LocalInforme>;
  events!: Table<LocalEvento>;
  ordenes_servicio!: Table<LocalOrdenServicio>;
  sync_queue!: Table<SyncOperation>;
  audit_logs!: Table<AuditLog>;

  constructor() {
    super('CMMS_LocalDB_v4');

    const version4Stores = {
      assets: 'uuid_sync, tag, cliente_id, sucursal_id, sync_status, updated_at',
      work_orders: 'uuid_sync, id, equipo_tag, cliente_id, sync_status, updated_at',
      preventive_maintenance: 'uuid_sync, id, equipo_tag, sync_status, updated_at',
      clients: 'uuid_sync, id, sync_status, updated_at',
      users: 'uuid_sync, id, sync_status, updated_at',
      branches: 'uuid_sync, id, cliente_id, sync_status, updated_at',
      reports: 'uuid_sync, id, sync_status, updated_at',
      events: 'uuid_sync, id, sync_status, updated_at',
      ordenes_servicio: 'uuid_sync, id, sync_status, updated_at',
      sync_queue: '++id, table, uuid_sync, operation, timestamp',
      audit_logs: 'id, action, userId, timestamp'
    };

    const version5Stores = {
      ...version4Stores,
      ordenes_servicio: 'uuid_sync, id, sync_status, updated_at'
    };

    const version6Stores = {
      ...version5Stores,
      users: 'uuid_sync, id, pin, sync_status, updated_at'
    };

    this.version(4).stores(version4Stores);
    this.version(5).stores(version5Stores);
    this.version(6).stores(version6Stores);
  }
}

export const db = new CMMSDatabase();
