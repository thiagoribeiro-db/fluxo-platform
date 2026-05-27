'use client';

/**
 * useFlowOperations — encapsula 4 operações de manipulação de nodes:
 *  - duplicateNode (Cmd+D, multi-select)
 *  - groupSelectedInFrame (Cmd+G)
 *  - alignSelected (align/distribute)
 *  - deleteSelected (Del, com cascade pra trackings vinculados)
 *
 * Extraído do FlowEditor pra:
 *  - Reduzir o god-component (eram ~250 LOC de handlers)
 *  - Permitir testar essas operações em isolamento no futuro
 *  - Deixar o FlowEditor mais focado em orquestração + render
 *
 * Não acopla com react-flow runtime (não usa useReactFlow). Recebe tudo
 * que precisa via props.
 */

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import {
  findContainingFrameAt,
  resolveFramePrefix,
  generateNextCodeForPrefix,
  getNodeBox,
} from '@/lib/components/nodes/helpers';
import { alignNodes, type AlignOp } from '@/lib/components/nodes/align';
import { toast } from '@/lib/utils/errors';
import { loadVersioned, saveVersioned } from '@/lib/utils/storage';

/** Formato persistido no localStorage pra clipboard de nodes (cross-project). */
interface NodeClipboard {
  nodes: FluxoNode[];
  edges: Edge[];
  copiedAt: string;
}

export interface UseFlowOperationsInput {
  nodes: FluxoNode[];
  edges: Edge[];
  selectedIds: string[];
  setNodes: (updater: (prev: FluxoNode[]) => FluxoNode[]) => void;
  setEdges: (updater: (prev: Edge[]) => Edge[]) => void;
  setSelectedIds: (ids: string[]) => void;
  setLastAddedId: (id: string | null) => void;
  pushHistory: () => void;
  lastAddedId: string | null;
  /** Retorna o viewport atual do React Flow — usado pra posicionar o paste no centro da tela. */
  getViewport: () => { x: number; y: number; zoom: number };
}

export interface UseFlowOperationsResult {
  duplicateNode: () => void;
  groupSelectedInFrame: () => void;
  alignSelected: (op: AlignOp) => void;
  deleteSelected: () => void;
  /** Serializa nodes selecionados + edges internas pro clipboard de nodes (localStorage). */
  copyNodesToClipboard: () => void;
  /** Cola nodes do clipboard de nodes no canvas atual, centrando no viewport. */
  pasteNodes: () => void;
}

