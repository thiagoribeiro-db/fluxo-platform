'use client';

/**
 * useLayoutEngine — operações de layout/codes do canvas.
 *
 * Funções:
 *  - handleOrganizeLayout: roda o pipeline completo de organize
 *    (repair edges → organize → ensure entry points). Mede dimensões
 *    reais via getInternalNode pra precisão pixel-perfect
 *  - handleReorganizeCodes: renumera todos os blocos pela posição vertical
 *
 * Ambas pesadas (mexem em todo nodes/edges) e bem isoladas — bons
 * candidatos a hook próprio. Não acoplam com @xyflow/react (recebem
 * getInternalNode injetado).
 */

import { useCallback } from 'react';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import {
  organizeLayoutByFrame,
  repairMainFlowEdges,
  reorganizeCodes,
} from '@/lib/components/nodes/helpers';
import { ensureEntryPointsForFrames } from '@/lib/components/nodes/ensure-entry-points';
import { track } from '@/lib/analytics/posthog';
import { toast } from '@/lib/utils/errors';
import { confirmDialog } from '@/lib/utils/dialog';

interface InternalNodeLike {
  measured?: { width?: number; height?: number };
}

export interface UseLayoutEngineInput {
  nodes: FluxoNode[];
  edges: Edge[];
  setNodes: (next: FluxoNode[] | ((prev: FluxoNode[]) => FluxoNode[])) => void;
  setEdges: (next: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  pushHistory: () => void;
  /** Lookup do react-flow pra dimensões reais. */
  getInternalNode: (id: string) => InternalNodeLike | undefined;
}

export interface UseLayoutEngineResult {
  handleOrganizeLayout: (skipConfirm?: boolean) => Promise<void>;
  handleReorganizeCodes: () => Promise<void>;
}

export function useLayoutEngine({
  nodes,
  edges,
  setNodes,
  setEdges,
  pushHistory,
  getInternalNode,
}: UseLayoutEngineInput): UseLayoutEngineResult {
  // -------------------------------------------------------------------------
  // ORGANIZE — pipeline de layout completo
  // -------------------------------------------------------------------------
  const handleOrganizeLayout = useCallback(
    async (skipConfirm = false) => {
      if (!skipConfirm) {
        const ok = await confirmDialog({
          title: 'Organizar layout?',
          message:
            'Os componentes principais (bubbles, menus, mídias, integrações, IAG) serão alinhados em coluna vertical à direita de cada frame.\n\nOs frames serão redimensionados pra caber exatamente o conteúdo. Trackings e exceções movem junto.\n\nFrames sem marcador de Início ganham um automaticamente.',
          confirmText: 'Organizar',
        });
        if (!ok) return;
      }

      pushHistory();
      track('organize_layout');

      // Usa dimensões REAIS medidas (precisão pixel-perfect)
      const getMeasured = (id: string) => {
        const internal = getInternalNode(id);
        const w = internal?.measured?.width;
        const h = internal?.measured?.height;
        if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
          return { w, h };
        }
        return undefined;
      };

      // 1. Conserta grafo: conecta btn-shorts órfãos ao destino e remove
      //    edges main→main redundantes
      const cleanedEdges = repairMainFlowEdges(edges, nodes);

      // 2. Organiza por frame
      const organized = organizeLayoutByFrame(nodes, cleanedEdges, getMeasured);

      // 3. Auto-fix: garante entry-point pros frames
      const entryResult = ensureEntryPointsForFrames(organized, cleanedEdges);

      setNodes(entryResult.nodes);
      setEdges(entryResult.edges);

      if (entryResult.created > 0) {
        toast({
          level: 'success',
          message: `${entryResult.created} marcador${
            entryResult.created === 1 ? '' : 'es'
          } de "Início" adicionado${entryResult.created === 1 ? '' : 's'} automaticamente`,
        });
      }
    },
    [setNodes, setEdges, edges, nodes, getInternalNode, pushHistory]
  );

  // -------------------------------------------------------------------------
  // REORGANIZE CODES — renumera por posição vertical
  // -------------------------------------------------------------------------
  const handleReorganizeCodes = useCallback(async () => {
    const ok = await confirmDialog({
      title: 'Reorganizar IDs?',
      message:
        'Isso vai renumerar todos os blocos em sequência pela posição vertical (de cima pra baixo).\n\n⚠️ Códigos antigos serão perdidos. Use com cuidado se você já referenciou esses IDs em outros lugares.',
      confirmText: 'Reorganizar',
      variant: 'danger',
    });
    if (!ok) return;
    pushHistory();
    setNodes((prev) => reorganizeCodes(prev));
  }, [setNodes, pushHistory]);

  return { handleOrganizeLayout, handleReorganizeCodes };
}
