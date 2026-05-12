import Dexie, { Table } from 'dexie';

export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update';

export interface LocalBase {
  uuid_sincro: string;
  modificado_en: number;
  sync_status: SyncStatus;
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
  estado: string;
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
  tecnico_id: string;
  tipo: string;
  fecha: string;
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

export class CMMSDatabase extends Dexie {
  activos!: Table<LocalActivo>;
  tickets!: Table<LocalTicket>;
  mantenimientos!: Table<LocalMantenimiento>;
  clientes!: Table<LocalCliente>;
  usuarios!: Table<LocalUsuario>;

  constructor() {
    super('CMMS_LocalDB');
    this.version(1).stores({
      activos: 'uuid_sincro, tag, sync_status, modificado_en',
      tickets: 'uuid_sincro, id, sync_status, modificado_en',
      mantenimientos: 'uuid_sincro, id, sync_status, modificado_en',
      clientes: 'uuid_sincro, id, sync_status, modificado_en',
      usuarios: 'uuid_sincro, id, sync_status, modificado_en'
    });
  }
}

export const db = new CMMSDatabase();
