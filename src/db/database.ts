import Dexie, { Table } from 'dexie';

export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete' | 'failed' | 'conflicted';

export interface LocalBase {
  uuid_sincro: string;
  modificado_en: number;
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

export interface SyncOperation {
  id?: number;
  table: string;
  uuid_sincro: string;
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
  activos!: Table<LocalActivo>;
  tickets!: Table<LocalTicket>;
  mantenimientos!: Table<LocalMantenimiento>;
  clientes!: Table<LocalCliente>;
  usuarios!: Table<LocalUsuario>;
  sucursales!: Table<LocalSucursal>;
  informes!: Table<LocalInforme>;
  eventos!: Table<LocalEvento>;
  sync_queue!: Table<SyncOperation>;
  audit_logs!: Table<AuditLog>;

  constructor() {
    super('CMMS_LocalDB_v2');
    this.version(2).stores({
      activos: 'uuid_sincro, tag, cliente_id, sucursal_id, sync_status, modificado_en',
      tickets: 'uuid_sincro, id, equipo_tag, cliente_id, sync_status, modificado_en',
      mantenimientos: 'uuid_sincro, id, equipo_tag, sync_status, modificado_en',
      clientes: 'uuid_sincro, id, sync_status, modificado_en',
      usuarios: 'uuid_sincro, id, sync_status, modificado_en',
      sucursales: 'uuid_sincro, id, cliente_id, sync_status, modificado_en',
      informes: 'uuid_sincro, id, sync_status, modificado_en',
      eventos: 'uuid_sincro, id, sync_status, modificado_en',
      sync_queue: '++id, table, uuid_sincro, operation, timestamp',
      audit_logs: 'id, action, userId, timestamp'
    });
  }
}

export const db = new CMMSDatabase();
