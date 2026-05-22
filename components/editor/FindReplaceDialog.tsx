'use client';

/**
 * Find & Replace bulk — modal compacto pra substituir texto em todos
 * os nodes da página atual.
 *
 * UX:
 *  - Input "Buscar" com contador de matches em tempo real
 *  - Input "Substituir por"
 *  - Checkbox "Case-sensitive"
 *  - Preview: lista até 10 nodes afetados com código + snippet
 *  - Botão "Substituir tudo" exige confirmação se > 20 mudanças
 *  - Atalhos: ESC fecha, Enter substitui
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Replace, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import { findInNodes, replaceInNodes } from '@/lib/utils/find-replace';
import { confirmDialog } from '@/lib/utils/dialog';
import { toast } from '@/lib/utils/errors';

interface FindReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: FluxoNode[];
  edges: Edge[];
  /** Aplica as mudanças no canvas. Pai geralmente faz pushHistory antes. */
  onApply: (nextNodes: FluxoNode[]) => void;
  /** Pra navegar até o node clicado na lista de matches. */
  onJumpToNode?: (nodeId: string) => void;
}

export default function FindReplaceDialog({
  open,
  onOpenChange,
  nodes,
  onApply,
  onJumpToNode,
}: FindReplaceDialogProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Pequeno delay pra Radix terminar a animação de entrada
      setTimeout(() => findInputRef.current?.focus(), 50);
    }
  }, [open]);

  const matches = useMemo(() => {
    return findInNodes(nodes, query.trim(), { matchCase });
  }, [nodes, query, matchCase]);

  const totalOccurrences = useMemo(
    () => matches.reduce((sum, m) => sum + m.count, 0),
    [matches]
  );

  const handleReplace = async () => {
    if (!query.trim() || matches.length === 0) return;
    const total = totalOccurrences;
    if (total > 20) {
      const ok = await confirmDialog({
        title: 'Confirmar substituição em massa',
        message: `Você está prestes a substituir ${total} ocorrências em ${matches.length} blocos. Isso não pode ser desfeito sem Ctrl+Z.`,
        confirmText: 'Substituir tudo',
        variant: 'danger',
      });
      if (!ok) return;
    }
    const result = replaceInNodes(nodes, query.trim(), replacement, { matchCase });
    onApply(result.nodes);
    toast({
      level: 'success',
      message: `${result.totalReplacements} substituiç${result.totalReplacements === 1 ? 'ão' : 'ões'} em ${result.affectedNodeIds.length} bloco${result.affectedNodeIds.length === 1 ? '' : 's'}`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-lg">
        {/* Header custom — compacto */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Search size={16} className="text-blip-purple shrink-0" />
          <h2 className="font-semibold text-sm text-gray-900 dark:text-white flex-1">
            Buscar e substituir
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Fechar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Inputs */}
        <div className="px-4 py-3 space-y-2">
          <input
            ref={findInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blip-purple/40 focus:border-blip-purple"
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Substituir por…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleReplace();
                }
              }}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blip-purple/40 focus:border-blip-purple"
            />
            <button
              type="button"
              onClick={handleReplace}
              disabled={matches.length === 0}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-blip-purple hover:bg-blip-purple-dark disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              <Replace size={14} /> Substituir tudo
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => setMatchCase(e.target.checked)}
              className="rounded border-gray-300 text-blip-purple focus:ring-blip-purple"
            />
            Diferenciar maiúsculas/minúsculas
          </label>
        </div>

        {/* Resultados */}
        <div className="px-4 pb-3 max-h-[40vh] overflow-y-auto">
          {!query.trim() ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic py-4 text-center">
              Digite algo pra começar a buscar.
            </p>
          ) : matches.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic py-4 text-center">
              Nenhum resultado encontrado.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">
                {totalOccurrences} ocorrência{totalOccurrences === 1 ? '' : 's'} em{' '}
                {matches.length} bloco{matches.length === 1 ? '' : 's'}
              </p>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700 -mx-1">
                {matches.slice(0, 30).map((m, i) => (
                  <li
                    key={`${m.nodeId}-${m.field}-${i}`}
                    className="px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                    onClick={() => {
                      if (onJumpToNode) {
                        onJumpToNode(m.nodeId);
                        onOpenChange(false);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-mono text-blip-purple shrink-0">
                        {m.code ?? m.nodeType.slice(0, 6)}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                        {m.field} · {m.count}x
                      </div>
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      {m.value}
                    </div>
                  </li>
                ))}
                {matches.length > 30 && (
                  <li className="px-2 py-2 text-[10px] text-gray-400 italic text-center">
                    + {matches.length - 30} bloco{matches.length - 30 === 1 ? '' : 's'} adiciona{matches.length - 30 === 1 ? 'l' : 'is'}
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
