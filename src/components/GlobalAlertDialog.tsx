import { useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';

const ALERT_EVENT = 'cmms-alert-message';

export function GlobalAlertDialog() {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const nativeAlert = window.alert;
    const handleAlert = (event: Event) => {
      const message = String((event as CustomEvent<unknown>).detail ?? '');
      setMessages(current => [...current, message]);
    };

    window.addEventListener(ALERT_EVENT, handleAlert);
    window.alert = (message?: unknown) => {
      window.dispatchEvent(new CustomEvent(ALERT_EVENT, { detail: message }));
    };

    return () => {
      window.alert = nativeAlert;
      window.removeEventListener(ALERT_EVENT, handleAlert);
    };
  }, []);

  const message = messages[0];
  if (message === undefined) return null;

  const dismiss = () => setMessages(current => current.slice(1));

  return (
    <div
      className="fixed inset-0 z-[510] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="global-alert-title"
      aria-describedby="global-alert-message"
    >
      <div className="w-full max-w-md rounded-[32px] bg-white p-7 shadow-2xl">
        <div className="mb-6 flex items-start gap-4">
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
            <CircleAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 id="global-alert-title" className="text-lg font-black uppercase text-slate-900">
              Aviso del sistema
            </h2>
            <p id="global-alert-message" className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
              {message}
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={dismiss}
            className="rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black uppercase text-white hover:bg-blue-700"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
