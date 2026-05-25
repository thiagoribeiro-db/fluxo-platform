'use client';

/**
 * useSkillOperations — encapsula as 3 operações de skills no editor:
 *  - handleInsertSkill: insere skill BUILTIN (do registry SKILLS)
 *  - handleSaveSelectionAsSkill: salva seleção atual como skill custom
 *  - handleInsertUserSkill: insere skill custom (do localStorage)
 *
 * Extraído do FlowEditor pra reduzir o god-component e isolar a lógica de
 * skills (que mistura layout antes-insert + clone com idMap + camera jump).
 *
 * Dependências do react-flow (getInternalNode, setCenter, screenToFlowPosition)
 * são injetadas — não acopla com hooks do @xyflow/react aqui.
 */

import { useCallback, type RefObject } from 'react';
import { nanoid } from 'nanoid';
import type { Edge } from '@xyflow/react';
import type { FluxoNode, FluxoNodeType } from '@/lib/types';
import type { Skill } from '@/lib/skills';
import {
  organizeLayoutByFrame,
  repairMainFlowEdges,
  APPROX_WIDTH_BY_TYPE,
} from '@/lib/components/nodes/helpers';
import { ensureEntryPointsForFrames } from '@/lib/components/nodes/ensure-entry-points';
import { track } from '@/lib/analytics/posthog';
import { toast } from '@/lib/utils/errors';
import { promptDialog } from '@/lib/utils/dialog';
import { TIMING } from '@/lib/constants/timing';

/** Subset do tipo InternalNode do react-flow — só o que usamos aqui. */
interface InternalNodeLike {
  measured?: { width?: number; height?: number };
  internals: { positionAbsolute?: { x: number; y: number } };
  position: { x: number; y: number };
}

export interface UseSkillOperationsInput {
  nodes: FluxoNode[];
  edges: Edge[];
  selectedIds: string[];
  setNodes: (
    next: FluxoNode[] | ((prev: FluxoNode[]) => FluxoNode[])
  ) => void;
  setEdges: (next: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setSelectedId: (id: string | null) => void;
  pushHistory: () => void;
  /** Lookup do react-flow pra obter dimensões reais medidas. */
  getInternalNode: (id: string) => InternalNodeLike | undefined;
  /** Pan da câmera (do useReactFlow). */
  setCenter: (
    x: number,
    y: number,
    opts?: { duration?: number; zoom?: number }
  ) => void;
  /** Conversão tela → coordenadas do canvas (do useReactFlow). */
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number };
  /** Wrapper do canvas pra calcular bbox da tela. */
  reactFlowWrapper: RefObject<HTMLDivElement>;
}

export interface UseSkillOperationsResult {
  handleInsertSkill: (skill: Skill) => void;
  handleSaveSelectionAsSkill: () => Promise<void>;
  handleInsertUserSkill: (skill: {
    nodes: FluxoNode[];
    edges: Edge[];
    name: string;
  }) => Promise<void>;
}

