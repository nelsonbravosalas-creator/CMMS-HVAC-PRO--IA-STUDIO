import { RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('[pwa] service worker registration failed', error);
    }
  });

  if (!needRefresh && !offlineReady) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-24 z-[200] mx-auto max-w-md rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl dark:border-blue-900 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        {needRefresh
          ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          : <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 dark:text-white">
            {needRefresh ? 'Actualización disponible' : 'Aplicación lista para uso sin conexión'}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {needRefresh
              ? 'Actualiza ahora para aplicar la versión y los parches de seguridad más recientes.'
              : 'Los recursos esenciales quedaron guardados en este dispositivo.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {needRefresh && (
              <button
                type="button"
                onClick={() => void updateServiceWorker(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                <RefreshCw className="h-4 w-4" /> Actualizar ahora
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setNeedRefresh(false);
                setOfflineReady(false);
              }}
              className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              {needRefresh ? 'Más tarde' : 'Entendido'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
