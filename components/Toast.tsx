'use client';

/**
 * Toast global — escuta o evento `fluxo:toast` (disparado pelo
 * `handleError` e `toast()` em `lib/utils/errors.ts`) e renderiza
 * notificações no canto da tela.
 *
 * Inclua UMA instância no `<RootLayout>` (app/layout.tsx) pra ficar
 * disponível em todas as rotas.
 *
 * Stack: max 4 toasts visíveis simultaneamente. Auto-dismiss após
 * `duration` ms (default 5000). Click no toast também fecha.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FLUXO_TOAST_EVENT,
  type ToastDetail,
} from '@/lib/utils/errors';

interface ActiveToast extends ToastDetail {
  id: number;
}

const MAX_STACK = 4;
const DEFAULT_DURATION = 5000;

const levelStyles: Record<ToastDetail['level'], string> = {
  info: 'bg-blue-50 border-blue-300 text-blue-900',
  success: 'bg-green-50 border-green-300 text-green-900',
  warn: 'bg-amber-50 border-amber-300 text-amber-900',
  error: 'bg-red-50 border-red-300 text-red-900',
};

const levelIcons: Record<ToastDetail['level'], string> = {
  info: 'ℹ️',
  success: '✓',
  warn: '⚠️',
  error: '❌',
};

export default function Toast() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    let nextId = 1;
    const onEvt = (e: Event) => {
      const ce = e as CustomEvent<ToastDetail>;
      const id = nextId++;
      const toast: ActiveToast = { ...ce.detail, id };
      setToasts((prev) => [...prev.slice(-MAX_STACK + 1), toast]);
      const duration = toast.duration ?? DEFAULT_DURATION;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    };
    window.addEventListener(FLUXO_TOAST_EVENT, onEvt);
    return () => window.removeEventListener(FLUXO_TOAST_EVENT, onEvt);
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={
            'pointer-events-auto max-w-md text-left text-sm rounded-lg border shadow-md px-3 py-2 cursor-pointer hover:opacity-90 transition-opacity ' +
            levelStyles[t.level]
          }
        >
          <div className="flex items-start gap-2">
            <span className="text-base leading-tight">{levelIcons[t.level]}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium break-words">{t.message}</div>
              {t.detail && (
                <div className="text-xs opacity-70 mt-0.5 break-words">
                  {t.detail}
                </div>
              )}
            </div>
            <span className="text-xs opacity-50">×</span>
          </div>
        </button>
      ))}
    </div>
  );
}
