// @vitest-environment jsdom
/**
 * Tests pro useFlowOperations.
 *
 * Cobre as 4 operações principais:
 *  - duplicateNode (single + multi)
 *  - groupSelectedInFrame
 *  - alignSelected
 *  - deleteSelected (com cascade de tracking + filhos)
 *
 * Stubbing mínimo:
 *  - toast → mock (verificável)
 *  - nanoid → previsível
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';

vi.mock('@/lib/utils/errors', () => ({
  toast: vi.fn(),
}));

// nanoid retorna IDs previsíveis pra inspeção
let nanoCount = 0;
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => `nid${++nanoCount}`),
}));

import { useFlowOperations } from '../use-flow-operations';
import { toast } from '@/lib/utils/errors';

const mockToast = vi.mocked(toast);

function makeBot(id: string, x = 0, y = 0, extra: Record<string, unknown> = {}): FluxoNode {
  return {
    id,
    type: 'bubble-bot',
    position: { x, y },
    data: { text: 'hi', code: id, ...extra },
  };
}

function makeFrame(id: string, x = 0, y = 0): FluxoNode {
  return {
    id,
    type: 'frame',
    position: { x, y },
    data: { title: 'F', frameId: id, prefix: 'F', width: 600, height: 400 },
  };
}

function makeTracking(id: string, createdForUserId?: string): FluxoNode {
  return {
    id,
    type: 'tracking',
    position: { x: 0, y: 0 },
    data: createdForUserId ? { createdForUserId } : {},
  };
}

interface SetupOpts {
  nodes?: FluxoNode[];
  edges?: Edge[];
  selectedIds?: string[];
  lastAddedId?: string | null;
}

function setup(opts: SetupOpts = {}) {
  const state = {
    nodes: opts.nodes ?? [],
    edges: opts.edges ?? [],
    selectedIds: opts.selectedIds ?? [],
    lastAddedId: opts.lastAddedId ?? null,
  };
  const setNodes = vi.fn((updater: any) => {
    state.nodes = typeof updater === 'function' ? updater(state.nodes) : updater;
  });
  const setEdges = vi.fn((updater: any) => {
    state.edges = typeof updater === 'function' ? updater(state.edges) : updater;
  });
  const setSelectedIds = vi.fn((ids: string[]) => {
    state.selectedIds = ids;
  });
  const setLastAddedId = vi.fn((id: string | null) => {
    state.lastAddedId = id;
  });
  const pushHistory = vi.fn();

  const { result } = renderHook(() =>
    useFlowOperations({
      nodes: state.nodes,
      edges: state.edges,
      selectedIds: state.selectedIds,
      setNodes,
      setEdges,
      setSelectedIds,
      setLastAddedId,
      pushHistory,
      lastAddedId: state.lastAddedId,
    })
  );

  return {
    result,
    state,
    setNodes,
    setEdges,
    setSelectedIds,
    setLastAddedId,
    pushHistory,
  };
}

describe('useFlowOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nanoCount = 0;
  });

  describe('duplicateNode', () => {
    it('não faz nada quando seleção está vazia', () => {
      const { result, pushHistory, setNodes } = setup({ selectedIds: [] });
      act(() => result.current.duplicateNode());
      expect(pushHistory).not.toHaveBeenCalled();
      expect(setNodes).not.toHaveBeenCalled();
    });

    it('duplica 1 node com offset (40, 40)', () => {
      const bot = makeBot('b1', 100, 100);
      const { result, state, pushHistory, setNodes, setSelectedIds } = setup({
        nodes: [bot],
        selectedIds: ['b1'],
      });

      act(() => result.current.duplicateNode());

      expect(pushHistory).toHaveBeenCalledOnce();
      expect(setNodes).toHaveBeenCalledOnce();
      const newNodes = state.nodes;
      expect(newNodes).toHaveLength(2);
      const clone = newNodes.find((n) => n.id !== 'b1')!;
      expect(clone.position).toEqual({ x: 140, y: 140 });
      expect(clone.type).toBe('bubble-bot');
      expect(setSelectedIds).toHaveBeenCalledWith([clone.id]);
    });

    it('duplica N nodes mantendo geometria relativa', () => {
      const b1 = makeBot('b1', 0, 0);
      const b2 = makeBot('b2', 100, 0);
      const { result, state } = setup({
        nodes: [b1, b2],
        selectedIds: ['b1', 'b2'],
      });

      act(() => result.current.duplicateNode());

      expect(state.nodes).toHaveLength(4);
      const clones = state.nodes.filter((n) => n.id !== 'b1' && n.id !== 'b2');
      // Geometria relativa preservada: distância x continua 100
      const xs = clones.map((c) => c.position.x).sort((a, b) => a - b);
      expect(xs[1] - xs[0]).toBe(100);
    });

    it('clona edges internas entre os duplicados', () => {
      const b1 = makeBot('b1');
      const b2 = makeBot('b2', 200);
      const edge: Edge = { id: 'e1', source: 'b1', target: 'b2' };
      const { result, state, setEdges } = setup({
        nodes: [b1, b2],
        edges: [edge],
        selectedIds: ['b1', 'b2'],
      });

      act(() => result.current.duplicateNode());

      expect(setEdges).toHaveBeenCalledOnce();
      // Edge nova entre clones
      expect(state.edges).toHaveLength(2);
      const newEdge = state.edges.find((e) => e.id !== 'e1')!;
      expect(newEdge.source).not.toBe('b1');
      expect(newEdge.target).not.toBe('b2');
    });

    it('remove createdForUserId no clone (não vincula a tracking original)', () => {
      const bot = makeBot('b1', 0, 0, { createdForUserId: 'orig-user' });
      const { result, state } = setup({
        nodes: [bot],
        selectedIds: ['b1'],
      });

      act(() => result.current.duplicateNode());

      const clone = state.nodes.find((n) => n.id !== 'b1')!;
      expect(clone.data).not.toHaveProperty('createdForUserId');
    });
  });

  describe('groupSelectedInFrame', () => {
    it('emite toast info quando nenhum bloco não-frame é selecionado', () => {
      const { result, setNodes } = setup({ selectedIds: [] });

      act(() => result.current.groupSelectedInFrame());

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info' })
      );
      expect(setNodes).not.toHaveBeenCalled();
    });

    it('cria frame "Grupo" englobando os selecionados', () => {
      const b1 = makeBot('b1', 100, 100);
      const b2 = makeBot('b2', 300, 200);
      const { result, state, pushHistory, setSelectedIds } = setup({
        nodes: [b1, b2],
        selectedIds: ['b1', 'b2'],
      });

      act(() => result.current.groupSelectedInFrame());

      expect(pushHistory).toHaveBeenCalledOnce();
      const newFrame = state.nodes.find((n) => n.type === 'frame');
      expect(newFrame).toBeDefined();
      expect(newFrame!.data?.title).toBe('Grupo');
      // Frame deve englobar (com padding) o bbox dos selecionados
      expect(newFrame!.position.x).toBeLessThan(100);
      expect(newFrame!.position.y).toBeLessThan(100);
      expect(setSelectedIds).toHaveBeenCalledWith([newFrame!.id]);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success' })
      );
    });

    it('ignora frames na seleção (só agrupa blocos)', () => {
      const f1 = makeFrame('f1');
      const b1 = makeBot('b1', 100, 100);
      const { result, state } = setup({
        nodes: [f1, b1],
        selectedIds: ['f1', 'b1'],
      });

      act(() => result.current.groupSelectedInFrame());

      // 1 frame original + 1 frame novo + 1 bot = 3
      expect(state.nodes).toHaveLength(3);
    });
  });

  describe('alignSelected', () => {
    it('emite info toast se menos de 2 selecionados', () => {
      const bot = makeBot('b1');
      const { result, setNodes } = setup({
        nodes: [bot],
        selectedIds: ['b1'],
      });

      act(() => result.current.alignSelected('align-left'));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info' })
      );
      expect(setNodes).not.toHaveBeenCalled();
    });

    it('aplica align quando 2+ selecionados', () => {
      const b1 = makeBot('b1', 100, 100);
      const b2 = makeBot('b2', 200, 50);
      const { result, pushHistory, setNodes } = setup({
        nodes: [b1, b2],
        selectedIds: ['b1', 'b2'],
      });

      act(() => result.current.alignSelected('align-left'));

      expect(pushHistory).toHaveBeenCalledOnce();
      expect(setNodes).toHaveBeenCalledOnce();
    });
  });

  describe('deleteSelected', () => {
    it('não faz nada se seleção vazia', () => {
      const { result, pushHistory, setNodes } = setup({ selectedIds: [] });
      act(() => result.current.deleteSelected());
      expect(pushHistory).not.toHaveBeenCalled();
      expect(setNodes).not.toHaveBeenCalled();
    });

    it('bloqueia delete quando frame travado está na seleção', () => {
      const locked = makeFrame('f1');
      locked.data = { ...locked.data, locked: true };
      const { result, pushHistory, setNodes } = setup({
        nodes: [locked],
        selectedIds: ['f1'],
      });

      act(() => result.current.deleteSelected());

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warn' })
      );
      expect(pushHistory).not.toHaveBeenCalled();
      expect(setNodes).not.toHaveBeenCalled();
    });

    it('deleta selecionados e cascateia parentId', () => {
      const parent = makeBot('p1');
      const child: FluxoNode = {
        ...makeBot('c1'),
        parentId: 'p1',
      };
      const other = makeBot('o1');
      const { result, state } = setup({
        nodes: [parent, child, other],
        selectedIds: ['p1'],
      });

      act(() => result.current.deleteSelected());

      // p1 e c1 (cascade) removidos, o1 permanece
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe('o1');
    });

    it('cascateia tracking vinculado via createdForUserId', () => {
      const userBot = makeBot('u1');
      const tracking = makeTracking('t1', 'u1');
      const { result, state } = setup({
        nodes: [userBot, tracking],
        selectedIds: ['u1'],
      });

      act(() => result.current.deleteSelected());

      expect(state.nodes).toHaveLength(0);
    });

    it('limpa edges que tocam nodes deletados', () => {
      const b1 = makeBot('b1');
      const b2 = makeBot('b2');
      const edge: Edge = { id: 'e1', source: 'b1', target: 'b2' };
      const { result, state } = setup({
        nodes: [b1, b2],
        edges: [edge],
        selectedIds: ['b1'],
      });

      act(() => result.current.deleteSelected());

      expect(state.edges).toHaveLength(0);
      expect(state.nodes).toHaveLength(1);
    });

    it('zera lastAddedId quando o node foi deletado', () => {
      const bot = makeBot('b1');
      const { result, setLastAddedId } = setup({
        nodes: [bot],
        selectedIds: ['b1'],
        lastAddedId: 'b1',
      });

      act(() => result.current.deleteSelected());

      expect(setLastAddedId).toHaveBeenCalledWith(null);
    });

    it('limpa seleção depois de deletar', () => {
      const bot = makeBot('b1');
      const { result, setSelectedIds } = setup({
        nodes: [bot],
        selectedIds: ['b1'],
      });

      act(() => result.current.deleteSelected());

      expect(setSelectedIds).toHaveBeenCalledWith([]);
    });
  });
});
