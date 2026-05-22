'use client';

import { useState } from 'react';
import { ChevronsRight } from 'lucide-react';
import { PALETTE_GROUPS, type PaletteItem } from '@/lib/components/nodes/defaults';
import type { FluxoNodeType } from '@/lib/types';

interface PaletteProps {
  collapsed?: boolean;
  onToggle?: () => void;
  /** Chamado em duplo clique — adiciona o node abaixo do último/selecionado. */
  onAddNode: (type: FluxoNodeType) => void;
}

/**
 * Sidebar esquerda — paleta de componentes agrupados.
 *
 * Cada grupo é colapsável. Cada card é arrastável (drag) ou pode ser
 * adicionado por duplo clique (cria abaixo do último/selecionado).
 */
export default function Palette({ collapsed, onToggle, onAddNode }: PaletteProps) {
  // Acordeão exclusivo: só um grupo aberto por vez. null = todos fechados.
  const [openGroup, setOpenGroup] = useState<string | null>(
    PALETTE_GROUPS[1]?.id ?? null // começa em "Mensagens" aberto
  );

  function handleDragStart(event: React.DragEvent, type: FluxoNodeType) {
    event.dataTransfer.setData('application/fluxo-node-type', type);
    event.dataTransfer.effectAllowed = 'move';
  }

  function toggleGroup(id: string) {
    setOpenGroup((cur) => (cur === id ? null : id));
  }

  if (collapsed) {
    // Modo colapsado: barra finíssima só com o botão de expandir.
    // O espaço ocupado fica ao mínimo pra liberar área do canvas.
    return (
      <aside className="w-full flex-1 min-h-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center pt-2">
        <button
          type="button"
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-blip-purple hover:bg-blip-purple/10 rounded-md transition-colors"
          title="Expandir paleta"
        >
          <ChevronsRight size={14} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      data-tour="palette"
      className="w-full flex-1 min-h-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Componentes</h2>
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 dark:text-gray-500 hover:text-blip-purple text-lg"
          title="Recolher"
        >
          «
        </button>
      </header>

      <p className="text-xs text-gray-500 dark:text-gray-400 px-4 py-2 border-b border-gray-100 dark:border-gray-700">
        Arraste ou clique <strong>duas vezes</strong>
      </p>

      <div className="flex-1 overflow-y-auto min-h-0">
        {PALETTE_GROUPS.map((group) => {
          const isOpen = openGroup === group.id;
          return (
            <div key={group.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <span>{group.title}</span>
                <span className="text-gray-400">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="p-2 space-y-1">
                  {group.items.map((item) => (
                    <PaletteCard
                      key={item.type}
                      item={item}
                      onDragStart={handleDragStart}
                      onDoubleClick={() => onAddNode(item.type)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 space-y-1">
        <div>
          💡 <kbd className="bg-gray-100 dark:bg-gray-800 rounded px-1">Del</kbd> apaga ·{' '}
          <kbd className="bg-gray-100 dark:bg-gray-800 rounded px-1">Ctrl+D</kbd> duplica
        </div>
      </footer>
    </aside>
  );
}

function PaletteCard({
  item,
  onDragStart,
  onDoubleClick,
}: {
  item: PaletteItem;
  onDragStart: (e: React.DragEvent, type: FluxoNodeType) => void;
  onDoubleClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.type)}
      onDoubleClick={onDoubleClick}
      className="flex items-start gap-2.5 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blip-purple dark:hover:border-blip-purple hover:bg-blip-purple/5 dark:hover:bg-blip-purple/15 cursor-grab active:cursor-grabbing transition select-none"
      title="Arraste pro canvas ou clique 2x"
    >
      <span className="text-lg leading-none mt-0.5">{item.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-tight">
          {item.label}
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight mt-0.5">
          {item.description}
        </div>
      </div>
    </div>
  );
}
