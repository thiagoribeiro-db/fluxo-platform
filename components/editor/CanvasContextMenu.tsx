'use client';

/**
 * Menu contextual (right-click) do canvas.
 *
 * Componente "burro" — recebe posição + lista de ações + handler de close.
 * Quem decide o que vai aparecer é o FlowEditor (depende do que está
 * selecionado: 1 nó, multi-select, ou só o pane vazio).
 *
 * Posicionado em fixed via coords do mouse, fecha em:
 *  - click outside
 *  - Esc
 *  - executar uma ação (close auto)
 */

import { useEffect, useRef } from 'react';

export interface ContextMenuAction {
  /** ID estável (analytics + key React). */
  id: string;
  /** Label visível. */
  label: string;
  /** Atalho exibido à direita (ex: "⌘D"). Opcional. */
  shortcut?: string;
  /** Ícone/emoji prefixo. Opcional. */
  icon?: string;
  /** Variante visual — "danger" pinta o item vermelho. */
  variant?: 'default' | 'danger';
  /** Handler. O componente fecha automaticamente depois. */
  onSelect: () => void;
  /** Separador acima desse item. */
  separatorBefore?: boolean;
  /** Desabilita o item. */
  disabled?: boolean;
}

interface CanvasContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function CanvasContextMenu({
  open,
  x,
  y,
  actions,
  onClose,
}: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close em click outside + Esc
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    // setTimeout pra evitar fechar no mesmo tick que abriu (right-click)
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Ajusta posição pra não estourar a viewport
  const W = 240;
  const H = Math.max(actions.length * 36 + 8, 120);
  const safeX = Math.min(x, window.innerWidth - W - 8);
  const safeY = Math.min(y, window.innerHeight - H - 8);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Menu contextual do canvas"
      className="fixed z-[1000] min-w-[220px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      style={{ left: safeX, top: safeY }}
    >
      {actions.map((a) => (
        <div key={a.id}>
          {a.separatorBefore && (
            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          )}
          <button
            type="button"
            role="menuitem"
            disabled={a.disabled}
            onClick={() => {
              a.onSelect();
              onClose();
            }}
            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
              a.disabled
                ? 'cursor-not-allowed text-slate-400 dark:text-slate-600'
                : a.variant === 'danger'
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              {a.icon && <span className="text-base leading-none">{a.icon}</span>}
              <span>{a.label}</span>
            </span>
            {a.shortcut && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {a.shortcut}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
