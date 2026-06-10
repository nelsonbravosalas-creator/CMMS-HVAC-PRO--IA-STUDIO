import { create } from 'zustand';
import {
  db,
  LocalActivo, LocalTicket, LocalMantenimiento, LocalUsuario,
  LocalCliente, LocalSucursal, LocalInventario, LocalInforme,
  LocalEvento, LocalOrdenServicio, LocalSetting, LocalCatalogAssetType,
  SyncStatus
} from '../db/database';
import { logger } from '../lib/logger';

interface CMMSState {
  // Core tables
  assets: LocalActivo[];
  work_orders: LocalTicket[];
  preventive_maintenance: LocalMantenimiento[];
  users: LocalUsuario[];
  clients: LocalCliente[];
  branches: LocalSucursal[];
  // Extended tables (previously queried directly from Dexie)
  inventory: LocalInventario[];
  reports: LocalInforme[];
  events: LocalEvento[];
  ordenes_servicio: LocalOrdenServicio[];
  calendar: LocalEvento[];
  settings: LocalSetting[];
  catalog_asset_types: LocalCatalogAssetType[];

  isLoading: boolean;
  isOnline: boolean;

  // Actions
  hydrate: () => Promise<void>;
  setOnline: (status: boolean) => void;
  setSyncStatus: (table: string, uuid: string, status: SyncStatus) => void;

  // Optimistic UI — core tables
  addActivo: (activo: LocalActivo) => void;
  updateActivo: (activo: LocalActivo) => void;
  deleteActivo: (uuid: string) => void;

  addTicket: (ticket: LocalTicket) => void;
  updateTicket: (ticket: LocalTicket) => void;
  deleteTicket: (uuid: string) => void;

  addMantenimiento: (mant: LocalMantenimiento) => void;
  updateMantenimiento: (mant: LocalMantenimiento) => void;
  deleteMantenimiento: (uuid: string) => void;

  addUsuario: (user: LocalUsuario) => void;
  updateUsuario: (user: LocalUsuario) => void;
  deleteUsuario: (uuid: string) => void;

  addCliente: (client: LocalCliente) => void;
  updateCliente: (client: LocalCliente) => void;
  deleteCliente: (uuid: string) => void;

  // Optimistic UI — extended tables
  addInventario: (item: LocalInventario) => void;
  updateInventario: (item: LocalInventario) => void;
  deleteInventario: (uuid: string) => void;

  addOrdenServicio: (orden: LocalOrdenServicio) => void;
  updateOrdenServicio: (orden: LocalOrdenServicio) => void;
  deleteOrdenServicio: (uuid: string) => void;
}

