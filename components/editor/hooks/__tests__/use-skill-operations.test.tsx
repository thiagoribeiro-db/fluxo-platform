// @vitest-environment jsdom
/**
 * Tests pro useSkillOperations.
 *
 * Cobre as 3 operações:
 *  - handleInsertSkill: insere skill BUILTIN
 *  - handleSaveSelectionAsSkill: salva seleção como skill custom
 *  - handleInsertUserSkill: insere skill custom
 *
 * Stubbing:
 *  - track, toast, promptDialog mockados
 *  - getInternalNode, setCenter, screenToFlowPosition stubs
 *  - lib/skills/user-library importado dinamicamente — stubbed inline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import type { Skill } from '@/lib/skills';

vi.mock('@/lib/utils/errors', () => ({
  toast: vi.fn(),
}));
vi.mock('@/lib/analytics/posthog', () => ({
  track: vi.fn(),
}));
vi.mock('@/lib/utils/dialog', () => ({
  promptDialog: vi.fn(),
}));
let nanoCount = 0;
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => `nid${++nanoCount}`),
}));

// Mock dinâmico do user-library (carregado via dynamic import dentro do hook)
const extractSubgraphMock = vi.fn();
const createUserSkillMock = vi.fn();
vi.mock('@/lib/skills/user-library', () => ({
  extractSubgraph: extractSubgraphMock,
  createUserSkill: createUserSkillMock,
}));

import { useSkillOperations } from '../use-skill-operations';
import { toast } from '@/lib/utils/errors';
import { promptDialog } from '@/lib/utils/dialog';

const mockToast = vi.mocked(toast);
const mockPrompt = vi.mocked(promptDialog);

function makeFrame(id: string, x = 0, y = 0): FluxoNode {
  return {
    id,
    type: 'frame',
    position: { x, y },
    data: { title: 'F', frameId: id, prefix: 'F', width: 600, height: 400 },
  };
}

function makeBot(id: string, x = 0, y = 0): FluxoNode {
  return {
    id,
    type: 'bubble-bot',
    position: { x, y },
    data: { text: 'hi', code: id },
  };
}

interface SetupOpts {
  nodes?: FluxoNode[];
  edges?: Edge[];
  selectedIds?: string[];
}

function setup(opts: SetupOpts = {}) {
  const state = {
    nodes: opts.nodes ?? [],
    edges: opts.edges ?? [],
    selectedIds: opts.selectedIds ?? [],
  };
  const setNodes = vi.fn((next: any) => {
    state.nodes = typeof next === 'function' ? next(state.nodes) : next;
  });
  const setEdges = vi.fn((next: any) => {
    state.edges = typeof next === 'function' ? next(state.edges) : next;
  });
  const setSelectedId = vi.fn();
  const pushHistory = vi.fn();
  // Tipado largo pra permitir mockImplementation com retorno detalhado depois.
  type InternalNodeStub = {
    measured?: { width?: number; height?: number };
    internals: { positionAbsolute?: { x: number; y: number } };
    position: { x: number; y: number };
  };
  const getInternalNode = vi.fn(
    (_id: string): InternalNodeStub | undefined => undefined
  );
  const setCenter = vi.fn();
  const screenToFlowPosition = vi.fn((p: { x: number; y: number }) => p);
  const wrap = document.createElement('div');
  Object.defineProperty(wrap, 'getBoundingClientRect', {
    value: () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
    }),
  });
  const reactFlowWrapper = { current: wrap } as RefObject<HTMLDivElement>;

  const { result } = renderHook(() =>
    useSkillOperations({
      nodes: state.nodes,
      edges: state.edges,
      selectedIds: state.selectedIds,
      setNodes,
      setEdges,
      setSelectedId,
      pushHistory,
      getInternalNode,
      setCenter,
      screenToFlowPosition,
      reactFlowWrapper,
    })
  );

  return {
    result,
    state,
    setNodes,
    setEdges,
    setSelectedId,
    pushHistory,
    getInternalNode,
    setCenter,
    screenToFlowPosition,
    reactFlowWrapper,
  };
}

function makeSkill(opts: Partial<Skill> = {}): Skill {
  const defaults: Skill = {
    id: 'test-skill',
    title: 'Test Skill',
    description: 'desc',
    category: 'utility',
    emoji: '🧪',
    keywords: [],
    build: ({ origin }) => ({
      nodes: [
        {
          id: 'sk1',
          type: 'bubble-bot',
          position: { x: origin.x, y: origin.y },
          data: { text: 'skill-bot', code: 'SK001' },
        },
      ],
      edges: [],
      entryNodeId: 'sk1',
      exitNodeId: null,
    }),
  };
  return { ...defaults, ...opts };
}

describe('useSkillOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    nanoCount = 0;
  });

  describe('handleInsertSkill', () => {
    it('empurra história e insere skill em canvas vazio', () => {
      const { result, state, pushHistory } = setup();
      const skill = makeSkill();

      act(() => result.current.handleInsertSkill(skill));

      expect(pushHistory).toHaveBeenCalledOnce();
      // Skill foi adicionada (1 node novo)
      expect(state.nodes.length).toBeGreaterThan(0);
      const skillNode = state.nodes.find((n) => n.data?.code === 'SK001');
      expect(skillNode).toBeDefined();
    });

    it('posiciona skill à direita do conteúdo existente', () => {
      const existing = makeBot('b1', 100, 100);
      const { result, state } = setup({ nodes: [existing] });
      const skill = makeSkill();

      act(() => result.current.handleInsertSkill(skill));

      const skillNode = state.nodes.find((n) => n.data?.code === 'SK001');
      expect(skillNode).toBeDefined();
      // skill começa à direita do conteúdo existente (origin.x > 100)
      expect(skillNode!.position.x).toBeGreaterThan(100);
    });

    it('emite toast de sucesso ao inserir', () => {
      const { result } = setup();
      const skill = makeSkill({ title: 'Encerramento' });

      act(() => result.current.handleInsertSkill(skill));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'success',
          message: expect.stringContaining('Encerramento'),
        })
      );
    });

    it('agenda câmera pro entry node depois do delay', () => {
      const { result, setCenter, setSelectedId, getInternalNode } = setup();
      getInternalNode.mockImplementation((id: string) => {
        if (id === 'sk1') {
          return {
            measured: { width: 240, height: 80 },
            internals: { positionAbsolute: { x: 500, y: 100 } },
            position: { x: 500, y: 100 },
          };
        }
        return undefined;
      });
      const skill = makeSkill();

      act(() => result.current.handleInsertSkill(skill));

      // Antes do timer, setCenter não foi chamado
      expect(setCenter).not.toHaveBeenCalled();

      // Avança o timer pro CAMERA_PAN_AFTER_CREATE
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(setCenter).toHaveBeenCalledOnce();
      expect(setSelectedId).toHaveBeenCalledWith('sk1');
    });
  });

  describe('handleSaveSelectionAsSkill', () => {
    it('emite warn quando nada está selecionado', async () => {
      const { result } = setup({ selectedIds: [] });

      await act(async () => {
        await result.current.handleSaveSelectionAsSkill();
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warn' })
      );
    });

    it('emite warn quando subgraph extraído está vazio', async () => {
      extractSubgraphMock.mockReturnValueOnce({ nodes: [], edges: [] });
      const bot = makeBot('b1');
      const { result } = setup({
        nodes: [bot],
        selectedIds: ['b1'],
      });

      await act(async () => {
        await result.current.handleSaveSelectionAsSkill();
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warn' })
      );
    });

    it('aborta quando user cancela o prompt do nome', async () => {
      extractSubgraphMock.mockReturnValueOnce({
        nodes: [makeBot('b1')],
        edges: [],
      });
      mockPrompt.mockResolvedValueOnce(null);
      const { result } = setup({
        nodes: [makeBot('b1')],
        selectedIds: ['b1'],
      });

      await act(async () => {
        await result.current.handleSaveSelectionAsSkill();
      });

      expect(createUserSkillMock).not.toHaveBeenCalled();
    });

    it('cria skill quando user fornece nome', async () => {
      extractSubgraphMock.mockReturnValueOnce({
        nodes: [makeBot('b1'), makeBot('b2')],
        edges: [],
      });
      mockPrompt.mockResolvedValueOnce('Minha Skill');
      createUserSkillMock.mockReturnValueOnce({ name: 'Minha Skill' });
      const { result } = setup({
        nodes: [makeBot('b1'), makeBot('b2')],
        selectedIds: ['b1', 'b2'],
      });

      await act(async () => {
        await result.current.handleSaveSelectionAsSkill();
      });

      expect(createUserSkillMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Minha Skill' })
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'success',
          message: expect.stringContaining('Minha Skill'),
        })
      );
    });
  });

  describe('handleInsertUserSkill', () => {
    it('emite erro se skill sem top-level nodes', async () => {
      const { result, pushHistory } = setup();
      const skill = {
        name: 'Vazia',
        nodes: [
          { ...makeBot('c1'), parentId: 'orfao' } as FluxoNode,
        ],
        edges: [],
      };

      await act(async () => {
        await result.current.handleInsertUserSkill(skill);
      });

      expect(pushHistory).toHaveBeenCalledOnce();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error' })
      );
    });

    it('insere skill custom com IDs remapeados', async () => {
      const { result, state } = setup();
      const skill = {
        name: 'Skill Custom',
        nodes: [
          makeBot('orig1', 0, 0),
          makeBot('orig2', 100, 0),
        ],
        edges: [
          { id: 'oe1', source: 'orig1', target: 'orig2' } as Edge,
        ],
      };

      await act(async () => {
        await result.current.handleInsertUserSkill(skill);
      });

      // Nodes não devem manter os IDs originais
      const origIds = state.nodes.map((n) => n.id);
      expect(origIds).not.toContain('orig1');
      expect(origIds).not.toContain('orig2');
      expect(state.nodes).toHaveLength(2);
      expect(state.edges).toHaveLength(1);
    });

    it('emite toast de sucesso com contagem de nós/conexões', async () => {
      const { result } = setup();
      const skill = {
        name: 'X',
        nodes: [makeBot('o1')],
        edges: [],
      };

      await act(async () => {
        await result.current.handleInsertUserSkill(skill);
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'success',
          message: expect.stringContaining('X'),
        })
      );
    });

    it('remaps parentId nos children quando o pai é remapeado', async () => {
      const { result, state } = setup();
      const parent = makeBot('p-orig');
      const child: FluxoNode = {
        ...makeBot('c-orig'),
        parentId: 'p-orig',
      };
      const skill = {
        name: 'Skill com pai',
        nodes: [parent, child],
        edges: [],
      };

      await act(async () => {
        await result.current.handleInsertUserSkill(skill);
      });

      const childInserted = state.nodes.find(
        (n) => (n.data?.code as string) === 'c-orig'
      );
      expect(childInserted).toBeDefined();
      // parentId remapeado (não mais 'p-orig')
      expect(childInserted!.parentId).not.toBe('p-orig');
      // E aponta pra algum nó inserido
      const parentInserted = state.nodes.find(
        (n) => n.id === childInserted!.parentId
      );
      expect(parentInserted).toBeDefined();
    });
  });
});
