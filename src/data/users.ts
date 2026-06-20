export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  perfil: 'visita' | 'tecnico' | 'supervisor' | 'administrador' | 'programador' | 'cliente' | 'contratista';
  activo: boolean;
  puedeEditarMantenimientos: boolean;
}

export const validatePin = async (pinIngresado: string, correo?: string) => {
  if (!navigator.onLine) {
    throw new Error("El inicio de sesión requiere conexión");
  }
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: pinIngresado, correo })
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error("Credenciales inválidas");
  }
  return data;
};

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

