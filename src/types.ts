
/**
 * Definiciones de tipos globales y sistema de control de acceso (RBAC).
 * 
 * @module types
 */

/** 
 * Perfiles de usuario disponibles en el sistema.
 * Determinan el nivel de acceso y las funcionalidades habilitadas.
 */
export type Perfil = 'visita' | 'tecnico' | 'supervisor' | 'administrador' | 'cliente' | 'contratista';

/**
 * Matriz de capacidades funcionales.
 * Cada booleano activa o desactiva componentes/acciones en la UI.
 */
export interface Permisos {
  ver_dashboard: boolean;
  ver_mantenimientos: boolean;
  ver_informes: boolean;
  crear_informe: boolean;
  crear_ticket: boolean;
  ver_reportes: boolean;
  gestionar_usuarios: boolean;
  crear_equipo: boolean;
  crear_mantenimiento: boolean;
  crear_orden_servicio: boolean;
  puedeEditarMantenimientos: boolean;
  ver_historial: boolean;
  ver_specs: boolean;
  ver_ubicacion: boolean;
}

/**
 * Objeto Usuario con sus atributos de identidad y perfil.
 */
export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  perfil: Perfil;
  activo: boolean;
  puedeEditarMantenimientos: boolean;
  cliente_id?: string;
  cliente_ids?: string[];
  requiere_cambio_pin?: boolean;
}

/**
 * Configuración maestra de permisos por perfil.
 * Este objeto es la fuente de verdad para el renderizado condicional de la UI.
 */
export const PERMISOS_POR_PERFIL: Record<Perfil, Permisos> = {
  visita: {
    ver_dashboard: true, ver_mantenimientos: true, ver_informes: true,
    crear_informe: false, crear_ticket: false, ver_reportes: false,
    gestionar_usuarios: false, crear_equipo: false, crear_mantenimiento: false,
    crear_orden_servicio: false,
    puedeEditarMantenimientos: false, ver_historial: true, ver_specs: true, ver_ubicacion: true
  },
  cliente: {
    ver_dashboard: true, ver_mantenimientos: false, ver_informes: true,
    crear_informe: false, crear_ticket: true, ver_reportes: true,
    gestionar_usuarios: false, crear_equipo: false, crear_mantenimiento: false,
    crear_orden_servicio: false,
    puedeEditarMantenimientos: false, ver_historial: true, ver_specs: false, ver_ubicacion: false
  },
  contratista: {
    ver_dashboard: true, ver_mantenimientos: true, ver_informes: true,
    crear_informe: true, crear_ticket: true, ver_reportes: false,
    gestionar_usuarios: false, crear_equipo: false, crear_mantenimiento: true,
    crear_orden_servicio: true,
    puedeEditarMantenimientos: true, ver_historial: true, ver_specs: true, ver_ubicacion: true
  },
  tecnico: {
    ver_dashboard: true, ver_mantenimientos: true, ver_informes: true,
    crear_informe: true, crear_ticket: true, ver_reportes: false,
    gestionar_usuarios: false, crear_equipo: false, crear_mantenimiento: true,
    crear_orden_servicio: true,
    puedeEditarMantenimientos: true, ver_historial: true, ver_specs: true, ver_ubicacion: true
  },
  supervisor: {
    ver_dashboard: true, ver_mantenimientos: true, ver_informes: true,
    crear_informe: true, crear_ticket: true, ver_reportes: true,
    gestionar_usuarios: false, crear_equipo: true, crear_mantenimiento: true,
    crear_orden_servicio: true,
    puedeEditarMantenimientos: true, ver_historial: true, ver_specs: true, ver_ubicacion: true
  },
  administrador: {
    ver_dashboard: true, ver_mantenimientos: true, ver_informes: true,
    crear_informe: true, crear_ticket: true, ver_reportes: true,
    gestionar_usuarios: true, crear_equipo: true, crear_mantenimiento: true,
    crear_orden_servicio: true,
    puedeEditarMantenimientos: true, ver_historial: true, ver_specs: true, ver_ubicacion: true
  }
};
