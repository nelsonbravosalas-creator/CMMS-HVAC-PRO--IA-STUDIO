export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  perfil: 'visita' | 'tecnico' | 'supervisor' | 'administrador' | 'programador' | 'cliente' | 'contratista';
  activo: boolean;
  puedeEditarMantenimientos: boolean;
  pin: string;
}
export interface Cliente {
  id: string;
  nombre: string;
  rut: string;
  plan: 'basico' | 'premium' | 'enterprise';
  activo: boolean;
  usuariosIds: string[];
}

export const CLIENTES_MOCK: Cliente[] = [
  {
    id: 'C1',
    nombre: 'EECOL ELECTRIC',
    rut: '78.928.030-4',
    plan: 'enterprise',
    activo: true,
    usuariosIds: ['U1', 'U2']
  }
];
