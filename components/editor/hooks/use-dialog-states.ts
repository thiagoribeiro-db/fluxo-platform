'use client';

/**
 * Hook que centraliza todos os estados de open/close dos dialogs e painéis
 * do editor.
 *
 * Antes: 16 `useState<boolean>` espalhados no FlowEditor, cada um com seu
 * setter. Agora: 1 hook com API uniforme `dialogs.<name>.opened`,
 * `dialogs.<name>.open()`, `dialogs.<name>.close()`, `dialogs.<name>.toggle()`.
 *
 * Benefícios:
 *  - Menos linhas no FlowEditor (16 useState → 1 hook call)
 *  - API consistente (não confundir `setShareOpen(true)` com `setShare(true)`)
 *  - Possível adicionar features globais (ex: fechar todos os dialogs no Esc,
 *    tracking de qual modal está aberto, etc.)
 *  - Testável isoladamente
 */
import { useCallback, useMemo, useState } from 'react';

/** Nomes canônicos de cada dialog/painel do editor. */
export type DialogKey =
  | 'share'
  | 'template'
  | 'blipExport'
  | 'visualExport'
  | 'comments'
  | 'problems'
  | 'playback'
  | 'commandPalette'
  | 'versions'
  | 'findReplace'
  | 'cheatsheet'
  | 'aiChat'
  | 'skills'
  | 'outline'
  | 'contentTable'
  | 'voiceTone'
  | 'bulkEdit';

export interface DialogControls {
  /** Estado atual (open=true / closed=false). */
  opened: boolean;
  /** Abre o dialog. */
  open: () => void;
  /** Fecha o dialog. */
  close: () => void;
  /** Inverte o estado. */
  toggle: () => void;
  /** Setter direto (compat com APIs Radix que aceitam onOpenChange). */
  setOpen: (next: boolean) => void;
}

export type DialogStates = Record<DialogKey, DialogControls>;

const DIALOG_KEYS: DialogKey[] = [
  'share',
  'template',
  'blipExport',
  'visualExport',
  'comments',
  'problems',
  'playback',
  'commandPalette',
  'versions',
  'findReplace',
  'cheatsheet',
  'aiChat',
  'skills',
  'outline',
  'contentTable',
  'voiceTone',
  'bulkEdit',
];

/**
 * Hook que retorna controles uniformes pra todos os dialogs do editor.
 *
 * Implementação: 1 único `useState` com um objeto de booleans (mais barato
 * que 16 useState separados e re-renderiza só 1x por mudança). Os
 * `DialogControls` retornados são memoizados — referências estáveis entre
 * re-renders, então useEffect/useCallback que dependem deles não disparam
 * por toda mudança.
 */
export function useDialogStates(): DialogStates {
  const [state, setState] = useState<Record<DialogKey, boolean>>(
    () =>
      DIALOG_KEYS.reduce(
        (acc, key) => ({ ...acc, [key]: false }),
        {} as Record<DialogKey, boolean>
      )
  );

  // Helpers estáveis (referência não muda entre renders)
  const setKey = useCallback(
    (key: DialogKey, next: boolean) => {
      setState((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
    },
    []
  );

  const controlsByKey = useMemo<DialogStates>(() => {
    const out: Partial<DialogStates> = {};
    for (const key of DIALOG_KEYS) {
      out[key] = {
        opened: state[key],
        open: () => setKey(key, true),
        close: () => setKey(key, false),
        toggle: () => setKey(key, !state[key]),
        setOpen: (next: boolean) => setKey(key, next),
      };
    }
    return out as DialogStates;
  }, [state, setKey]);

  return controlsByKey;
}
