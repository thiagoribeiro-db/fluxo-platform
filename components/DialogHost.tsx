'use client';

/**
 * Host global de dialogs internos (confirm/prompt).
 *
 * Substitui `window.confirm` / `window.prompt` (que viram dialogs nativos
 * do browser, ruins esteticamente e indisponíveis em ambientes empacotados
 * como Electron/Tauri).
 *
 * Escuta o evento `fluxo:dialog` (disparado por `confirmDialog`/`promptDialog`
 * de `lib/utils/dialog.ts`) e renderiza o modal. Resolve a Promise via outro
 * evento `fluxo:dialog-resolve` quando o usuário confirma/cancela.
 *
 * Mantém UMA fila — apenas um dialog visível por vez. Se outro for disparado
 * enquanto este está aberto, fica na fila e abre quando o atual fechar.
 *
 * Inclua UMA instância no `<RootLayout>` (app/layout.tsx).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
  default: 'bg-blip-purple text-white hover:bg-blip-purple-dark',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-green-600 text-white hover:bg-green-700',
};

export default function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const okBtnRef = useRef<HTMLButtonElement>(null);

  const current = queue[0];

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

  // Reset do input value + autofocus quando um novo prompt vira o topo da fila
  useEffect(() => {
    if (!current) {
      setInputValue('');
      return;
    }
    if (isPromptOpts(current)) {
      setInputValue(current.opts.defaultValue ?? '');
      // Focus + select no próximo tick (depois do render)
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.select();
        }
      }, 10);
    } else {
      setTimeout(() => okBtnRef.current?.focus(), 10);
    }
  }, [current]);

  // ESC pra cancelar
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolve(current.id, isPromptOpts(current) ? null : false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, resolve]);

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
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        // Click no backdrop = cancelar
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'fluxo-dialog-title' : undefined}
        className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-auto overflow-hidden"
      >
        <div className="px-5 py-4">
          {title && (
            <h2
              id="fluxo-dialog-title"
              className="text-base font-semibold text-gray-900 mb-2"
            >
              {title}
            </h2>
          )}
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
            {message}
          </p>

          {isPromptOpts(current) && (
            <input
              ref={inputRef}
              type="text"
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
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            {cancelText}
          </button>
          <button
            ref={okBtnRef}
            type="button"
            onClick={handleConfirm}
            className={
              'px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 ' +
              variantBtnClass[variant]
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
