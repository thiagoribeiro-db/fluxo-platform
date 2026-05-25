'use client';

/**
 * ConnectionsSection — UI de edges (pais/filhos) no PropertiesPanel.
 *
 * Renderiza 2 grupos:
 *  - Vem de (pais): edges com target = node selecionado
 *  - Vai para (filhos): edges com source = node selecionado
 *
 * Cada item permite: jump pro nó, trocar conexão, remover.
 * Select abaixo permite adicionar nova conexão.
 *
 * Sub-componentes (ConnectionItem, AddConnectionSelect) ficam aqui porque
 * são intimamente acoplados ao layout/dataflow.
 */

import { useState } from 'react';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';

/**
 * Label legível pra um nó (code · título). Exportado pra reuso em
 * componentes vizinhos (ParentRelationSection, FrameContentsSection).
 */
export function labelOf(id: string, allNodes: FluxoNode[]): string {
  const n = allNodes.find((x) => x.id === id);
  if (!n) return id;
  const code = (n.data?.code as string | undefined) ?? '';
  const title =
    (n.data?.title as string | undefined) ??
    (n.data?.label as string | undefined) ??
    (n.data?.text as string | undefined) ??
    (n.data?.header as string | undefined) ??
    '';
  return code ? `${code} · ${title.slice(0, 30)}` : title.slice(0, 40) || id;
}

export interface ConnectionsSectionProps {
  node: FluxoNode;
  allNodes: FluxoNode[];
  allEdges: Edge[];
  onJumpToNode?: (id: string) => void;
  onRemoveEdge?: (edgeId: string) => void;
  onAddEdge?: (sourceId: string, targetId: string) => void;
  onUpdateEdge?: (
    edgeId: string,
    patch: { source?: string; target?: string }
  ) => void;
}

export function ConnectionsSection({
  node,
  allNodes,
  allEdges,
  onJumpToNode,
  onRemoveEdge,
  onAddEdge,
  onUpdateEdge,
}: ConnectionsSectionProps) {
  const incoming = allEdges.filter((e) => e.target === node.id);
  const outgoing = allEdges.filter((e) => e.source === node.id);

  // Nodes "selecionáveis" pra adicionar/trocar conexão.
  // Exclui: o próprio nó, children visuais (parentId), trackings, exceções,
  // FRAMES (containers).
  const eligibleNodes = allNodes.filter(
    (n) =>
      n.id !== node.id &&
      n.parentId !== node.id &&
      n.type !== 'tracking' &&
      n.type !== 'excecao' &&
      n.type !== 'frame'
  );

  return (
    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
        Conexões
      </h3>

      <div className="mb-4">
        <p className="text-[10px] uppercase text-gray-400 dark:text-gray-500 mb-1">
          Vem de (pais)
        </p>
        {incoming.length === 0 ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 italic px-2 py-1">
            Nenhuma conexão de entrada
          </p>
        ) : (
          <ul className="space-y-1 mb-2">
            {incoming.map((e) => (
              <ConnectionItem
                key={e.id}
                edge={e}
                otherId={e.source}
                label={labelOf(e.source, allNodes)}
                allNodes={allNodes}
                eligibleNodes={eligibleNodes}
                onJump={onJumpToNode}
                onRemove={onRemoveEdge}
                onUpdate={(newOther) =>
                  onUpdateEdge?.(e.id, { source: newOther })
                }
                direction="from"
              />
            ))}
          </ul>
        )}
        <AddConnectionSelect
          eligibleNodes={eligibleNodes}
          excludeIds={incoming.map((e) => e.source)}
          placeholder="+ Adicionar pai"
          onSelect={(otherId) => onAddEdge?.(otherId, node.id)}
        />
      </div>

      <div>
        <p className="text-[10px] uppercase text-gray-400 dark:text-gray-500 mb-1">
          Vai para (filhos)
        </p>
        {outgoing.length === 0 ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 italic px-2 py-1">
            Nenhuma conexão de saída
          </p>
        ) : (
          <ul className="space-y-1 mb-2">
            {outgoing.map((e) => (
              <ConnectionItem
                key={e.id}
                edge={e}
                otherId={e.target}
                label={labelOf(e.target, allNodes)}
                allNodes={allNodes}
                eligibleNodes={eligibleNodes}
                onJump={onJumpToNode}
                onRemove={onRemoveEdge}
                onUpdate={(newOther) =>
                  onUpdateEdge?.(e.id, { target: newOther })
                }
                direction="to"
              />
            ))}
          </ul>
        )}
        <AddConnectionSelect
          eligibleNodes={eligibleNodes}
          excludeIds={outgoing.map((e) => e.target)}
          placeholder="+ Adicionar filho"
          onSelect={(otherId) => onAddEdge?.(node.id, otherId)}
        />
      </div>
    </div>
  );
}

