/**
 * Dialogs internos (substitui `window.prompt` / `window.confirm` / `window.alert`).
 *
 * Por que: o objetivo do projeto é virar um app standalone (Electron/Tauri),
 * onde os dialogs nativos do navegador não existem ou ficam estranhos.
 * Também: a UI interna combina visualmente com o resto da aplicação.
 *
 * USO:
 *   import { confirmDialog, promptDialog } from '@/lib/utils/dialog';
 *
 *   const ok = await confirmDialog({
 *     title: 'Apagar página',
 *     message: 'Tem certeza? Essa ação não pode ser desfeita.',
 *     confirmText: 'Apagar',
 *     variant: 'danger',
 *   });
 *
 *   const name = await promptDialog({
 *     title: 'Nova página',
 *     message: 'Nome da nova página:',
 *     placeholder: 'ex: dev, hmg, prd',
 *     defaultValue: 'Nova página',
 *   });
 *   if (name === null) return; // user cancelou
 *
 * Internamente:
 *   - Dispara CustomEvent('fluxo:dialog') com o request
 *   - O <DialogHost /> global escuta, renderiza modal, resolve via outro event
 *   - Promise resolve com o resultado (string|null pra prompt, boolean pra confirm)
 *
 * Pra alert/notificação simples → use `toast()` de `errors.ts`.
 */

export const FLUXO_DIALOG_EVENT = 'fluxo:dialog';
export const FLUXO_DIALOG_RESOLVE_EVENT = 'fluxo:dialog-resolve';

export type DialogVariant = 'default' | 'danger' | 'success';

export interface ConfirmDialogOpts {
  /** Título do dialog (header bold). Opcional. */
  title?: string;
  /** Mensagem principal (pode ter \n pra quebras de linha). */
  message: string;
  /** Texto do botão de confirmação. Default: "OK". */
  confirmText?: string;
  /** Texto do botão de cancelar. Default: "Cancelar". */
  cancelText?: string;
  /** Variante visual do confirm (default azul, danger vermelho, success verde). */
  variant?: DialogVariant;
}

export interface PromptDialogOpts {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  /** Se true, valida que o input não está vazio antes de aceitar. Default: true. */
  required?: boolean;
}

/**
 * Internal — payload do request enviado ao <DialogHost />.
 * Não é parte da API pública (esses tipos são re-usados pelo Host).
 */
export interface DialogRequest {
  id: number;
  kind: 'confirm' | 'prompt';
  opts: ConfirmDialogOpts | PromptDialogOpts;
}

export interface DialogResolvePayload {
  id: number;
  /** Pra confirm: boolean. Pra prompt: string (OK) ou null (cancelar). */
  result: boolean | string | null;
}

let nextId = 1;

function nextRequestId(): number {
  return nextId++;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Mostra um confirm modal. Retorna `true` se o usuário clicou no botão de
 * confirmação, `false` se cancelou (ou fechou via ESC/click fora).
 */
export function confirmDialog(opts: ConfirmDialogOpts): Promise<boolean> {
  if (!isBrowser()) return Promise.resolve(false);
  const id = nextRequestId();
  return new Promise<boolean>((resolve) => {
    const onResolve = (e: Event) => {
      const ce = e as CustomEvent<DialogResolvePayload>;
      if (ce.detail.id !== id) return;
      window.removeEventListener(FLUXO_DIALOG_RESOLVE_EVENT, onResolve);
      resolve(Boolean(ce.detail.result));
    };
    window.addEventListener(FLUXO_DIALOG_RESOLVE_EVENT, onResolve);
    const req: DialogRequest = { id, kind: 'confirm', opts };
    window.dispatchEvent(new CustomEvent<DialogRequest>(FLUXO_DIALOG_EVENT, { detail: req }));
  });
}

/**
 * Mostra um prompt modal (input texto). Retorna a string digitada ou `null`
 * se o usuário cancelou.
 */
export function promptDialog(opts: PromptDialogOpts): Promise<string | null> {
  if (!isBrowser()) return Promise.resolve(null);
  const id = nextRequestId();
  return new Promise<string | null>((resolve) => {
    const onResolve = (e: Event) => {
      const ce = e as CustomEvent<DialogResolvePayload>;
      if (ce.detail.id !== id) return;
      window.removeEventListener(FLUXO_DIALOG_RESOLVE_EVENT, onResolve);
      const r = ce.detail.result;
      resolve(typeof r === 'string' ? r : null);
    };
    window.addEventListener(FLUXO_DIALOG_RESOLVE_EVENT, onResolve);
    const req: DialogRequest = { id, kind: 'prompt', opts };
    window.dispatchEvent(new CustomEvent<DialogRequest>(FLUXO_DIALOG_EVENT, { detail: req }));
  });
}
