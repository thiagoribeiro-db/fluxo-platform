/**
 * Hook de undo history — guarda snapshots de (nodes, edges) das últimas N
 * ações pra restaurar via Ctrl/Cmd+Z.
 *
 * USO:
 *   const { pushHistory, handleUndo } = useUndoHistory({ nodes, edges, setNodes, setEdges });
 *   pushHistory(); // ANTES de cada mutação destrutiva
 *
 * Importante: `pushHistory` deve ser chamado ANTES de aplicar a mudança,
 * pra capturar o state ANTERIOR. Snapshots usam JSON.stringify (deep copy)
 * pra evitar mutação por referência.
 *
 * Limite: HISTORY_LIMIT (default 50) — quando excede, drop o mais antigo.
 *
 * Atalho Ctrl/Cmd+Z é registrado pelo CALLER (handleUndo é retornado pra
 * ser usado em qualquer keydown handler). Esse hook não toca em window
 * pra ser flexível (callers podem combinar com outros atalhos).
 */
import { useCallback, useRef } from 'react';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';

interface UseUndoHistoryOpts {
  nodes: FluxoNode[];
  edges: Edge[];
  setNodes: (nodes: FluxoNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  /** Default: 50 */
  limit?: number;
}

interface UseUndoHistoryResult {
  /** Capture um snapshot do state atual. Chame ANTES de cada mutação destrutiva. */
  pushHistory: () => void;
  /** Restaura o último snapshot. No-op se vazio. */
  handleUndo: () => void;
  /** Limpa todo o histórico (ex: ao trocar de página). */
  clearHistory: () => void;
}

const DEFAULT_LIMIT = 50;

export function useUndoHistory({
  nodes,
  edges,
  setNodes,
  setEdges,
  limit = DEFAULT_LIMIT,
}: UseUndoHistoryOpts): UseUndoHistoryResult {
  const historyRef = useRef<Array<{ nodes: FluxoNode[]; edges: Edge[] }>>([]);
  const isUndoingRef = useRef(false);

  const pushHistory = useCallback(() => {
    if (isUndoingRef.current) return; // não captura durante undo
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)) as FluxoNode[],
      edges: JSON.parse(JSON.stringify(edges)) as Edge[],
    });
    if (historyRef.current.length > limit) {
      historyRef.current.shift();
    }
  }, [nodes, edges, limit]);

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    isUndoingRef.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    // Libera flag no próximo tick (depois do setState aplicar)
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 0);
  }, [setNodes, setEdges]);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
  }, []);

  return { pushHistory, handleUndo, clearHistory };
}
