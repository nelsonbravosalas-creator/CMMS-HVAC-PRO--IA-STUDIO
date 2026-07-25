import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  CONFIRM_ACTION_EVENT,
  ConfirmActionRequest
} from '../lib/confirmAction';

export function GlobalConfirmDialog() {
  const [request, setRequest] = useState<ConfirmActionRequest | null>(null);

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const nextRequest = (event as CustomEvent<ConfirmActionRequest>).detail;
      setRequest(current => {
        current?.resolve(false);
        return nextRequest;
      });
    };

    window.addEventListener(CONFIRM_ACTION_EVENT, handleRequest);
    return () => window.removeEventListener(CONFIRM_ACTION_EVENT, handleRequest);
  }, []);

  if (!request) return null;

  const finish = (confirmed: boolean) => {
    request.resolve(confirmed);
    setRequest(null);
  };
  const tone = request.options.tone || 'danger';
  const confirmClass = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : tone === 'warning'
      ? 'bg-amber-500 hover:bg-amber-600'
      : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-confirm-title"
      aria-describedby="global-confirm-message"
    >
      <div className="w-full max-w-md rounded-[32px] bg-white p-7 shadow-2xl">
        <div className="mb-5 flex items-start gap-4">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 id="global-confirm-title" className="text-lg font-black uppercase text-slate-900">
              {request.options.title || 'Confirmar acción'}
            </h2>
            <p id="global-confirm-message" className="mt-2 text-sm leading-6 text-slate-600">
              {request.message}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => finish(false)}
            className="rounded-2xl bg-slate-100 px-5 py-3 text-xs font-black uppercase text-slate-600 hover:bg-slate-200"
          >
            {request.options.cancelLabel || 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => finish(true)}
            className={`rounded-2xl px-5 py-3 text-xs font-black uppercase text-white ${confirmClass}`}
          >
            {request.options.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
