'use client';

/**
 * FlowComponentPalette — paleta lateral com botões pra inserir componentes
 * na screen ativa. Agrupado por categoria (texto / visual / input / controle).
 *
 * Cada click chama `onAdd(type)` que delega pro pai criar instância via
 * `createComponent()` e empurrar pro array de components da screen.
 */

import {
  FLOW_COMPONENT_CATALOG,
  type FlowComponentCategory,
} from '@/lib/whatsapp-flows/components';
import type { WhatsAppFlowComponentType } from '@/lib/types';

const CATEGORY_LABELS: Record<FlowComponentCategory, string> = {
  text: 'Texto',
  visual: 'Visual',
  input: 'Inputs',
  control: 'Controle',
};

const CATEGORY_ORDER: FlowComponentCategory[] = ['text', 'visual', 'input', 'control'];

export interface FlowComponentPaletteProps {
  onAdd: (type: WhatsAppFlowComponentType) => void;
  disabled?: boolean;
}

export default function FlowComponentPalette({
  onAdd,
  disabled,
}: FlowComponentPaletteProps) {
  return (
    <div className="px-3 py-2 space-y-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        + Adicionar à tela
      </h3>
      {CATEGORY_ORDER.map((cat) => {
        const items = FLOW_COMPONENT_CATALOG.filter((e) => e.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
              {CATEGORY_LABELS[cat]}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {items.map((entry) => (
                <button
                  key={entry.type}
                  type="button"
                  onClick={() => onAdd(entry.type)}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-left rounded-md border border-gray-200 dark:border-gray-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title={entry.description}
                >
                  <span className="text-xs leading-none w-4 text-center shrink-0">
                    {entry.icon}
                  </span>
                  <span className="truncate text-gray-700 dark:text-gray-200">
                    {entry.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
