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
  frecuencia_mantenimiento?: string;
  horas_operacion: number;
  tecnicos: string[];
  notas: string;
  cliente_id?: string;
  sucursal_id?: string;
  latitud?: number;
  longitud?: number;
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
  imagenes?: string[];
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
  /** Nombre canónico alineado con columna Neon `acciones` */
  acciones: string;
  repuestos: string;
  descripcion?: string;
  ubicacionGeografica?: { lat: number, lng: number };
  cliente_id?: string;
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
  contacto_correo?: string;
  contacto_cargo?: string;
  region?: string;
  activo?: boolean;
}

export interface LocalUsuario extends LocalBase {
  id: string;
  nombre: string;
  /** Nombre canónico alineado con columna Neon `correo` */
  correo: string;
  /** Nombre canónico alineado con columna Neon `perfil` */
  perfil: string;
  pin: string;
  activo: boolean;
  cliente_id?: string;
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
  contacto_nombre?: string;
  contacto_correo?: string;
  contacto_cargo?: string;
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

export interface LocalInventario extends LocalBase {
  id: string;
  categoria: 'maquinas' | 'instrumentos' | 'vehiculos' | 'insumos' | 'materiales_repuestos';
  codigo: string;
  nombre: string;
  /** Nombre canónico alineado con columna Neon `cantidad` */
  cantidad: number;
  /** Nombre canónico alineado con columna Neon `unidad_medida` */
  unidad_medida: string;
  cliente_id: string;
  marca?: string;
  modelo?: string;
  estado?: string;
  asignado_a?: string;
  data?: any;
}

export interface LocalOrdenServicio extends LocalBase {
  id: string;
  estado: string;
  draft_key: string;
  data: any;
  cliente_id?: string;
}

export interface LocalSetting extends LocalBase {
  /** uuid_sync como PK alineado con servidor — key es el nombre lógico */
  key: string;
  value: string;
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
  cliente_id?: string;
  idempotencyKey?: string;
}

export interface LocalConflict {
  id?: number;
  entityType: string;
  entityId: string;
  clienteId?: string;
  localData: any;
  serverData: any;
  detectedAt: number;
  resolved: boolean;
  resolution?: 'keep_local' | 'keep_server';
}

export interface LocalIdempotencyCache {
  idempotencyKey: string;
  result: any;
  createdAt: number;
  expiresAt: number;
}

export interface AuditLog extends LocalBase {
  id?: string;
  action: string;
  /** Alineado con columna Neon `user_id` */
  user_id: string;
  entity_type: string;
  entity_id: string;
  /** JSONB payload — objeto serializable */
  payload?: any;
  timestamp: number;
  cliente_id?: string;
}

export interface LocalBlob {
  uuid_sync: string;
  blob: Blob;
  mime_type: string;
  metadata?: any;
  created_at: number;
}

export class CMMSDatabase extends Dexie {
  assets!: Table<LocalActivo>;
  work_orders!: Table<LocalTicket>;
  preventive_maintenance!: Table<LocalMantenimiento>;
  clientes!: Table<LocalCliente>;
  users!: Table<LocalUsuario>;
  sucursales!: Table<LocalSucursal>;
  catalog_asset_types!: Table<LocalCatalogAssetType>;
  ordenes_servicio!: Table<LocalOrdenServicio>;
  settings!: Table<LocalSetting>;
  reports!: Table<LocalInforme>;
  events!: Table<LocalEvento>;
  inventory!: Table<LocalInventario>;
  calendar!: Table<LocalEvento>;
  sync_queue!: Table<SyncOperation>;
  audit_logs!: Table<AuditLog>;
  blobs!: Table<LocalBlob>;
  conflicts!: Table<LocalConflict>;
  idempotency_cache!: Table<LocalIdempotencyCache>;

  constructor() {
    super('CMMS_LocalDB_v14');
    const schemaV13 = {
      assets: 'uuid_sync, tag, cliente_id, sucursal_id, sync_status, updated_at, estado',
      work_orders: 'uuid_sync, id, equipo_tag, cliente_id, sync_status, updated_at, estado',
      preventive_maintenance: 'uuid_sync, id, equipo_tag, cliente_id, sync_status, updated_at, estado',
      clientes: 'uuid_sync, id, sync_status, updated_at',
      users: 'uuid_sync, id, correo, sync_status, updated_at',
      sucursales: 'uuid_sync, id, codigo, cliente_id, sync_status, updated_at',
      catalog_asset_types: 'uuid_sync, codigo, sync_status, updated_at',
      ordenes_servicio: 'uuid_sync, id, draft_key, cliente_id, sync_status, updated_at',
      settings: 'key, sync_status, updated_at',
      reports: 'uuid_sync, id, sync_status, updated_at',
      events: 'uuid_sync, id, sync_status, updated_at',
      inventory: 'uuid_sync, id, categoria, cliente_id, sync_status, updated_at',
      calendar: 'uuid_sync, id, sync_status, updated_at',
      sync_queue: '++id, table, uuid_sync, operation, [uuid_sync+operation], timestamp',
      audit_logs: '++id, action, userId, cliente_id, timestamp',
      blobs: 'uuid_sync, created_at'
    };
    this.version(13).stores(schemaV13);

    // v14: AuditLog usa user_id (snake_case), settings agrega uuid_sync como PK
    const schemaV14 = {
      ...schemaV13,
      settings: 'uuid_sync, key, sync_status, updated_at',
      // v14: audit_logs migra índice de 'userId' (v13) a 'user_id' (snake_case alineado con Neon)
      audit_logs: '++id, action, user_id, cliente_id, timestamp',
    };

    this.version(14).stores(schemaV14).upgrade(tx => {
      return tx.table('settings').toCollection().modify((setting: any) => {
        if (!setting.uuid_sync) {
          setting.uuid_sync = crypto.randomUUID();
        }
      });
    });

    // v15: add conflicts + idempotency_cache stores; add idempotencyKey index to sync_queue
    this.version(15).stores({
      ...schemaV14,
      sync_queue: '++id, table, uuid_sync, operation, [uuid_sync+operation], timestamp, idempotencyKey',
      conflicts: '++id, entityType, entityId, clienteId, resolved, detectedAt',
      idempotency_cache: 'idempotencyKey, expiresAt',
    });
    
    this.on('populate', async () => {
      const now = Date.now();
      // Default Clients Seed
      await this.clientes.bulkAdd([
        { uuid_sync: 'cliente-default-001', id: 'cliente-default-001', nombre: 'Cliente EECOL S.A.', empresa: 'EECOL Industrial', email: 'contacto@eecol.cl', telefono: '+56220001111', direccion: 'Santiago Centro 456', updated_at: now, sync_status: 'synced' }
      ]);
      // Default Branches (sucursales) with correct cliente_id & fallback id 'default-sucursal'
      await this.sucursales.bulkAdd([
        { uuid_sync: 'default-sucursal', id: 'default-sucursal', nombre: 'Bodega Central', codigo: '21-STK', cliente_id: 'cliente-default-001', direccion: 'Las Condes 123', ciudad: 'Santiago', region: 'RM', activo: true, updated_at: now, sync_status: 'synced' },
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
