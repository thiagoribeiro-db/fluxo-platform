'use client';

/**
 * Host global de dialogs internos (confirm/prompt).
 *
 * Substitui `window.confirm` / `window.prompt` (que viram dialogs nativos
 * do browser — ruins esteticamente e indisponíveis em ambientes empacotados
 * como Electron/Tauri).
 *
 * Implementação: usa Radix Dialog (via `components/ui/dialog.tsx`) que dá
 * focus trap, ESC, ARIA, backdrop click — tudo de graça.
 *
 * Escuta o evento `fluxo:dialog` (disparado por `confirmDialog`/`promptDialog`
 * de `lib/utils/dialog.ts`) e renderiza o modal. Resolve a Promise via
 * `fluxo:dialog-resolve` quando o usuário confirma/cancela.
 *
 * Mantém UMA fila — apenas um dialog visível por vez. Se outro for disparado
 * enquanto este está aberto, fica na fila e abre quando o atual fechar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FLUXO_DIALOG_EVENT,
  FLUXO_DIALOG_RESOLVE_EVENT,
  type ConfirmDialogOpts,
  type DialogRequest,
  type DialogResolvePayload,
  type PromptDialogOpts,
} from '@/lib/utils/dialog';

function isPromptOpts(
  req: DialogRequest
): req is DialogRequest & { kind: 'prompt'; opts: PromptDialogOpts } {
  return req.kind === 'prompt';
}

function isConfirmOpts(
  req: DialogRequest
): req is DialogRequest & { kind: 'confirm'; opts: ConfirmDialogOpts } {
  return req.kind === 'confirm';
}

const variantBtnClass: Record<NonNullable<ConfirmDialogOpts['variant']>, string> = {
  default: 'bg-blip-purple text-white hover:bg-blip-purple-dark focus:ring-blip-purple/40',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/40',
  success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500/40',
};

export default function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const current = queue[0];
  const isOpen = Boolean(current);

  const resolve = useCallback(
    (id: number, result: boolean | string | null) => {
      const payload: DialogResolvePayload = { id, result };
      window.dispatchEvent(
        new CustomEvent<DialogResolvePayload>(FLUXO_DIALOG_RESOLVE_EVENT, { detail: payload })
      );
      setQueue((prev) => prev.filter((q) => q.id !== id));
    },
    []
  );

  // Inscrição no evento de request
  useEffect(() => {
    const onEvt = (e: Event) => {
      const ce = e as CustomEvent<DialogRequest>;
      setQueue((prev) => [...prev, ce.detail]);
    };
    window.addEventListener(FLUXO_DIALOG_EVENT, onEvt);
    return () => window.removeEventListener(FLUXO_DIALOG_EVENT, onEvt);
  }, []);

  // Reset input value quando um novo prompt vira o topo da fila
  useEffect(() => {
    if (!current) {
      setInputValue('');
      return;
    }
    if (isPromptOpts(current)) {
      setInputValue(current.opts.defaultValue ?? '');
    }
  }, [current]);

  if (!current) return null;

  const handleCancel = () => {
    resolve(current.id, isPromptOpts(current) ? null : false);
  };

  const handleConfirm = () => {
    if (isPromptOpts(current)) {
      const required = current.opts.required !== false;
      const trimmed = inputValue.trim();
      if (required && !trimmed) {
        inputRef.current?.focus();
        return;
      }
      resolve(current.id, trimmed);
    } else {
      resolve(current.id, true);
    }
  };

  const opts = current.opts;
  const title = opts.title;
  const message = opts.message;
  const confirmText = opts.confirmText ?? 'OK';
  const cancelText = opts.cancelText ?? 'Cancelar';
  const variant: NonNullable<ConfirmDialogOpts['variant']> = isConfirmOpts(current)
    ? current.opts.variant ?? 'default'
    : 'default';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Radix chama com false em ESC, click no backdrop ou click no X
        if (!open) handleCancel();
      }}
    >
      <DialogContent hideClose>
        <DialogHeader>
          {title && <DialogTitle>{title}</DialogTitle>}
          <DialogDescription className={title ? 'mt-2' : ''}>
            {message}
          </DialogDescription>

          {isPromptOpts(current) && (
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={current.opts.placeholder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              className="mt-3 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blip-purple/40 focus:border-blip-purple"
            />
          )}
        </DialogHeader>

        <DialogFooter>
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            autoFocus={!isPromptOpts(current)}
            className={
              'px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ' +
              variantBtnClass[variant]
            }
          >
            {confirmText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
