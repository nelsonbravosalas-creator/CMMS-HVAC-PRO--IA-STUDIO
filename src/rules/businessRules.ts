export const ASSET_STATES = {
  OPERATIVO: 'operativo',
  FALLA: 'falla',
  MANTENIMIENTO: 'mantenimiento',
  BAJA: 'baja'
} as const;

export const TICKET_STATES = {
  ABIERTO: 'abierto',
  ASIGNADO: 'asignado',
  EN_PROCESO: 'en_proceso',
  RESUELTO: 'resuelto',
  CERRADO: 'cerrado',
  CANCELADO: 'cancelado'
} as const;

export const MAINTENANCE_STATES = {
  PROGRAMADO: 'programado',
  EN_PROCESO: 'en_proceso',
  OBSERVADO: 'observado',
  VENCIDO: 'vencido',
  EJECUTADO: 'ejecutado',
  CANCELADO: 'cancelado'
} as const;

export const REPORT_STATES = {
  BORRADOR: 'borrador',
  FIRMADO: 'firmado',
  BLOQUEADO: 'bloqueado',
  ANULADO: 'anulado'
} as const;

export const SERVICE_ORDER_STATES = {
  BORRADOR: 'borrador',
  FIRMADA: 'firmada',
  ENVIADA: 'enviada',
  ANULADA: 'anulada'
} as const;

export const ROLES = {
  ADMINISTRADOR: 'administrador',
  TECNICO_LIDER: 'tecnico_lider',
  INGENIERO_CONFIABILIDAD: 'ingeniero_confiabilidad',
  TECNICO: 'tecnico',
  CLIENTE: 'cliente',
  VISITA: 'visita',
  CONTRATISTA: 'contratista',
  SUPERVISOR: 'supervisor',
  PROGRAMADOR: 'programador'
} as const;

export const PERMISSIONS = {
  puedeDarBajaActivos: (rol: string) => ['administrador', 'tecnico_lider'].includes(rol),
  puedeConfigurarCatalogos: (rol: string) => ['administrador', 'tecnico_lider'].includes(rol),
  puedeCrearTipos: (rol: string) => ['administrador', 'tecnico_lider'].includes(rol),
  puedeCrearClientesSucursales: (rol: string) => ['administrador', 'tecnico_lider'].includes(rol),
  puedeResolverConflictos: (rol: string) => ['administrador'].includes(rol),
  puedeAnularInformes: (rol: string) => ['administrador', 'tecnico_lider'].includes(rol),
  puedeAnularOS: (rol: string) => ['administrador', 'tecnico_lider'].includes(rol),
  puedeGestionarUsuarios: (rol: string) => ['administrador'].includes(rol),
  puedeResetearLocal: (rol: string) => ['administrador'].includes(rol),
};

export const validateTagFormat = (tag: string): boolean => {
  // SUCURSAL.TIPO.###
  const tagRegex = /^[^.]+\.[^.]+\.\d{3}$/;
  return tagRegex.test(tag);
};

export const sanitizeCorrelativo = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 3);
  return digits;
};

export const buildFullTag = (sucursal: string, tipo: string, correlativo: string): string => {
  const numCorrelativo = sanitizeCorrelativo(correlativo);
  return `${sucursal}.${tipo}.${numCorrelativo.padStart(3, '0')}`;
};

export const canTransitionTicket = (currentState: string, targetState: string, rol: string): boolean => {
  // Validations based on transition map in rules.
  if (currentState === TICKET_STATES.ABIERTO) {
    return ([TICKET_STATES.ASIGNADO, TICKET_STATES.CANCELADO] as string[]).includes(targetState);
  }
  if (currentState === TICKET_STATES.ASIGNADO) {
    return ([TICKET_STATES.EN_PROCESO, TICKET_STATES.CANCELADO] as string[]).includes(targetState);
  }
  if (currentState === TICKET_STATES.EN_PROCESO) {
    return ([TICKET_STATES.RESUELTO, TICKET_STATES.CANCELADO] as string[]).includes(targetState);
  }
  if (currentState === TICKET_STATES.RESUELTO) {
    return ([TICKET_STATES.CERRADO, TICKET_STATES.EN_PROCESO] as string[]).includes(targetState);
  }
  return false;
};
