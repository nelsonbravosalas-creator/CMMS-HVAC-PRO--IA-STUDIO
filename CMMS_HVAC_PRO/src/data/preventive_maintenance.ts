
export interface Mantenimiento {
  id: string;
  tag: string;
  tipo: 'Preventivo' | 'Correctivo' | 'Inspeccion' | 'Instalacion';
  fecha: string;
  estado: 'Programado' | 'Ejecutado' | 'Cerrado' | 'Re-programado'| 'Anulado' | 'Atrasado';
  sucursal: string;
  tecnico: string;
  descripcion: string;
}

export const MANTENIMIENTOS_MOCK: Mantenimiento[] = [
  {
    id: 'PM-201',
    tag: '21-STK.AC.001',
    tipo: 'Preventivo',
    fecha: '2026-04-15',
    estado: 'Ejecutado',
    sucursal: '21-STK',
    tecnico: 'Nelson Bravo',
    descripcion: 'Mantenimiento preventivo trimestral de aire acondicionado central.'
  },
  {
    id: 'PM-202',
    tag: 'Planta-STK.AC.005',
    tipo: 'Correctivo',
    fecha: '2026-03-24',
    estado: 'Ejecutado',
    sucursal: 'Planta-STK',
    tecnico: 'Gonzalo Bravo',
    descripcion: 'Cambio de rodamientos de compresor por desgaste.'
  }
];

