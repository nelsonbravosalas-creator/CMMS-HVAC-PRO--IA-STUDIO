import Dexie, { Table } from 'dexie';

export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete' | 'failed' | 'conflicted';

export interface LocalBase {
  uuid_sync: string;
  updated_at: number;
  sync_status: SyncStatus;
  version?: number;
  retry_count?: number;
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
  ubicacionGeografica?: { lat: number, lng: number };
}

export interface LocalMantenimiento extends LocalBase {
  id: string;
  equipo_tag: string;
  tecnico: string;
  tecnico_id?: string;
  tipo: string;
  fecha: string;
  proxima_fecha?: string;
  estado: string;
  hallazgos: string;
  descripcion?: string; // Originally acciones
  repuestos: string;
  ubicacionGeografica?: { lat: number, lng: number };
}

export interface LocalCliente extends LocalBase {
  id: string;
  nombre: string;
  rut?: string;
  empresa: string;
  email: string;
  telefono: string;
  direccion: string;
  contacto_nombre?: string;
  contacto_cargo?: string;
  region?: string;
  activo?: boolean;
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
  codigo?: string;
  cliente_id: string;
  direccion: string;
  ciudad: string;
  region: string;
  activo?: boolean;
}

export interface LocalInforme extends LocalBase {
  id: string;
  data: any;
}

export interface LocalEvento extends LocalBase {
  id: string;
  data: any;
}

export interface LocalCatalogAssetType extends LocalBase {
  codigo: string;
  descripcion: string;
  activo: boolean;
}

export interface LocalOrdenServicio extends LocalBase {
  id: string;
  estado: string;
  draft_key: string;
  data: any;
}

export interface LocalSetting {
  key: string;
  value: string;
  updated_at: number;
  sync_status: SyncStatus;
}

export interface SyncOperation {
  id?: number;
  table: string;
  uuid_sync: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retry_count?: number;
  last_error?: string;
  next_retry_at?: number;
  locked_at?: number;
  created_at?: number;
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
  catalog_asset_types!: Table<LocalCatalogAssetType>;
  ordenes_servicio!: Table<LocalOrdenServicio>;
  settings!: Table<LocalSetting>;
  reports!: Table<LocalInforme>;
  events!: Table<LocalEvento>;
  sync_queue!: Table<SyncOperation>;
  audit_logs!: Table<AuditLog>;

  constructor() {
    super('CMMS_LocalDB_v9');
    this.version(9).stores({
      assets: 'uuid_sync, tag, cliente_id, sucursal_id, sync_status, updated_at, estado',
      work_orders: 'uuid_sync, id, equipo_tag, cliente_id, sync_status, updated_at, estado',
      preventive_maintenance: 'uuid_sync, id, equipo_tag, sync_status, updated_at, estado',
      clients: 'uuid_sync, id, sync_status, updated_at',
      users: 'uuid_sync, id, email, sync_status, updated_at',
      branches: 'uuid_sync, id, codigo, cliente_id, sync_status, updated_at',
      catalog_asset_types: 'uuid_sync, codigo, sync_status, updated_at',
      ordenes_servicio: 'uuid_sync, id, draft_key, sync_status, updated_at',
      settings: 'key, sync_status, updated_at',
      reports: 'uuid_sync, id, sync_status, updated_at',
      events: 'uuid_sync, id, sync_status, updated_at',
      sync_queue: '++id, table, uuid_sync, operation, [uuid_sync+operation], timestamp',
      audit_logs: '++id, action, userId, timestamp'
    });
    
    this.on('populate', async () => {
      const now = Date.now();
      // Default branches
      await this.branches.bulkAdd([
        { uuid_sync: crypto.randomUUID(), id: 'SUB-default1', nombre: 'Bodega Central', codigo: '21-STK', cliente_id: 'default', direccion: 'Las Condes 123', ciudad: 'Santiago', region: 'RM', activo: true, updated_at: now, sync_status: 'synced' },
      ]);
      // Default asset types
      await this.catalog_asset_types.bulkAdd([
        { uuid_sync: crypto.randomUUID(), codigo: 'AC', descripcion: 'Aire acondicionado', activo: true, updated_at: now, sync_status: 'synced' },
        { uuid_sync: crypto.randomUUID(), codigo: 'VH', descripcion: 'Vehículo', activo: true, updated_at: now, sync_status: 'synced' },
        { uuid_sync: crypto.randomUUID(), codigo: 'GE', descripcion: 'Grupo electrógeno', activo: true, updated_at: now, sync_status: 'synced' },
        { uuid_sync: crypto.randomUUID(), codigo: 'EB', descripcion: 'Equipo de Bodega', activo: true, updated_at: now, sync_status: 'synced' },
        { uuid_sync: crypto.randomUUID(), codigo: 'GO', descripcion: 'Grúa horquilla', activo: true, updated_at: now, sync_status: 'synced' },
        { uuid_sync: crypto.randomUUID(), codigo: 'XX', descripcion: 'Otros Activos', activo: true, updated_at: now, sync_status: 'synced' },
      ]);
    });
  }
}

export const db = new CMMSDatabase();