export const useAppStore = create<CMMSState>((set) => ({
  assets: [],
  work_orders: [],
  preventive_maintenance: [],
  users: [],
  clients: [],
  branches: [],
  inventory: [],
  reports: [],
  events: [],
  ordenes_servicio: [],
  calendar: [],
  settings: [],
  catalog_asset_types: [],
  isLoading: true,
  isOnline: navigator.onLine,

  hydrate: async () => {
    set({ isLoading: true });
    logger.info('Store', 'Iniciando hidratación de datos...');
    try {
      const notDeleted = (table: any) => table.where('sync_status').notEqual('pending_delete').toArray();

      const [
        assets, work_orders, preventive_maintenance, users, clients, branches,
        inventory, reports, events, ordenes_servicio, calendar,
        catalog_asset_types
      ] = await Promise.all([
        notDeleted(db.assets),
        notDeleted(db.work_orders),
        notDeleted(db.preventive_maintenance),
        notDeleted(db.users),
        notDeleted(db.clientes),
        notDeleted(db.sucursales),
        notDeleted(db.inventory),
        notDeleted(db.reports),
        notDeleted(db.events),
        notDeleted(db.ordenes_servicio),
        notDeleted(db.calendar),
        notDeleted(db.catalog_asset_types),
      ]);

      // settings uses 'key' as PK, not sync_status-indexed — fetch all
      const settings = await db.settings.toArray();

      const byUpdatedAtDesc = (a: any, b: any) => (b.updated_at || 0) - (a.updated_at || 0);

      set({
        assets: assets.sort(byUpdatedAtDesc),
        work_orders: work_orders.sort(byUpdatedAtDesc),
        preventive_maintenance: preventive_maintenance.sort(byUpdatedAtDesc),
        users,
        clients,
        branches,
        inventory: inventory.sort(byUpdatedAtDesc),
        reports: reports.sort(byUpdatedAtDesc),
        events: events.sort(byUpdatedAtDesc),
        ordenes_servicio: ordenes_servicio.sort(byUpdatedAtDesc),
        calendar: calendar.sort(byUpdatedAtDesc),
        settings,
        catalog_asset_types,
        isLoading: false,
      });

      logger.info('Store', 'Hidratación completada', {
        assets: assets.length,
        work_orders: work_orders.length,
        preventive_maintenance: preventive_maintenance.length,
        inventory: inventory.length,
        ordenes_servicio: ordenes_servicio.length,
      });
    } catch (error) {
      logger.error('Store', 'Error en hidratación', error);
      set({ isLoading: false });
    }
  },

  setOnline: (status) => set({ isOnline: status }),

  setSyncStatus: (table, uuid, status) => set((state) => {
    const key = table as keyof CMMSState;
    if (!Array.isArray(state[key])) return state;
    return {
      [key]: (state[key] as any[]).map(item =>
        item.uuid_sync === uuid ? { ...item, sync_status: status } : item
      )
    };
  }),

  // — Core table actions —
  addActivo: (activo) => set((state) => ({ assets: [activo, ...state.assets] })),
  updateActivo: (activo) => set((state) => ({
    assets: state.assets.map(a => a.uuid_sync === activo.uuid_sync ? { ...a, ...activo } : a)
  })),
  deleteActivo: (uuid) => set((state) => ({ assets: state.assets.filter(a => a.uuid_sync !== uuid) })),

  addTicket: (ticket) => set((state) => ({ work_orders: [ticket, ...state.work_orders] })),
  updateTicket: (ticket) => set((state) => ({
    work_orders: state.work_orders.map(t => t.uuid_sync === ticket.uuid_sync ? { ...t, ...ticket } : t)
  })),
  deleteTicket: (uuid) => set((state) => ({ work_orders: state.work_orders.filter(t => t.uuid_sync !== uuid) })),

  addMantenimiento: (mant) => set((state) => ({ preventive_maintenance: [mant, ...state.preventive_maintenance] })),
  updateMantenimiento: (mant) => set((state) => ({
    preventive_maintenance: state.preventive_maintenance.map(m => m.uuid_sync === mant.uuid_sync ? { ...m, ...mant } : m)
  })),
  deleteMantenimiento: (uuid) => set((state) => ({
    preventive_maintenance: state.preventive_maintenance.filter(m => m.uuid_sync !== uuid)
  })),

  addUsuario: (user) => set((state) => ({ users: [user, ...state.users] })),
  updateUsuario: (user) => set((state) => ({
    users: state.users.map(u => u.uuid_sync === user.uuid_sync ? { ...u, ...user } : u)
  })),
  deleteUsuario: (uuid) => set((state) => ({ users: state.users.filter(u => u.uuid_sync !== uuid) })),

  addCliente: (client) => set((state) => ({ clients: [client, ...state.clients] })),
  updateCliente: (client) => set((state) => ({
    clients: state.clients.map(c => c.uuid_sync === client.uuid_sync ? { ...c, ...client } : c)
  })),
  deleteCliente: (uuid) => set((state) => ({ clients: state.clients.filter(c => c.uuid_sync !== uuid) })),

  // — Extended table actions —
  addInventario: (item) => set((state) => ({ inventory: [item, ...state.inventory] })),
  updateInventario: (item) => set((state) => ({
    inventory: state.inventory.map(i => i.uuid_sync === item.uuid_sync ? { ...i, ...item } : i)
  })),
  deleteInventario: (uuid) => set((state) => ({ inventory: state.inventory.filter(i => i.uuid_sync !== uuid) })),

  addOrdenServicio: (orden) => set((state) => ({ ordenes_servicio: [orden, ...state.ordenes_servicio] })),
  updateOrdenServicio: (orden) => set((state) => ({
    ordenes_servicio: state.ordenes_servicio.map(o => o.uuid_sync === orden.uuid_sync ? { ...o, ...orden } : o)
  })),
  deleteOrdenServicio: (uuid) => set((state) => ({
    ordenes_servicio: state.ordenes_servicio.filter(o => o.uuid_sync !== uuid)
  })),
}));
