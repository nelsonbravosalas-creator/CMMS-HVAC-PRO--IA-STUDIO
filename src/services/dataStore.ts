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

  getEquipos(): Equipo[] {
    return parseStored<Equipo[]>(STORAGE_KEYS.equipos, EQUIPOS_DATA);
  },

  saveEquipos(equipos: Equipo[]) {
    saveStored(STORAGE_KEYS.equipos, equipos);
  },

  updateEquipoStatus(tag: string, status: Equipo["estado"]) {
    const equipos = this.getEquipos();
    const next = equipos.map(e => e.tag === tag ? { ...e, estado: status } : e);
    this.saveEquipos(next);
  },

  addEquipo(equipo: Equipo) {
    const equipos = this.getEquipos();
    const next = [...equipos, equipo];
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
    const next = [...tickets, ticket];
    
    // Regla de Negocio: Si el ticket es una falla, actualizar estado del equipo
    if (ticket.prioridad === "urgente" || ticket.estado === "abierto") {
      this.updateEquipoStatus(ticket.tag, "falla");
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
      // Opcional: Podríamos crear el equipo o lanzar error. 
      // Por ahora, permitimos pero registramos la advertencia.
    }

    const mantenimientos = this.getMantenimientos();
    const next = [...mantenimientos, mantenimiento];
    
    // Si el mantenimiento se realizó con éxito, el equipo vuelve a operativo si estaba en falla
    if (mantenimiento.estado === "realizado" || mantenimiento.estado === "ejecutado") {
      this.updateEquipoStatus(mantenimiento.tag, "operativo");
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