export function useSkillOperations({
  nodes,
  edges,
  selectedIds,
  setNodes,
  setEdges,
  setSelectedId,
  pushHistory,
  getInternalNode,
  setCenter,
  screenToFlowPosition,
  reactFlowWrapper,
}: UseSkillOperationsInput): UseSkillOperationsResult {
  // ---------------------------------------------------------------------------
  // INSERT SKILL BUILTIN
  // Organiza canvas atual → calcula origem livre → build skill → centraliza.
  // ---------------------------------------------------------------------------
  const handleInsertSkill = useCallback(
    (skill: Skill) => {
      pushHistory();
      track('skill_inserted', { skillId: skill.id });

      // 1. Organiza o canvas atual (função pura — não dispara setState)
      const getMeasured = (id: string) => {
        const internal = getInternalNode(id);
        const w = internal?.measured?.width;
        const h = internal?.measured?.height;
        if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
          return { w, h };
        }
        return undefined;
      };
      const cleanedEdges = repairMainFlowEdges(edges, nodes);
      const organized = organizeLayoutByFrame(nodes, cleanedEdges, getMeasured);
      const entryResult = ensureEntryPointsForFrames(organized, cleanedEdges);
      const organizedNodes = entryResult.nodes;
      const organizedEdges = entryResult.edges;

      // 2. Origem da skill = à direita do conteúdo existente, ou centro vazio
      let origin = { x: 60, y: 40 };
      const topLevel = organizedNodes.filter((n) => !n.parentId);
      if (topLevel.length > 0) {
        const maxX = Math.max(
          ...topLevel.map((n) => {
            const w =
              n.measured?.width ??
              (n.data?.width as number | undefined) ??
              APPROX_WIDTH_BY_TYPE[n.type as FluxoNodeType] ??
              240;
            return n.position.x + w;
          })
        );
        const minY = Math.min(...topLevel.map((n) => n.position.y));
        origin = { x: maxX + 200, y: minY };
      } else {
        const wrap = reactFlowWrapper.current;
        const rect = wrap?.getBoundingClientRect();
        if (rect) {
          const screenCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          const flowCenter = screenToFlowPosition(screenCenter);
          origin = { x: flowCenter.x - 270, y: flowCenter.y - 100 };
        }
      }

      // 3. Build skill
      const result = skill.build({ origin });

      // 4. Aplica atomicamente
      setNodes([...organizedNodes, ...result.nodes]);
      setEdges([...organizedEdges, ...result.edges]);

      // 5. Câmera pro entry da skill após render
      setTimeout(() => {
        const internal = getInternalNode(result.entryNodeId);
        if (!internal) return;
        const pos = internal.internals.positionAbsolute ?? internal.position;
        const w = internal.measured?.width ?? 240;
        const h = internal.measured?.height ?? 100;
        setCenter(pos.x + w / 2, pos.y + h / 2, {
          duration: TIMING.CAMERA_PAN_DURATION,
          zoom: 0.8,
        });
        setSelectedId(result.entryNodeId);
      }, TIMING.CAMERA_PAN_AFTER_CREATE);

      const organizedMsg =
        topLevel.length > 0 ? ' · layout organizado antes' : '';
      toast({
        level: 'success',
        message: `Skill "${skill.title}" inserida`,
        detail: `${result.nodes.length} nós, ${result.edges.length} conexões${organizedMsg}`,
      });
    },
    [
      nodes,
      edges,
      setNodes,
      setEdges,
      setCenter,
      screenToFlowPosition,
      getInternalNode,
      setSelectedId,
      pushHistory,
      reactFlowWrapper,
    ]
  );

  // ---------------------------------------------------------------------------
  // SALVAR SELEÇÃO COMO SKILL CUSTOMIZADA (localStorage)
  // ---------------------------------------------------------------------------
  const handleSaveSelectionAsSkill = useCallback(async () => {
    if (selectedIds.length === 0) {
      toast({
        level: 'warn',
        message: 'Selecione 1+ bloco(s) no canvas pra salvar como skill.',
      });
      return;
    }
    const { extractSubgraph, createUserSkill } = await import(
      '@/lib/skills/user-library'
    );
    const subgraph = extractSubgraph(nodes, edges, selectedIds);
    if (subgraph.nodes.length === 0) {
      toast({ level: 'warn', message: 'Nada selecionado pra salvar.' });
      return;
    }
    const name = await promptDialog({
      title: 'Salvar como skill',
      message: `Salvando ${subgraph.nodes.length} bloco(s) e ${subgraph.edges.length} conexão(ões). Digite o nome:`,
      placeholder: 'Ex: Coleta de CPF + nome',
      defaultValue: '',
    });
    if (!name) return;
    const skill = createUserSkill({
      name,
      description: `${subgraph.nodes.length} nós · ${subgraph.edges.length} conexões`,
      emoji: '🧩',
      nodes: subgraph.nodes,
      edges: subgraph.edges,
    });
    toast({
      level: 'success',
      message: `Skill "${skill.name}" salva na sua biblioteca.`,
    });
    track('user_skill_saved', {
      nodeCount: subgraph.nodes.length,
      edgeCount: subgraph.edges.length,
    });
  }, [selectedIds, nodes, edges]);

  // ---------------------------------------------------------------------------
  // INSERIR SKILL CUSTOMIZADA (do localStorage)
  // Clona nodes com IDs novos, remapeia parentId + edges.
  // ---------------------------------------------------------------------------
  const handleInsertUserSkill = useCallback(
    async (skill: { nodes: FluxoNode[]; edges: Edge[]; name: string }) => {
      pushHistory();
      track('user_skill_inserted', { skillName: skill.name });

      const topLevel = skill.nodes.filter((n) => !n.parentId);
      if (topLevel.length === 0) {
        toast({ level: 'error', message: 'Skill sem nodes top-level.' });
        return;
      }
      const minX = Math.min(...topLevel.map((n) => n.position.x));
      const minY = Math.min(...topLevel.map((n) => n.position.y));

      // Origem = direita do conteúdo existente
      let origin = { x: 60, y: 40 };
      const existingTopLevel = nodes.filter((n) => !n.parentId);
      if (existingTopLevel.length > 0) {
        const maxX = Math.max(
          ...existingTopLevel.map((n) => {
            const w =
              n.measured?.width ??
              (n.data?.width as number | undefined) ??
              APPROX_WIDTH_BY_TYPE[n.type as FluxoNodeType] ??
              240;
            return n.position.x + w;
          })
        );
        const yTop = Math.min(...existingTopLevel.map((n) => n.position.y));
        origin = { x: maxX + 200, y: yTop };
      }

      // Remap IDs
      const idMap = new Map<string, string>();
      for (const n of skill.nodes) {
        idMap.set(n.id, `${n.type}-${nanoid(6)}`);
      }

      const newNodes: FluxoNode[] = skill.nodes.map((n) => {
        const newId = idMap.get(n.id)!;
        const newPos = n.parentId
          ? n.position
          : {
              x: origin.x + (n.position.x - minX),
              y: origin.y + (n.position.y - minY),
            };
        return {
          ...n,
          id: newId,
          position: newPos,
          parentId:
            n.parentId && idMap.has(n.parentId)
              ? idMap.get(n.parentId)
              : undefined,
          selected: false,
        };
      });

      const newEdges: Edge[] = skill.edges
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({
          ...e,
          id: `e-${nanoid(6)}`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
        }));

      setNodes((prev) => [...prev, ...newNodes]);
      setEdges((prev) => [...prev, ...newEdges]);

      toast({
        level: 'success',
        message: `Skill "${skill.name}" inserida`,
        detail: `${newNodes.length} nós, ${newEdges.length} conexões`,
      });
    },
    [nodes, setNodes, setEdges, pushHistory]
  );

  return {
    handleInsertSkill,
    handleSaveSelectionAsSkill,
    handleInsertUserSkill,
  };
}
