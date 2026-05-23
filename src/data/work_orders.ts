
export interface Ticket {
  id: string;
  tag: string;
  titulo: string;
  descripcion: string;
  tipo: 'falla' | 'inspeccion' | 'consulta';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  estado: 'abierto' | 'en_proceso' | 'resuelto' | 're_asignado';
  creador: string;
  asignado: string;
  fecha: string;
  notas: string;
  uuid_sync?: string;
  updated_at?: number;
  created_at?: number;
  deleted_at?: number;
}

export const TICKETS_MOCK: Ticket[] = [
  {
    id: 'TK-1002',
    tag: '21-STK.AC.010',
    titulo: 'Ruido excesivo en unidad exterior',
    descripcion: 'Se reporta ruido metálico al arrancar el compresor.',
    tipo: 'falla',
    prioridad: 'alta',
    estado: 'abierto',
    creador: 'Supervisor Planta',
    asignado: 'Nelson Bravo',
    fecha: '2026-04-23',
    notas: 'Requiere revisión de rodamientos.'
  }
];
