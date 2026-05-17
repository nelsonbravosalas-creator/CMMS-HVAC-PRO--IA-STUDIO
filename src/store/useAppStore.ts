import { create } from 'zustand';
import { db, LocalActivo, LocalTicket, LocalMantenimiento, LocalUsuario, LocalCliente, LocalSucursal, LocalInforme, LocalEvento, LocalOrdenServicio, SyncStatus } from '../db/database';

interface CMMSState {
  assets: LocalActivo[];
  work_orders: LocalTicket[];
  preventive_maintenance: LocalMantenimiento[];
  users: LocalUsuario[];
  clients: LocalCliente[];
  branches: LocalSucursal[];
  reports: LocalInforme[];
  events: LocalEvento[];
  ordenes_servicio: LocalOrdenServicio[];
  isLoading: boolean;
  isOnline: boolean;

  // Actions
  hydrate: () => Promise<void>;
  setOnline: (status: boolean) => void;
  setSyncStatus: (table: string, uuid: string, status: SyncStatus) => void;
  
  // Optimistic UI updates
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

  addBranch: (branch: LocalSucursal) => void;
  updateBranch: (branch: LocalSucursal) => void;
  deleteBranch: (uuid: string) => void;

  addReport: (report: LocalInforme) => void;
  updateReport: (report: LocalInforme) => void;
  deleteReport: (uuid: string) => void;

  addEvent: (event: LocalEvento) => void;
  updateEvent: (event: LocalEvento) => void;
  deleteEvent: (uuid: string) => void;

  addServiceOrder: (order: LocalOrdenServicio) => void;
  updateServiceOrder: (order: LocalOrdenServicio) => void;
  deleteServiceOrder: (uuid: string) => void;
}

import { logger } from '../lib/logger';

export const useAppStore = create<CMMSState>((set) => ({
  assets: [],
  work_orders: [],
  preventive_maintenance: [],
  users: [],
  clients: [],
  branches: [],
  reports: [],
  events: [],
  ordenes_servicio: [],
  isLoading: true,
  isOnline: navigator.onLine,

  hydrate: async () => {
    set({ isLoading: true });
    logger.info('Store', 'Iniciando hidratación de datos...');
    try {
      const [assets, work_orders, preventive_maintenance, users, clients, branches, reports, events, ordenes_servicio] = await Promise.all([
        db.assets.where('sync_status').notEqual('pending_delete').toArray(),
        db.work_orders.where('sync_status').notEqual('pending_delete').toArray(),
        db.preventive_maintenance.where('sync_status').notEqual('pending_delete').toArray(),
        db.users.where('sync_status').notEqual('pending_delete').toArray(),
        db.clients.where('sync_status').notEqual('pending_delete').toArray(),
        db.branches.where('sync_status').notEqual('pending_delete').toArray(),
        db.reports.where('sync_status').notEqual('pending_delete').toArray(),
        db.events.where('sync_status').notEqual('pending_delete').toArray(),
        db.ordenes_servicio.where('sync_status').notEqual('pending_delete').toArray()
      ]);
      
      set({ 
        assets: assets.sort((a,b) => b.updated_at - a.updated_at), 
        work_orders: work_orders.sort((a,b) => b.updated_at - a.updated_at), 
        preventive_maintenance: preventive_maintenance.sort((a,b) => b.updated_at - a.updated_at), 
        users, 
        clients,
        branches,
        reports: reports.sort((a,b) => b.updated_at - a.updated_at),
        events: events.sort((a,b) => b.updated_at - a.updated_at),
        ordenes_servicio: ordenes_servicio.sort((a,b) => b.updated_at - a.updated_at),
        isLoading: false 
      });

      logger.info('Store', 'Hidratación completada con éxito', { 
        assets: assets.length, 
        work_orders: work_orders.length 
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

  // Domain Actions using functional updates to ensure consistency
  addActivo: (activo) => set((state) => ({ 
    assets: [activo, ...state.assets] 
  })),

  updateActivo: (activo) => set((state) => ({
    assets: state.assets.map(a => a.uuid_sync === activo.uuid_sync ? { ...a, ...activo } : a)
  })),

  deleteActivo: (uuid) => set((state) => ({
    assets: state.assets.filter(a => a.uuid_sync !== uuid)
  })),

  addTicket: (ticket) => set((state) => ({
    work_orders: [ticket, ...state.work_orders]
  })),

  updateTicket: (ticket) => set((state) => ({
    work_orders: state.work_orders.map(t => t.uuid_sync === ticket.uuid_sync ? { ...t, ...ticket } : t)
  })),

  deleteTicket: (uuid) => set((state) => ({
    work_orders: state.work_orders.filter(t => t.uuid_sync !== uuid)
  })),

  addMantenimiento: (mant) => set((state) => ({
    preventive_maintenance: [mant, ...state.preventive_maintenance]
  })),

  updateMantenimiento: (mant) => set((state) => ({
    preventive_maintenance: state.preventive_maintenance.map(m => m.uuid_sync === mant.uuid_sync ? { ...m, ...mant } : m)
  })),

  deleteMantenimiento: (uuid) => set((state) => ({
    preventive_maintenance: state.preventive_maintenance.filter(m => m.uuid_sync !== uuid)
  })),

  addUsuario: (user) => set((state) => ({
    users: [user, ...state.users]
  })),

  updateUsuario: (user) => set((state) => ({
    users: state.users.map(u => u.uuid_sync === user.uuid_sync ? { ...u, ...user } : u)
  })),

  deleteUsuario: (uuid) => set((state) => ({
    users: state.users.filter(u => u.uuid_sync !== uuid)
  })),

  addCliente: (client) => set((state) => ({
    clients: [client, ...state.clients]
  })),

  updateCliente: (client) => set((state) => ({
    clients: state.clients.map(c => c.uuid_sync === client.uuid_sync ? { ...c, ...client } : c)
  })),

  deleteCliente: (uuid) => set((state) => ({
    clients: state.clients.filter(c => c.uuid_sync !== uuid)
  })),

  addBranch: (branch) => set((state) => ({ branches: [branch, ...state.branches] })),
  updateBranch: (branch) => set((state) => ({ branches: state.branches.map(b => b.uuid_sync === branch.uuid_sync ? { ...b, ...branch } : b) })),
  deleteBranch: (uuid) => set((state) => ({ branches: state.branches.filter(b => b.uuid_sync !== uuid) })),

  addReport: (report) => set((state) => ({ reports: [report, ...state.reports] })),
  updateReport: (report) => set((state) => ({ reports: state.reports.map(r => r.uuid_sync === report.uuid_sync ? { ...r, ...report } : r) })),
  deleteReport: (uuid) => set((state) => ({ reports: state.reports.filter(r => r.uuid_sync !== uuid) })),

  addEvent: (event) => set((state) => ({ events: [event, ...state.events] })),
  updateEvent: (event) => set((state) => ({ events: state.events.map(e => e.uuid_sync === event.uuid_sync ? { ...e, ...event } : e) })),
  deleteEvent: (uuid) => set((state) => ({ events: state.events.filter(e => e.uuid_sync !== uuid) })),

  addServiceOrder: (order) => set((state) => ({ ordenes_servicio: [order, ...state.ordenes_servicio] })),
  updateServiceOrder: (order) => set((state) => ({ ordenes_servicio: state.ordenes_servicio.map(o => o.uuid_sync === order.uuid_sync ? { ...o, ...order } : o) })),
  deleteServiceOrder: (uuid) => set((state) => ({ ordenes_servicio: state.ordenes_servicio.filter(o => o.uuid_sync !== uuid) }))
}));
