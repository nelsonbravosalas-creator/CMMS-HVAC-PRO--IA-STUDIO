export interface PwaUpdateSafetyState {
  pendingOperations: number;
  isSyncing: boolean;
  isDocumentVisible: boolean;
  isProtectedRoute: boolean;
  hasOpenDialog: boolean;
  hasActiveFormControl: boolean;
}

export type PwaUpdateBlockReason =
  | 'pending-operations'
  | 'syncing'
  | 'hidden'
  | 'protected-route'
  | 'open-dialog'
  | 'active-form-control';

export const PWA_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
export const PWA_UPDATE_RETRY_INTERVAL_MS = 15 * 1000;

const protectedRoutePatterns = [
  /^\/ordenes-servicio\/(?:nuevo|[^/]+)\/?$/,
  /^\/informes\/(?:nuevo|[^/]+)\/?$/
];

export function isProtectedWorkRoute(pathname: string): boolean {
  return protectedRoutePatterns.some(pattern => pattern.test(pathname));
}

export function getPwaUpdateBlockReason(
  state: PwaUpdateSafetyState
): PwaUpdateBlockReason | null {
  if (state.pendingOperations > 0) return 'pending-operations';
  if (state.isSyncing) return 'syncing';
  if (!state.isDocumentVisible) return 'hidden';
  if (state.isProtectedRoute) return 'protected-route';
  if (state.hasOpenDialog) return 'open-dialog';
  if (state.hasActiveFormControl) return 'active-form-control';
  return null;
}

export function describePwaUpdateBlock(reason: PwaUpdateBlockReason): string {
  switch (reason) {
    case 'pending-operations':
      return 'La actualización se aplicará cuando terminen de sincronizarse los cambios pendientes.';
    case 'syncing':
      return 'La actualización se aplicará cuando finalice la sincronización actual.';
    case 'hidden':
      return 'La actualización se aplicará cuando vuelvas a la aplicación.';
    case 'protected-route':
      return 'Guarda el trabajo y sal de la orden o del informe para aplicar la actualización.';
    case 'open-dialog':
      return 'Cierra la ventana de edición abierta para aplicar la actualización.';
    case 'active-form-control':
      return 'Termina de editar el campo activo para aplicar la actualización.';
  }
}
