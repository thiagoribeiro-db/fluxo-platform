'use client';

import { useMemo, useState } from 'react';
import type { Edge } from '@xyflow/react';
import type { FluxoNode, FluxoNodeData } from '@/lib/types';
import ApiMockEditor from './ApiMockEditor';
import RichTextEditor from './RichTextEditor';
import {
  extractVariables,
  type FlowVariable,
} from '@/lib/variables/extract-variables';
import { ConnectionsSection } from './properties/ConnectionsSection';
import {
  ParentRelationSection,
  FrameContentsSection,
} from './properties/RelationSections';
import { NodeFields } from './properties/NodeFields';

interface PropertiesPanelProps {
  selectedNode: FluxoNode | null;
  onUpdate: (patch: Partial<FluxoNodeData>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
  /** Quando nada está selecionado, painel mostra lista de frames navegáveis. */
  allNodes?: FluxoNode[];
  allEdges?: Edge[];
  onJumpToNode?: (nodeId: string) => void;
  onJumpToFrame?: (frameId: string) => void;
  /** Remove uma edge específica do canvas. */
  onRemoveEdge?: (edgeId: string) => void;
  /** Cria edge entre dois nós. */
  onAddEdge?: (sourceId: string, targetId: string) => void;
  /** Troca o source ou target de uma edge existente. */
  onUpdateEdge?: (edgeId: string, patch: { source?: string; target?: string }) => void;
  /** Abre o sub-editor do WhatsApp Flow (só usado quando whatsapp-flow está selecionado). */
  onOpenFlowEditor?: (nodeId: string) => void;
}

/**
 * Sidebar direita — propriedades do node selecionado.
 *
 * Mostra inputs específicos por tipo. Quando nada está selecionado, mostra
 * dica. Mudanças são propagadas para o pai via onUpdate (debounced no pai
 * antes do autosave).
 */
export default function PropertiesPanel({
  selectedNode,
  onUpdate,
  onDelete,
  onDuplicate,
  collapsed,
  onToggle,
  allNodes,
  allEdges,
  onJumpToNode,
  onJumpToFrame,
  onRemoveEdge,
  onAddEdge,
  onUpdateEdge,
  onOpenFlowEditor,
}: PropertiesPanelProps) {
  if (collapsed) {
    return (
      <aside className="w-12 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col items-center pt-3">
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 dark:text-gray-500 hover:text-blip-purple text-lg"
          title="Expandir propriedades"
        >
          «
        </button>
      </aside>
    );
  }

  return (
    <aside
      data-tour="properties-panel"
      className="w-72 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Propriedades</h2>
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 dark:text-gray-500 hover:text-blip-purple text-lg"
          title="Recolher"
        >
          »
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 dark:text-gray-200">
        {!selectedNode ? (
          <FramesList nodes={allNodes ?? []} onJumpToFrame={onJumpToFrame} />
        ) : (
          <>
            <NodeFields
              node={selectedNode}
              onUpdate={onUpdate}
              allNodesForSelect={allNodes ?? []}
              onOpenFlowEditor={onOpenFlowEditor}
            />
            {/* Frame, tracking, exceção têm relação especial (parentId visual,
                não edges). Pra eles, mostramos ParentRelationSection. Pros
                demais, ConnectionsSection clássico. */}
            {selectedNode.type === 'frame' ? (
              <FrameContentsSection
                frame={selectedNode}
                allNodes={allNodes ?? []}
                onJumpToNode={onJumpToNode}
              />
            ) : selectedNode.type === 'tracking' ||
              selectedNode.type === 'excecao' ? (
              <ParentRelationSection
                node={selectedNode}
                allNodes={allNodes ?? []}
                onJumpToNode={onJumpToNode}
              />
            ) : (
              <ConnectionsSection
                node={selectedNode}
                allNodes={allNodes ?? []}
                allEdges={allEdges ?? []}
                onJumpToNode={onJumpToNode}
                onRemoveEdge={onRemoveEdge}
                onAddEdge={onAddEdge}
                onUpdateEdge={onUpdateEdge}
              />
            )}
          </>
        )}
      </div>

      {selectedNode && (
        <footer className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <button
            type="button"
            onClick={onDuplicate}
            className="flex-1 text-xs px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium"
            title="Ctrl+D"
          >
            ⎘ Duplicar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 text-xs px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 font-medium"
            title="Del"
          >
            🗑 Apagar
          </button>
        </footer>
      )}
    </aside>
  );
}

function FramesList({
  nodes,
  onJumpToFrame,
}: {
  nodes: FluxoNode[];
  onJumpToFrame?: (frameId: string) => void;
}) {
  const frames = nodes
    .filter((n) => n.type === 'frame')
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

  if (frames.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3 opacity-30">👆</div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Clique em um componente do canvas para editar suas propriedades.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        Frames do projeto ({frames.length})
      </h3>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
        Clique para navegar até o frame
      </p>
      <ul className="space-y-1">
        {frames.map((f) => {
          const title = (f.data?.title as string | undefined) ?? 'Frame';
          const prefix = (f.data?.prefix as string | undefined) ?? '';
          const frameId = f.data?.frameId as string | undefined;
          const locked = !!f.data?.locked;

          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => frameId && onJumpToFrame?.(frameId)}
                disabled={!frameId}
                className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md border border-gray-200 dark:border-gray-700 hover:border-blip-purple hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10 transition group disabled:opacity-50 disabled:cursor-not-allowed"
                title={frameId ? `Ir para #${frameId}` : 'Sem frameId'}
              >
                <span
                  className="inline-flex items-center justify-center text-[10px] font-mono font-bold text-white bg-blip-purple px-1.5 py-0.5 rounded shrink-0"
                  style={{ minWidth: '32px' }}
                >
                  {prefix || '—'}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-800 dark:text-gray-100 truncate group-hover:text-blip-purple">
                    {title}
                  </span>
                  {frameId && (
                    <span className="block text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">
                      {frameId}
                    </span>
                  )}
                </span>
                {locked && <span className="text-gray-400 dark:text-gray-500" title="Travado">🔒</span>}
                <span className="text-gray-300 dark:text-gray-600 group-hover:text-blip-purple">→</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// =============================================================================
// Inputs por tipo de node
// =============================================================================

// NodeFields + helpers (Field, Badge, StableIdField, FrameTargetSelect,
// BlockTargetSelect, FieldsListEditor, OptionsListEditor) extraídos pra
// `properties/NodeFields.tsx` na rodada de refator.
