import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLocation } from 'wouter';
import { db } from '../db/database';
import { syncEngine } from '../sync/syncEngine';
import { useSyncStore } from '../store/useSyncStore';
import {
  describePwaUpdateBlock,
  getPwaUpdateBlockReason,
  isProtectedWorkRoute,
  PWA_UPDATE_CHECK_INTERVAL_MS,
  PWA_UPDATE_RETRY_INTERVAL_MS,
  type PwaUpdateBlockReason
} from '../pwa/updatePolicy';

type UpdatePhase = 'idle' | 'checking' | 'syncing' | 'blocked' | 'applying';

function hasOpenBlockingDialog(): boolean {
  return Boolean(document.querySelector('[role="dialog"], dialog[open]'));
}

function hasActiveFormControl(): boolean {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) return false;
  return activeElement.matches('input, textarea, select, [contenteditable="true"]');
}

export function PwaUpdatePrompt() {
  const [location] = useLocation();
  const isSyncing = useSyncStore(state => state.isSyncing);
  const pendingCount = useSyncStore(state => state.pendingCount);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [blockReason, setBlockReason] = useState<PwaUpdateBlockReason | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const attemptingRef = useRef(false);
  const applyingRef = useRef(false);
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_serviceWorkerUrl, serviceWorkerRegistration) {
      setRegistration(serviceWorkerRegistration || null);
    },
    onRegisterError(error) {
      console.error('[pwa] service worker registration failed', error);
    }
  });

  const checkForNewVersion = useCallback(() => {
    if (!registration || !navigator.onLine) return;
    void registration.update().catch(error => {
      console.warn('[pwa] update check failed', error);
    });
  }, [registration]);

  useEffect(() => {
    if (!registration) return;

    checkForNewVersion();
    const interval = window.setInterval(checkForNewVersion, PWA_UPDATE_CHECK_INTERVAL_MS);
    const handleOnline = () => checkForNewVersion();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setDismissed(false);
        checkForNewVersion();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForNewVersion, registration]);

  const attemptSafeUpdate = useCallback(async () => {
    if (!needRefresh || attemptingRef.current || applyingRef.current) return;

    attemptingRef.current = true;
    try {
      setPhase('checking');
      let queuedOperations = await db.sync_queue.count();
      let currentSyncState = useSyncStore.getState().isSyncing;

      if (queuedOperations > 0 && navigator.onLine && !currentSyncState) {
        setPhase('syncing');
        await syncEngine.triggerSync();
        queuedOperations = await db.sync_queue.count();
        currentSyncState = useSyncStore.getState().isSyncing;
      }

      const reason = getPwaUpdateBlockReason({
        pendingOperations: queuedOperations,
        isSyncing: currentSyncState,
        isDocumentVisible: document.visibilityState === 'visible',
        isProtectedRoute: isProtectedWorkRoute(window.location.pathname),
        hasOpenDialog: hasOpenBlockingDialog(),
        hasActiveFormControl: hasActiveFormControl()
      });

      if (reason) {
        setBlockReason(reason);
        setPhase('blocked');
        return;
      }

      applyingRef.current = true;
      setBlockReason(null);
      setDismissed(false);
      setPhase('applying');
      await updateServiceWorker(true);
    } catch (error) {
      applyingRef.current = false;
      setPhase('blocked');
      console.error('[pwa] automatic update failed', error);
    } finally {
      attemptingRef.current = false;
    }
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    if (!needRefresh) {
      applyingRef.current = false;
      setPhase('idle');
      setBlockReason(null);
      return;
    }

    void attemptSafeUpdate();
    const retryInterval = window.setInterval(() => {
      void attemptSafeUpdate();
    }, PWA_UPDATE_RETRY_INTERVAL_MS);
    return () => window.clearInterval(retryInterval);
  }, [attemptSafeUpdate, isSyncing, location, needRefresh, pendingCount]);

  if ((!needRefresh && !offlineReady) || (dismissed && phase !== 'applying')) return null;

  const updateMessage = phase === 'applying'
    ? 'Aplicando la nueva versión. La aplicación se recargará automáticamente.'
    : phase === 'syncing'
      ? 'Sincronizando los cambios locales antes de actualizar.'
      : blockReason
        ? describePwaUpdateBlock(blockReason)
        : 'La nueva versión se aplicará automáticamente cuando sea seguro.';

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
              ? updateMessage
              : 'Los recursos esenciales quedaron guardados en este dispositivo.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {needRefresh && phase !== 'applying' && (
              <button
                type="button"
                onClick={() => {
                  setDismissed(false);
                  void attemptSafeUpdate();
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                <RefreshCw className={`h-4 w-4 ${phase === 'checking' || phase === 'syncing' ? 'animate-spin' : ''}`} />
                Reintentar ahora
              </button>
            )}
            {phase !== 'applying' && (
              <button
                type="button"
                onClick={() => {
                  if (needRefresh) setDismissed(true);
                  setOfflineReady(false);
                }}
                className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {needRefresh ? 'Ocultar aviso' : 'Entendido'}
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
