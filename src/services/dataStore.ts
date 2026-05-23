import { EQUIPOS_DATA, Equipo } from "../data/assets";
import { TICKETS_MOCK, Ticket } from "../data/work_orders";
import { MANTENIMIENTOS_MOCK, Mantenimiento } from "../data/preventive_maintenance";

const STORAGE_KEYS = {
  equipos: "cmms:equipos",
  tickets: "cmms:tickets",
  mantenimientos: "cmms:mantenimientos",
  syncQueue: "cmms:syncQueue"
} as const;

export interface PendingSyncOperation {
  id: string;
  type: "report-finalize" | "data-update";
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  status: "pending" | "done";
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(l => l());
}

function parseStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    window.localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Unable to parse storage key ${key}:`, error);
    window.localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function saveStored<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  notify();
}

export const DataStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async sync() {
    console.log("🔄 Starting synchronization...");
    const lastSync = Number(localStorage.getItem("cmms:lastSync") || 0);
    const now = Date.now();

    // 1. Collect local changes (for now we assume everything in localStorage is a potential update)
    // In a more robust system, we'd track dirty flags or a log of operations.
    const equipos = this.getEquipos();
    const tickets = this.getTickets();
    const mantenimientos = this.getMantenimientos();

    const payload = {
      lastSync,
      inserts: [
        ...equipos.map(e => ({ table: 'assets', uuid_sync: e.tag, data: e, updated_at: now })),
        ...tickets.map(t => ({ table: 'work_orders', uuid_sync: t.id, data: t, updated_at: now })),
        ...mantenimientos.map(m => ({ table: 'preventive_maintenance', uuid_sync: m.id, data: m, updated_at: now }))
      ],
      updates: [],
      deletes: []
    };

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Sync failed: ${response.statusText}`);
      
      const result = await response.json();
      console.log("✅ Sync push completed:", result);

      // 2. Fetch updates from server
      for (const table of ['assets', 'work_orders', 'preventive_maintenance']) {
        const res = await fetch(`/api/sync/${table}?since=${lastSync}`);
        if (res.ok) {
          const { data } = await res.json();
          if (data && data.length > 0) {
            this.mergeRemoteData(table, data);
          }
        }
      }

      localStorage.setItem("cmms:lastSync", now.toString());
      notify();
    } catch (error) {
      console.error("❌ Sync error:", error);
    }
  },

  mergeRemoteData(table: string, remoteData: any[]) {
    if (table === 'assets') {
      const local = this.getEquipos();
      const next = [...local];
      remoteData.forEach(r => {
        const index = next.findIndex(e => e.tag === r.tag || e.uuid_sync === r.uuid_sync);
        const remoteUpdated = Number(r.updated_at || 0);
        const localUpdated = index >= 0 ? Number(next[index].updated_at || 0) : -1;

        if (remoteUpdated > localUpdated) {
          const equipo: Equipo = {
            tag: r.tag,
            nombre: r.nombre,
            tipo: r.tipo,
            marca: r.marca,
            modelo: r.modelo,
            serie: r.serie,
            ubicacion: r.ubicacion,
            area: r.area,
            capacidad: r.capacidad,
            voltaje: r.voltaje,
            corriente: r.corriente,
            refrigerante: r.refrigerante,
            fechaInstalacion: r.fecha_instalacion,
            vidaUtil: r.vida_util,
            estado: r.estado,
            ultimoMantenimiento: r.ultimo_mantenimiento,
            proximoMantenimiento: r.proximo_mantenimiento,
            horasOperacion: r.horas_operacion,
            tecnicos: Array.isArray(r.tecnicos) ? r.tecnicos : [],
            notas: r.notas,
            uuid_sync: r.uuid_sync,
            updated_at: remoteUpdated,
            created_at: Number(r.created_at || 0),
            deleted_at: r.deleted_at ? Number(r.deleted_at) : undefined,
            cliente_id: r.cliente_id,
            sucursal_id: r.sucursal_id
          };
          if (index >= 0) next[index] = equipo;
          else next.push(equipo);
        }
      });
      this.saveEquipos(next.filter(e => !e.deleted_at)); // Don't show deleted ones
    } else if (table === 'work_orders' || table === 'preventive_maintenance') {
      const isTickets = table === 'work_orders';
      const local = isTickets ? this.getTickets() : this.getMantenimientos();
      const next = [...local];
      remoteData.forEach(r => {
        const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        const index = next.findIndex((item: any) => item.uuid_sync === r.uuid_sync || item.id === r.id);
        const remoteUpdated = Number(r.updated_at || 0);
        const localUpdated = index >= 0 ? Number((next[index] as any).updated_at || 0) : -1;

        if (remoteUpdated > localUpdated) {
          const item = {
            ...data,
            uuid_sync: r.uuid_sync,
            updated_at: remoteUpdated,
            created_at: Number(r.created_at || 0),
            deleted_at: r.deleted_at ? Number(r.deleted_at) : undefined
          };
          if (index >= 0) next[index] = item;
          else next.push(item);
        }
      });
      if (isTickets) this.saveTickets((next as Ticket[]).filter(t => !t.deleted_at));
      else this.saveMantenimientos((next as Mantenimiento[]).filter(m => !m.deleted_at));
    }
  },

  getEquipos(): Equipo[] {
    return parseStored<Equipo[]>(STORAGE_KEYS.equipos, EQUIPOS_DATA);
  },

  saveEquipos(equipos: Equipo[]) {
    saveStored(STORAGE_KEYS.equipos, equipos);
  },

  updateEquipoStatus(tag: string, status: Equipo["estado"]) {
    const equipos = this.getEquipos();
    const now = Date.now();
    const next = equipos.map(e => e.tag === tag ? { ...e, estado: status, updated_at: now } : e);
    this.saveEquipos(next);
  },

  addEquipo(equipo: Equipo) {
    const equipos = this.getEquipos();
    const now = Date.now();
    const newEquipo = {
      ...equipo,
      uuid_sync: equipo.uuid_sync || equipo.tag || `asset-${now}-${Math.random().toString(36).slice(2, 8)}`,
      updated_at: now,
      created_at: equipo.created_at || now
    };
    const next = [...equipos, newEquipo];
    this.saveEquipos(next);
    return next;
  },

  getTickets(): Ticket[] {
    return parseStored<Ticket[]>(STORAGE_KEYS.tickets, TICKETS_MOCK);
  },

  saveTickets(tickets: Ticket[]) {
    saveStored(STORAGE_KEYS.tickets, tickets);
  },

  addTicket(ticket: Ticket) {
    const tickets = this.getTickets();
    const now = Date.now();
    const newTicket = {
      ...ticket,
      uuid_sync: ticket.uuid_sync || ticket.id || `ticket-${now}-${Math.random().toString(36).slice(2, 8)}`,
      updated_at: now,
      created_at: ticket.created_at || now
    };
    const next = [...tickets, newTicket];
    
    // Regla de Negocio: Si el ticket es una falla, actualizar estado del equipo
    if (newTicket.prioridad === "urgente" || newTicket.estado === "abierto") {
      this.updateEquipoStatus(newTicket.tag, "falla");
    }

    this.saveTickets(next);
    return next;
  },

  getMantenimientos(): Mantenimiento[] {
    return parseStored<Mantenimiento[]>(STORAGE_KEYS.mantenimientos, MANTENIMIENTOS_MOCK);
  },

  saveMantenimientos(mantenimientos: Mantenimiento[]) {
    saveStored(STORAGE_KEYS.mantenimientos, mantenimientos);
  },

  addMantenimiento(mantenimiento: Mantenimiento) {
    // Regla de Negocio: Validar que el equipo existe
    const equipos = this.getEquipos();
    const equipoExists = equipos.some(e => e.tag === mantenimiento.tag);
    
    if (!equipoExists) {
      console.warn(`Intento de agregar mantenimiento a equipo inexistente: ${mantenimiento.tag}`);
    }

    const mantenimientos = this.getMantenimientos();
    const now = Date.now();
    const newMantenimiento = {
      ...mantenimiento,
      uuid_sync: mantenimiento.uuid_sync || mantenimiento.id || `mant-${now}-${Math.random().toString(36).slice(2, 8)}`,
      updated_at: now,
      created_at: mantenimiento.created_at || now
    };
    const next = [...mantenimientos, newMantenimiento];
    
    // Si el mantenimiento se realizó con éxito, el equipo vuelve a operativo si estaba en falla
    if (newMantenimiento.estado === "realizado" || newMantenimiento.estado === "ejecutado") {
      this.updateEquipoStatus(newMantenimiento.tag, "operativo");
    }

    this.saveMantenimientos(next);
    return next;
  },

  getPendingSyncOperations(): PendingSyncOperation[] {
    return parseStored<PendingSyncOperation[]>(STORAGE_KEYS.syncQueue, []);
  },

  savePendingSyncOperations(operations: PendingSyncOperation[]) {
    saveStored(STORAGE_KEYS.syncQueue, operations);
  },

  enqueueSyncOperation(operation: Omit<PendingSyncOperation, "id" | "createdAt" | "updatedAt" | "retryCount" | "status">) {
    const now = new Date().toISOString();
    const nextOperation: PendingSyncOperation = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      status: "pending",
      ...operation
    };

    const operations = this.getPendingSyncOperations();
    this.savePendingSyncOperations([...operations, nextOperation]);
    return nextOperation;
  },

  completeSyncOperation(operationId: string) {
    const operations = this.getPendingSyncOperations();
    const nextOperations = operations.map(operation => {
      if (operation.id !== operationId) return operation;
      return {
        ...operation,
        status: "done",
        updatedAt: new Date().toISOString()
      };
    });

    this.savePendingSyncOperations(nextOperations);
    return nextOperations;
  }
};

export function useDataStore<T>(getter: () => T) {
  const [data, setData] = useState<T>(getter);

  useEffect(() => {
    const unsubscribe = DataStore.subscribe(() => {
      setData(getter());
    });
    return unsubscribe;
  }, [getter]);

  return data;
}
