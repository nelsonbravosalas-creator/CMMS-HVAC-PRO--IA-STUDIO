
export interface InformeHVAC {
  id: string;
  tag: string;
  equipoNombre: string;
  fecha: string;
  estado: 'borrador' | 'enviado' | 'firmado' | 'en_revision' | 'bloqueado';
  sucursal: string;
  tecnico: string;
  tipoServicio: string;
}

export const INFORMES_MOCK: InformeHVAC[] = [
  {
    id: 'INF-402',
    tag: '21-STK.AC.001',
    equipoNombre: 'GERENTE DE OPERACIONES',
    fecha: '2026-04-24',
    estado: 'firmado',
    sucursal: 'Santiago B01',
    tecnico: 'Nelson Bravo',
    tipoServicio: 'Preventivo Bimestral'
  },
  {
    id: 'INF-405',
    tag: 'Planta-STK.AC.005',
    equipoNombre: 'Ingenieria',
    fecha: '2026-04-24',
    estado: 'borrador',
    sucursal: 'Santiago B01',
    tecnico: 'Nelson Bravo',
    tipoServicio: 'Correctivo'
  }
];
