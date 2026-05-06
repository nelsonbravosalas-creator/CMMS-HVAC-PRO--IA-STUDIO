export interface EventoConsola {
  id: string;
  timestamp: string;
  tipo: 'Operacion' | 'sistema' | 'documento' | 'alerta';
  nivel: 'info' | 'warn' | 'error';
  descripcion: string;
  usuario: string;
}

export const EVENTOS_MOCK: EventoConsola[] = [
  {
    id: 'LOG-101',
    timestamp: '2026-04-24 10:45:12',
    tipo: 'operacion',
    nivel: 'info',
    descripcion: 'Actualización de parámetros técnicos del equipo 21-STK.AC.001',
    usuario: 'Nelson Bravo'
  },
  {
    id: 'LOG-102',
    timestamp: '2026-04-24 10:30:05',
    tipo: 'documento',
    nivel: 'info',
    descripcion: 'Informe INF-402 firmado y bloqueado',
    usuario: 'Gonzalo Bravo'
  }
];