function ConnectionItem({
  edge,
  otherId,
  label,
  allNodes,
  eligibleNodes,
  direction,
  onJump,
  onRemove,
  onUpdate,
}: {
  edge: Edge;
  otherId: string;
  label: string;
  allNodes: FluxoNode[];
  eligibleNodes: FluxoNode[];
  direction: 'from' | 'to';
  onJump?: (id: string) => void;
  onRemove?: (edgeId: string) => void;
  onUpdate?: (newOtherId: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="flex items-center gap-1 text-xs bg-blip-purple/5 dark:bg-blip-purple/15 p-1 rounded">
        <span className="text-gray-400 dark:text-gray-500 w-4">
          {direction === 'from' ? '←' : '→'}
        </span>
        <select
          autoFocus
          defaultValue={otherId}
          onChange={(e) => {
            const value = e.target.value;
            if (value && value !== otherId) onUpdate?.(value);
            setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          className="flex-1 px-1 py-0.5 text-xs border border-blip-purple rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value={otherId}>{labelOf(otherId, allNodes)}</option>
          {eligibleNodes
            .filter((n) => n.id !== otherId)
            .map((n) => (
              <option key={n.id} value={n.id}>
                {labelOf(n.id, allNodes)}
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-1"
          title="Cancelar"
        >
          ✕
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1 text-xs">
      <span className="text-gray-400 dark:text-gray-500 w-4">
        {direction === 'from' ? '←' : '→'}
      </span>
      <button
        type="button"
        onClick={() => onJump?.(otherId)}
        disabled={!onJump}
        className="flex-1 text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 truncate text-gray-700 dark:text-gray-200"
        title="Ir até este nó"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={!onUpdate}
        className="text-gray-400 dark:text-gray-500 hover:text-blip-purple px-1"
        title="Trocar conexão"
      >
        ✎
      </button>
      <button
        type="button"
        onClick={() => onRemove?.(edge.id)}
        disabled={!onRemove}
        className="text-gray-400 dark:text-gray-500 hover:text-red-600 px-1"
        title="Remover conexão"
      >
        ✕
      </button>
    </li>
  );
}

function AddConnectionSelect({
  eligibleNodes,
  excludeIds,
  placeholder,
  onSelect,
}: {
  eligibleNodes: FluxoNode[];
  excludeIds: string[];
  placeholder: string;
  onSelect: (id: string) => void;
}) {
  const available = eligibleNodes.filter((n) => !excludeIds.includes(n.id));
  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) onSelect(e.target.value);
        e.target.value = '';
      }}
      className="w-full text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 hover:border-blip-purple hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10 cursor-pointer"
      disabled={available.length === 0}
    >
      <option value="">
        {available.length === 0 ? '(sem nós disponíveis)' : placeholder}
      </option>
      {available.map((n) => {
        const code = (n.data?.code as string | undefined) ?? '';
        const title =
          (n.data?.title as string | undefined) ??
          (n.data?.label as string | undefined) ??
          (n.data?.text as string | undefined) ??
          (n.data?.header as string | undefined) ??
          '';
        const label = code
          ? `${code} · ${title.slice(0, 30)}`
          : title.slice(0, 40) || n.id;
        return (
          <option key={n.id} value={n.id}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
