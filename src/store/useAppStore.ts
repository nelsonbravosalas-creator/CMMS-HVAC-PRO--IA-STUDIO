import { create } from 'zustand';
import { db, LocalActivo, LocalTicket, LocalMantenimiento, LocalUsuario, LocalCliente, LocalSucursal, SyncStatus } from '../db/database';

interface CMMSState {
  assets: LocalActivo[];
  work_orders: LocalTicket[];
  preventive_maintenance: LocalMantenimiento[];
  users: LocalUsuario[];
  clients: LocalCliente[];
  branches: LocalSucursal[];
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
}

import { logger } from '../lib/logger';

export const useAppStore = create<CMMSState>((set) => ({
  assets: [],
  work_orders: [],
  preventive_maintenance: [],
  users: [],
  clients: [],
  branches: [],
  isLoading: true,
  isOnline: navigator.onLine,

  hydrate: async () => {
    set({ isLoading: true });
    logger.info('Store', 'Iniciando hidratación de datos...');
    try {
      const [assets, work_orders, preventive_maintenance, users, clients, branches] = await Promise.all([
        db.assets.filter(record => record.sync_status !== 'pending_delete' && !record.deleted_at).toArray(),
        db.work_orders.filter(record => record.sync_status !== 'pending_delete' && !record.deleted_at).toArray(),
        db.preventive_maintenance.filter(record => record.sync_status !== 'pending_delete' && !record.deleted_at).toArray(),
        db.users.filter(record => record.sync_status !== 'pending_delete' && !record.deleted_at).toArray(),
        db.clients.filter(record => record.sync_status !== 'pending_delete' && !record.deleted_at).toArray(),
        db.branches.filter(record => record.sync_status !== 'pending_delete' && !record.deleted_at).toArray()
      ]);
      
      set({ 
        assets: assets.sort((a,b) => b.updated_at - a.updated_at), 
        work_orders: work_orders.sort((a,b) => b.updated_at - a.updated_at), 
        preventive_maintenance: preventive_maintenance.sort((a,b) => b.updated_at - a.updated_at), 
        users, 
        clients, 
        branches,
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
  }))
}));
