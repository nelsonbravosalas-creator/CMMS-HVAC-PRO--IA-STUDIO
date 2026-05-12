export interface Sucursal {
  id: string;
  nombre: string;
}

export const SUCURSALES: Sucursal[] = [
  { id: '11-STK', nombre: '11-STK - Iquique' },
  { id: '12-STK', nombre: '12-STK - Antofagasta' },
  { id: '13-STK', nombre: '13-STK - Copiapó' },
  { id: '21-STK', nombre: '21-STK - Santiago 14 de la Fama' },
  { id: '21-STK-SB', nombre: '21-STK-SB - BME La Vara 3310' },
  { id: '23-STK', nombre: '23-STK - Viña del Mar' },
  { id: '24-STK', nombre: '24-STK - Rancagua' },
  { id: '31-STK', nombre: '31-STK - Concepción' },
  { id: '32-STK', nombre: '32-STK - Puerto Montt' },
  { id: 'Planta-STK', nombre: 'Planta-STK - Planta Industrial' },
];

export const ALMACEN_LABELS: Record<string, string> = Object.fromEntries(
  SUCURSALES.map(s => [s.id, s.nombre.split(' - ')[1] || s.nombre])
);
