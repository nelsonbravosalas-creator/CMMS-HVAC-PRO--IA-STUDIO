import { create } from 'zustand';
import { db, LocalActivo, LocalTicket, LocalMantenimiento, SyncStatus } from '../lib/dbLocal';

interface CMMSState {
  activos: LocalActivo[];
  tickets: LocalTicket[];
  mantenimientos: LocalMantenimiento[];
  usuarios: LocalUsuario[];
  clientes: LocalCliente[];
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

export const useCMMSStore = create<CMMSState>((set) => ({
  activos: [],
  tickets: [],
  mantenimientos: [],
  usuarios: [],
  clientes: [],
  isLoading: true,
  isOnline: navigator.onLine,

  hydrate: async () => {
    set({ isLoading: true });
    const [activos, tickets, mantenimientos, usuarios, clientes] = await Promise.all([
      db.activos.where('sync_status').notEqual('pending_delete').toArray(),
      db.tickets.where('sync_status').notEqual('pending_delete').toArray(),
      db.mantenimientos.where('sync_status').notEqual('pending_delete').toArray(),
      db.usuarios.where('sync_status').notEqual('pending_delete').toArray(),
      db.clientes.where('sync_status').notEqual('pending_delete').toArray()
    ]);
    set({ activos, tickets, mantenimientos, usuarios, clientes, isLoading: false });
  },

  setOnline: (status) => set({ isOnline: status }),

  setSyncStatus: (table, uuid, status) => set((state) => {
    const key = table as keyof CMMSState;
    if (!Array.isArray(state[key])) return state;
    
    return {
      [key]: (state[key] as any[]).map(item => 
        item.uuid_sincro === uuid ? { ...item, sync_status: status } : item
      )
    };
  }),

  addActivo: (activo) => set((state) => ({ 
    activos: [activo, ...state.activos] 
  })),

  updateActivo: (activo) => set((state) => ({
    activos: state.activos.map(a => a.uuid_sincro === activo.uuid_sincro ? activo : a)
  })),

  deleteActivo: (uuid) => set((state) => ({
    activos: state.activos.filter(a => a.uuid_sincro !== uuid)
  })),

  addTicket: (ticket) => set((state) => ({
    tickets: [ticket, ...state.tickets]
  })),

  updateTicket: (ticket) => set((state) => ({
    tickets: state.tickets.map(t => t.uuid_sincro === ticket.uuid_sincro ? ticket : t)
  })),

  deleteTicket: (uuid) => set((state) => ({
    tickets: state.tickets.filter(t => t.uuid_sincro !== uuid)
  })),

  addMantenimiento: (mant) => set((state) => ({
    mantenimientos: [mant, ...state.mantenimientos]
  })),

  updateMantenimiento: (mant) => set((state) => ({
    mantenimientos: state.mantenimientos.map(m => m.uuid_sincro === mant.uuid_sincro ? mant : m)
  })),

  deleteMantenimiento: (uuid) => set((state) => ({
    mantenimientos: state.mantenimientos.filter(m => m.uuid_sincro !== uuid)
  })),

  addUsuario: (user) => set((state) => ({
    usuarios: [user, ...state.usuarios]
  })),

  updateUsuario: (user) => set((state) => ({
    usuarios: state.usuarios.map(u => u.uuid_sincro === user.uuid_sincro ? user : u)
  })),

  deleteUsuario: (uuid) => set((state) => ({
    usuarios: state.usuarios.filter(u => u.uuid_sincro !== uuid)
  })),

  addCliente: (client) => set((state) => ({
    clientes: [client, ...state.clientes]
  })),

  updateCliente: (client) => set((state) => ({
    clientes: state.clientes.map(c => c.uuid_sincro === client.uuid_sincro ? client : c)
  })),

  deleteCliente: (uuid) => set((state) => ({
    clientes: state.clientes.filter(c => c.uuid_sincro !== uuid)
  }))
}));
