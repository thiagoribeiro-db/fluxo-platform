'use client';

/**
 * RelationSections — painéis especiais pra nodes que NÃO participam de
 * edges normais (frame/tracking/exceção).
 *
 *  - FrameContentsSection: mostra blocos dentro do bbox do frame
 *  - ParentRelationSection: mostra o pai visual (parentId) de tracking/exceção
 *
 * Substituem o ConnectionsSection padrão pra esses 3 tipos.
 */

import type { FluxoNode } from '@/lib/types';
import { labelOf } from './ConnectionsSection';

export function ParentRelationSection({
  node,
  allNodes,
  onJumpToNode,
}: {
  node: FluxoNode;
  allNodes: FluxoNode[];
  onJumpToNode?: (id: string) => void;
}) {
  const parent = node.parentId
    ? allNodes.find((n) => n.id === node.parentId)
    : null;
  const parentLabel = parent ? labelOf(parent.id, allNodes) : null;
  const kindLabel = node.type === 'tracking' ? 'Tracking' : 'Exceção';

  return (
    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
        Vínculo
      </h3>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
        {kindLabel} é um <strong>child visual</strong> de outro bloco — não
        tem conexão de fluxo própria. Acompanha o pai.
      </p>
      {parent ? (
        <button
          type="button"
          onClick={() => onJumpToNode?.(parent.id)}
          className="w-full text-left px-2 py-2 rounded-md border border-gray-200 dark:border-gray-700 hover:border-blip-purple hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10 transition"
          title={`Pular para ${parentLabel}`}
        >
          <div className="text-[10px] uppercase text-gray-400">Pai visual</div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-100 mt-0.5">
            {parentLabel}
          </div>
        </button>
      ) : (
        <p className="text-[11px] text-gray-400 italic px-2 py-1">
          Sem pai (órfão — recomendado deletar ou reconectar).
        </p>
      )}
    </div>
  );
}

export function FrameContentsSection({
  frame,
  allNodes,
  onJumpToNode,
}: {
  frame: FluxoNode;
  allNodes: FluxoNode[];
  onJumpToNode?: (id: string) => void;
}) {
  const fx = frame.position.x;
  const fy = frame.position.y;
  const fw = (frame.data?.width as number | undefined) ?? 656;
  const fh = (frame.data?.height as number | undefined) ?? 400;
  const inside = allNodes.filter((n) => {
    if (n.id === frame.id) return false;
    if (n.parentId) return false; // children já representados pelo parent
    if (n.type === 'frame') return false;
    const cx = n.position.x + 100;
    const cy = n.position.y + 30;
    return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
  });
  inside.sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x
  );

  return (
    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
        Blocos dentro
      </h3>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
        Frame é só um container visual — não tem conexões próprias. Os{' '}
        <strong>{inside.length}</strong> bloco(s) abaixo estão dentro do bbox:
      </p>
      {inside.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic px-2 py-1">
          Frame vazio.
        </p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {inside.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onJumpToNode?.(n.id)}
                className="w-full text-left px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:border-blip-purple hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10 transition text-xs"
              >
                <span className="font-mono text-[10px] text-gray-500 mr-1.5">
                  {(n.data?.code as string | undefined) ?? n.id.slice(0, 6)}
                </span>
                <span className="text-gray-700 dark:text-gray-200">
                  {labelOf(n.id, allNodes)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
