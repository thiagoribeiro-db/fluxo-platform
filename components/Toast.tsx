'use client';

/**
 * Toast global — ponte entre o sistema interno (CustomEvent `fluxo:toast`
 * disparado por `handleError`/`toast()` em `lib/utils/errors.ts`) e o
 * Sonner (lib de toasts recomendada pelo shadcn).
 *
 * O CustomEvent foi mantido como API interna pra:
 *  - Não quebrar os ~30 callers existentes (`toast({ level, message })`)
 *  - Permitir disparar toast de qualquer lugar sem importar Sonner
 *  - Facilitar testes (basta dispatch um evento)
 *
 * Aqui só fazemos: escuta evento → chama `sonner.toast.<level>()`.
 *
 * Inclua UMA instância no `<RootLayout>` junto com `<Toaster />` da Sonner.
 */
import { useEffect } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';
import { FLUXO_TOAST_EVENT, type ToastDetail } from '@/lib/utils/errors';

export default function Toast() {
  useEffect(() => {
    const onEvt = (e: Event) => {
      const ce = e as CustomEvent<ToastDetail>;
      const { level, message, detail, duration } = ce.detail;
      const opts: { description?: string; duration?: number } = {};
      if (detail) opts.description = detail;
      if (duration && duration > 0) opts.duration = duration;

      switch (level) {
        case 'success':
          sonnerToast.success(message, opts);
          break;
        case 'error':
          sonnerToast.error(message, opts);
          break;
        case 'warn':
          sonnerToast.warning(message, opts);
          break;
        case 'info':
        default:
          sonnerToast.info(message, opts);
          break;
      }
    };
    window.addEventListener(FLUXO_TOAST_EVENT, onEvt);
    return () => window.removeEventListener(FLUXO_TOAST_EVENT, onEvt);
  }, []);

  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      expand
      duration={5000}
      toastOptions={{
        classNames: {
          toast: 'shadow-md',
        },
      }}
    />
  );
}
