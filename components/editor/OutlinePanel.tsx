'use client';

/**
 * OutlinePanel — lista hierárquica navegável de frames + blocos.
 *
 * Aciona via Cmd+K → "Outline" OU pelo dropdown Visualizar da toolbar.
 * Aparece como painel flutuante à esquerda do canvas (sobreposto à
 * sidebar). Click num frame/bloco centraliza a câmera nele.
 *
 * Padrão Notion outline: cada frame é collapsible, blocos exibem código
 * em badge, ícones representam o tipo do bloco. Busca em tempo real.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ListTree, Search, X } from 'lucide-react';
import {
  buildOutlineTree,
  type OutlineNode,
} from '@/lib/outline/build-tree';
import type { FluxoNode } from '@/lib/types';

interface OutlinePanelProps {
  nodes: FluxoNode[];
  onClose: () => void;
  /** Centraliza câmera num nó (qualquer tipo). */
  onJumpToNode: (nodeId: string) => void;
}

export default function OutlinePanel({ nodes, onClose, onJumpToNode }: OutlinePanelProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ESC fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tree = useMemo(() => buildOutlineTree(nodes, { query }), [nodes, query]);

  // Stats pro header
  const totalFrames = tree.filter((t) => t.kind === 'frame').length;
  const totalBlocks = tree.reduce((sum, t) => sum + (t.children?.length ?? 0), 0);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <aside className="absolute top-0 left-0 h-full w-[320px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-xl flex flex-col z-20">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 px-3 py-2.5 flex items-center gap-2 shrink-0">
        <ListTree size={16} className="text-blip-purple shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Outline</h2>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
            {totalFrames} frame{totalFrames === 1 ? '' : 's'} · {totalBlocks} blocos
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded p-1"
          title="Fechar (Esc)"
        >
          <X size={14} />
        </button>
      </header>

      {/* Search */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <Search size={13} className="text-gray-400 dark:text-gray-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, código…"
          autoFocus
          className="flex-1 bg-transparent text-xs py-1 outline-none dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            title="Limpar"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
            {query
              ? `Nenhum resultado pra "${query}"`
              : 'Nenhum frame ainda — crie um na paleta'}
          </div>
        ) : (
          <ul>
            {tree.map((node) => (
              <FrameItem
                key={node.id}
                node={node}
                isCollapsed={collapsed.has(node.id)}
                onToggleCollapse={() => toggleCollapsed(node.id)}
                onJump={onJumpToNode}
              />
            ))}
          </ul>
        )}
      </div>

      <footer className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
        💡 Click pra navegar · ⌨ Esc fecha
      </footer>
    </aside>
  );
}

// =============================================================================
// FRAME ITEM
// =============================================================================

interface FrameItemProps {
  node: OutlineNode;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onJump: (id: string) => void;
}

function FrameItem({ node, isCollapsed, onToggleCollapse, onJump }: FrameItemProps) {
  const isFrame = node.kind === 'frame';
  const isOrphans = node.kind === 'orphan-group';

  return (
    <li className="select-none">
      {/* Frame header */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10 cursor-pointer group"
        onClick={() => {
          if (isFrame) onJump(node.id);
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="shrink-0 p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          title={isCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        <span className="shrink-0 text-sm">{node.emoji}</span>
        {isFrame && node.prefix && (
          <span className="shrink-0 inline-flex items-center justify-center text-[9px] font-mono font-bold text-white bg-blip-purple px-1 py-0 rounded min-w-[24px]">
            {node.prefix}
          </span>
        )}
        <span className={`flex-1 min-w-0 truncate text-xs font-medium ${isOrphans ? 'text-gray-500 dark:text-gray-400 italic' : 'text-gray-900 dark:text-gray-100 group-hover:text-blip-purple-dark dark:group-hover:text-blip-purple'}`}>
          {node.label}
        </span>
        <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
          {node.children?.length ?? 0}
        </span>
      </div>

      {/* Children */}
      {!isCollapsed && node.children && node.children.length > 0 && (
        <ul className="ml-3 border-l border-gray-100 dark:border-gray-800">
          {node.children.map((child) => (
            <BlockItem key={child.id} node={child} onJump={onJump} />
          ))}
        </ul>
      )}
    </li>
  );
}

// =============================================================================
// BLOCK ITEM
// =============================================================================

interface BlockItemProps {
  node: OutlineNode;
  onJump: (id: string) => void;
}

function BlockItem({ node, onJump }: BlockItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onJump(node.id)}
        className="w-full flex items-center gap-1.5 pl-3 pr-2 py-1 hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10 text-left group"
        title={node.label}
      >
        <span className="shrink-0 text-xs leading-none">{node.emoji}</span>
        {node.code && (
          <span className="shrink-0 text-[9px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 py-0 rounded">
            {node.code}
          </span>
        )}
        <span className="flex-1 min-w-0 truncate text-[11px] text-gray-700 dark:text-gray-200 group-hover:text-blip-purple-dark dark:group-hover:text-blip-purple">
          {node.label}
        </span>
        {node.targetFrameId && (
          <span
            className="shrink-0 text-[9px] text-green-700 dark:text-green-400 font-mono"
            title={`Direciona pra: ${node.targetFrameId}`}
          >
            →{node.targetFrameId.slice(0, 6)}
          </span>
        )}
      </button>
    </li>
  );
}
