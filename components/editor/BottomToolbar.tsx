'use client';

import { memo } from 'react';

interface BottomToolbarProps {
  selectMode: boolean;
  onChangeMode: (selectMode: boolean) => void;
}

/**
 * Barra inferior centralizada com modos de interação:
 *  - ✋ Mover (H): drag move o canvas
 *  - ⬚ Selecionar (V): drag faz seleção retangular
 *
 * Atalhos: tecla `H` ativa mão, `V` ativa seleção (registrados no FlowEditor).
 *
 * Wrapped em React.memo — props são simples (boolean + callback) e não mudam
 * a cada render do canvas. Evita re-render quando user move nó/digita texto.
 */
function BottomToolbarImpl({
  selectMode,
  onChangeMode,
}: BottomToolbarProps) {
  return (
    <div
      data-tour="bottom-toolbar"
      className="absolute left-1/2 -translate-x-1/2 bottom-4 z-30 bg-white border border-gray-200 rounded-full shadow-lg flex items-center p-1 gap-1"
    >
      <button
        type="button"
        onClick={() => onChangeMode(false)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition ${
          !selectMode
            ? 'bg-blip-purple text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Mover canvas (atalho: H)"
      >
        <span className="text-base leading-none">✋</span>
        <span>Mover</span>
        <kbd
          className={`ml-1 text-[9px] font-mono px-1 rounded ${
            !selectMode ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
          }`}
        >
          H
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => onChangeMode(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition ${
          selectMode
            ? 'bg-blip-purple text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Selecionar área (atalho: V)"
      >
        <span className="text-base leading-none">⬚</span>
        <span>Selecionar</span>
        <kbd
          className={`ml-1 text-[9px] font-mono px-1 rounded ${
            selectMode ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
          }`}
        >
          V
        </kbd>
      </button>
    </div>
  );
}

const BottomToolbar = memo(BottomToolbarImpl);
export default BottomToolbar;
