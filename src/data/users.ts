export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  perfil: 'visita' | 'tecnico' | 'supervisor' | 'administrador' | 'programador' | 'cliente' | 'contratista';
  activo: boolean;
  puedeEditarMantenimientos: boolean;
  pin: string;
}

export const USUARIOS_MOCK: Usuario[] = [
  {
    id: 'U1',
    nombre: 'Nelson Bravo',
    correo: 'Nbravo.nbyb@gmail.com',
    perfil: 'programador',
    activo: true,
    puedeEditarMantenimientos: true,
    pin: '3517'
  },
  {
    id: 'U2',
    nombre: 'Gonzalo Bravo',
    correo: 'gbravo.nbyb@gmail.com',
    perfil: 'administrador',
    activo: true,
    puedeEditarMantenimientos: true,
    pin: '3210'
  },
  {
    id: 'U3',
    nombre: 'Admin Pruebas',
    correo: 'a@a.cl',
    perfil: 'administrador',
    activo: true,
    puedeEditarMantenimientos: true,
    pin: '1234'
  }
];

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
