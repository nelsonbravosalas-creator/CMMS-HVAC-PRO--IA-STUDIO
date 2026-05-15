
export interface Mantenimiento {
  id: string;
  tag: string;
  tipo: 'preventivo' | 'correctivo' | 'inspeccion' | 'instalacion';
  fecha: string;
  estado: 'programado' | 'ejecutado' | 'realizado' | 're-programado'| 'anulado' | 'atrasado';
  sucursal: string;
  tecnico: string;
  descripcion: string;
}

export const MANTENIMIENTOS_MOCK: Mantenimiento[] = [
  {
    id: 'M-001',
    tag: '21-STK.AC.001',
    tipo: 'preventivo',
    fecha: '2026-04-20',
    estado: 'realizado',
    sucursal: 'Santiago B01',
    tecnico: 'Nelson Bravo',
    descripcion: 'Limpieza de filtros y revisión de presiones.'
  },
  {
    id: 'M-002',
    tag: 'Planta-STK.AC.001',
    tipo: 'correctivo',
    fecha: '2026-04-25',
    estado: 'programado',
    sucursal: 'Santiago B01',
    tecnico: 'Gonzalo Bravo',
    descripcion: 'Recarga de refrigerante por fuga menor.'
  }
];