export function useFlowOperations({
  nodes,
  edges,
  selectedIds,
  setNodes,
  setEdges,
  setSelectedIds,
  setLastAddedId,
  pushHistory,
  lastAddedId,
  getViewport,
}: UseFlowOperationsInput): UseFlowOperationsResult {
  // -------------------------------------------------------------------------
  // Duplicar nodes selecionados (1 ou N) com offset fixo (40, 40).
  // Mantém geometria relativa, clona edges internas, preserva parentId entre
  // clones, limpa `createdForUserId`, regenera codes por prefix.
  // -------------------------------------------------------------------------
  const duplicateNode = useCallback(() => {
    if (selectedIds.length === 0) return;
    const origs = selectedIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is NonNullable<typeof n> => !!n && !!n.type);
    if (origs.length === 0) return;

    pushHistory();

    const OFFSET = 40;
    const idMap = new Map<string, string>();
    for (const o of origs) idMap.set(o.id, `${o.type}-${nanoid(6)}`);

    let acc = [...nodes];
    const clones: FluxoNode[] = [];
    for (const orig of origs) {
      const newId = idMap.get(orig.id)!;
      const newPosition = {
        x: orig.position.x + OFFSET,
        y: orig.position.y + OFFSET,
      };
      const containingFrame = findContainingFrameAt(
        newPosition.x,
        newPosition.y,
        acc
      );
      const prefix = resolveFramePrefix(containingFrame);
      const code =
        orig.type === 'frame' ? prefix : generateNextCodeForPrefix(prefix, acc);
      const newParentId =
        orig.parentId && idMap.has(orig.parentId)
          ? idMap.get(orig.parentId)
          : orig.parentId;
      const origData = (orig.data ?? {}) as Record<string, unknown>;
      const { createdForUserId: _drop, ...restData } = origData;
      void _drop;
      const clone: FluxoNode = {
        ...orig,
        id: newId,
        position: newPosition,
        selected: true,
        parentId: newParentId,
        data: { ...restData, code },
      };
      clones.push(clone);
      acc = [...acc, clone];
    }

    const internalEdges: Edge[] = edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: `e-${nanoid(6)}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));

    setNodes((prev) => [...prev, ...clones]);
    if (internalEdges.length > 0) {
      setEdges((prev) => [...prev, ...internalEdges]);
    }

    const newIds = Array.from(idMap.values());
    setSelectedIds(newIds);
    setLastAddedId(newIds[newIds.length - 1] ?? null);
  }, [
    selectedIds,
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectedIds,
    setLastAddedId,
    pushHistory,
  ]);

  // -------------------------------------------------------------------------
  // Agrupa selecionados num frame novo com padding. Não muda parentId dos
  // selecionados — mains seguem position absoluta dentro da bbox.
  // -------------------------------------------------------------------------
  const groupSelectedInFrame = useCallback(() => {
    const targets = selectedIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is NonNullable<typeof n> => !!n && n.type !== 'frame');
    if (targets.length < 1) {
      toast({
        level: 'info',
        message: 'Selecione pelo menos um bloco (não-frame) pra agrupar.',
      });
      return;
    }

    const absBox = (n: FluxoNode) => {
      const local = getNodeBox(n);
      let ax = local.x;
      let ay = local.y;
      let cur = n;
      while (cur.parentId) {
        const p = nodes.find((x) => x.id === cur.parentId);
        if (!p) break;
        ax += p.position.x;
        ay += p.position.y;
        cur = p;
      }
      return { x: ax, y: ay, w: local.w, h: local.h };
    };

    const boxes = targets.map(absBox);
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));

    const PADDING_X = 40;
    const PADDING_TOP = 64;
    const PADDING_BOTTOM = 40;

    pushHistory();

    const frameId = `frame-${nanoid(6)}`;
    const frameSlug = `grupo-${nanoid(4)}`;
    const newFrame: FluxoNode = {
      id: frameId,
      type: 'frame',
      position: { x: minX - PADDING_X, y: minY - PADDING_TOP },
      zIndex: 0,
      data: {
        title: 'Grupo',
        frameId: frameSlug,
        width: maxX - minX + 2 * PADDING_X,
        height: maxY - minY + PADDING_TOP + PADDING_BOTTOM,
      },
    };

    setNodes((prev) => [newFrame, ...prev]);
    setSelectedIds([frameId]);
    setLastAddedId(frameId);

    toast({
      level: 'success',
      message: `Frame "Grupo" criado englobando ${targets.length} bloco(s).`,
    });
  }, [selectedIds, nodes, setNodes, setSelectedIds, setLastAddedId, pushHistory]);

  // -------------------------------------------------------------------------
  // Aplica align/distribute. Função pura em `lib/components/nodes/align.ts`.
  // -------------------------------------------------------------------------
  const alignSelected = useCallback(
    (op: AlignOp) => {
      if (selectedIds.length < 2) {
        toast({
          level: 'info',
          message: 'Selecione 2+ blocos pra alinhar (3+ pra distribuir).',
        });
        return;
      }
      pushHistory();
      setNodes((prev) => alignNodes(prev, selectedIds, op));
    },
    [selectedIds, setNodes, pushHistory]
  );

  // -------------------------------------------------------------------------
  // Deleta selecionados (com cascade pra children e tracking inputs vinculados
  // por `createdForUserId`).
  // -------------------------------------------------------------------------
  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;

    const lockedHit = selectedIds.some((id) => {
      const n = nodes.find((x) => x.id === id);
      return n?.data?.locked === true;
    });
    if (lockedHit) {
      toast({
        level: 'warn',
        message:
          'Há frame(s) travado(s) na seleção. Destrave nas propriedades antes de apagar.',
      });
      return;
    }

    pushHistory();
    const toDelete = new Set<string>(selectedIds);
    for (const n of nodes) {
      if (n.parentId && toDelete.has(n.parentId)) {
        toDelete.add(n.id);
      }
    }
    // Cascade: tracking inputs vinculados a um bubble-user selecionado
    for (const n of nodes) {
      if (n.type === 'tracking') {
        const createdFor = (n.data as Record<string, unknown> | undefined)
          ?.createdForUserId as string | undefined;
        if (createdFor && toDelete.has(createdFor)) {
          toDelete.add(n.id);
        }
      }
    }
    setNodes((prev) => prev.filter((n) => !toDelete.has(n.id)));
    setEdges((prev) =>
      prev.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target))
    );
    if (lastAddedId && toDelete.has(lastAddedId)) setLastAddedId(null);
    setSelectedIds([]);
  }, [
    selectedIds,
    nodes,
    lastAddedId,
    setNodes,
    setEdges,
    setSelectedIds,
    setLastAddedId,
    pushHistory,
  ]);

  // -------------------------------------------------------------------------
  // Copiar nodes selecionados pro clipboard de nodes (localStorage).
  // Persiste a estrutura completa (nodes + edges internas) pra colar
  // em qualquer projeto — mesmo após fechar a aba.
  // -------------------------------------------------------------------------
  const copyNodesToClipboard = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const selectedNodes = nodes.filter((n) => selectedSet.has(n.id));
    const internalEdges = edges.filter(
      (e) => selectedSet.has(e.source) && selectedSet.has(e.target)
    );
    saveVersioned('node-clipboard', 1, {
      nodes: selectedNodes,
      edges: internalEdges,
      copiedAt: new Date().toISOString(),
    } satisfies NodeClipboard);
  }, [nodes, edges, selectedIds]);

  // -------------------------------------------------------------------------
  // Colar nodes do clipboard de nodes no canvas atual.
  //  - Remapeia todos os IDs (novos nanoids)
  //  - Preserva parentId somente se o parent também estava no clipboard
  //  - Posiciona no centro do viewport atual (não nas coordenadas originais)
  //  - Deseleciona tudo antes e seleciona os novos nodes
  //  - Não regenera codes — usuário pode rodar "Reordenar IDs" depois
  // -------------------------------------------------------------------------
  const pasteNodes = useCallback(() => {
    const clipboard = loadVersioned<NodeClipboard | null>('node-clipboard', 1, {
      defaultValue: null,
    });
    if (!clipboard || clipboard.nodes.length === 0) return;

    pushHistory();

    // 1. Mapa de IDs: id original → novo id
    const idMap = new Map<string, string>();
    for (const n of clipboard.nodes) {
      idMap.set(n.id, `${n.type}-${nanoid(6)}`);
    }

    // 2. Bounding box dos nodes copiados
    const xs = clipboard.nodes.map((n) => n.position.x);
    const ys = clipboard.nodes.map((n) => n.position.y);
    const clipCX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const clipCY = (Math.min(...ys) + Math.max(...ys)) / 2;

    // 3. Centro do viewport atual em coordenadas do flow
    const vp = getViewport();
    const flowCX = (-vp.x + window.innerWidth / 2) / vp.zoom;
    const flowCY = (-vp.y + window.innerHeight / 2) / vp.zoom;

    const dx = flowCX - clipCX;
    const dy = flowCY - clipCY;

    // 4. Clonar nodes com novos IDs e posições
    const newNodes: FluxoNode[] = clipboard.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      // Preserva parentId só se o parent também veio no clipboard
      parentId:
        n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId) : undefined,
      selected: true,
      position: { x: n.position.x + dx, y: n.position.y + dy },
      data: { ...n.data },
    }));

    // 5. Remap edges internas
    const newEdges: Edge[] = clipboard.edges.map((e) => ({
      ...e,
      id: `e-${nanoid(6)}`,
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
    }));

    // 6. Atualiza canvas
    setNodes((prev) => [
      ...prev.map((n) => ({ ...n, selected: false })),
      ...newNodes,
    ]);
    if (newEdges.length > 0) setEdges((prev) => [...prev, ...newEdges]);

    const newIds = newNodes.map((n) => n.id);
    setSelectedIds(newIds);
    setLastAddedId(newIds[newIds.length - 1] ?? null);

    const count = newNodes.length;
    toast({
      level: 'info',
      message: `📋 ${count} nó${count !== 1 ? 's' : ''} colado${count !== 1 ? 's' : ''}`,
    });
  }, [getViewport, setNodes, setEdges, setSelectedIds, setLastAddedId, pushHistory]);

  return {
    duplicateNode,
    groupSelectedInFrame,
    alignSelected,
    deleteSelected,
    copyNodesToClipboard,
    pasteNodes,
  };
}
