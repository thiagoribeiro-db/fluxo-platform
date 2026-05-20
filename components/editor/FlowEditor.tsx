'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  SelectionMode,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Viewport,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Link from 'next/link';
import { nanoid } from 'nanoid';

import { nodeTypes } from '@/lib/components/nodes';
import { NODE_DEFAULTS } from '@/lib/components/nodes/defaults';
import {
  FLUXO_JUMP_TO_FRAME_EVENT,
  type JumpToFrameDetail,
} from '@/lib/components/nodes/DirecionamentoNode';
import {
  extractTrackingName,
  parseTrackingLabel,
  generateNextCodeForPrefix,
  findContainingFrameAt,
  resolveFramePrefix,
  reorganizeCodes,
  organizeLayoutByFrame,
  repairMainFlowEdges,
} from '@/lib/components/nodes/helpers';
import {
  getPositionBelow,
  getRelativePositionLeft,
  APPROX_WIDTH_BY_TYPE,
  APPROX_HEIGHT_BY_TYPE,
  EXCECAO_REL_X,
  EXCECAO_REL_Y,
} from '@/lib/components/nodes/helpers';
import type { FluxoNode, FluxoNodeData, FluxoNodeType, ProjectState } from '@/lib/types';
import { saveProjectState } from '@/lib/actions/projects';
import { savePageState, listPages } from '@/lib/actions/pages';
import type { ProjectPage } from '@/lib/types';
import Palette from './Palette';
import PropertiesPanel from './PropertiesPanel';
import ShareDialog from './ShareDialog';
import TemplateDialog from './TemplateDialog';
import BlipExportDialog from './BlipExportDialog';
import ExportVisualDialog from './ExportVisualDialog';
import BottomToolbar from './BottomToolbar';
import CommentsPanel from './CommentsPanel';
import PagesSidebar from './PagesSidebar';
import ResizableSidebar from './ResizableSidebar';
import LoadingOverlay from './LoadingOverlay';
import AIParseSummary from './AIParseSummary';
import HelperLines from './HelperLines';
import { listComments, type Comment } from '@/lib/actions/comments';

// ---------- SEED DEMO (usado quando projectId === 'demo') ----------
const DEMO_NODES: FluxoNode[] = [
  {
    id: 'frame-saudacao',
    type: 'frame',
    position: { x: 60, y: 40 },
    data: { title: 'Saudação', frameId: 'saudacao', width: 540, height: 1320 },
  },
  {
    id: 'bot-1',
    type: 'bubble-bot',
    position: { x: 140, y: 100 },
    data: {
      code: 'B001',
      text:
        'Olá! 👋 Você está no canal de assistência residencial BMG.\n\nPor aqui, vou te apoiar com o que precisa.',
    },
  },
  {
    id: 'bot-2',
    type: 'bubble-bot',
    position: { x: 140, y: 300 },
    data: { code: 'B002', text: 'Como posso te ajudar hoje?' },
  },
  {
    id: 'menu-1',
    type: 'menu',
    position: { x: 140, y: 440 },
    data: {
      code: 'M001',
      header: 'Selecione uma opção',
      options: [
        'Abertura de serviço',
        'Acompanhar chamado',
        '2ª via de boleto',
        'Cancelamento',
        'Falar com atendente',
        'Outros assuntos',
      ],
      footer: 'Enviar',
    },
  },
  {
    id: 'user-1',
    type: 'bubble-user',
    position: { x: 200, y: 800 },
    data: { code: 'U001', text: 'Abertura de serviço' },
  },
];

const DEMO_EDGES: Edge[] = [
  { id: 'e-bot1-bot2', source: 'bot-1', target: 'bot-2', animated: true },
  { id: 'e-bot2-menu', source: 'bot-2', target: 'menu-1', animated: true },
  { id: 'e-menu-user', source: 'menu-1', target: 'user-1', animated: true },
];

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

// ---------- COMPONENTE ----------

interface FlowEditorProps {
  projectId?: string;
  projectName?: string;
  initialState?: ProjectState;
  /**
   * Se setado, o editor entra em modo público/compartilhado:
   *  - 'view': read-only (sem paleta, sem painel, sem autosave, drag desativado)
   *  - 'comment': read-only + permite adicionar comentários
   *  - 'edit': edição completa via share token (autosave usa RPC SECURITY DEFINER)
   */
  shareMode?: 'view' | 'comment' | 'edit';
  /** Token do share — necessário quando shareMode='edit' (usado na RPC de save). */
  shareToken?: string;
  /** Páginas/versões do projeto (dev, hmg, prd, etc.). */
  pages?: ProjectPage[];
  activePageId?: string | null;
}

type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';

function FlowEditorInner({
  projectId,
  projectName,
  initialState,
  shareMode,
  shareToken,
  pages: initialPages,
  activePageId: initialActivePageId,
}: FlowEditorProps) {
  const isDemo = !projectId || projectId === 'demo';
  const isReadOnly = shareMode === 'view' || shareMode === 'comment';
  const isShared = !!shareMode;
  const isSharedEdit = shareMode === 'edit' && !!shareToken;
  const [pages, setPages] = useState<ProjectPage[]>(initialPages ?? []);
  const [activePageId, setActivePageId] = useState<string | null>(
    initialActivePageId ?? null
  );
  // Loading overlay: mensagem custom (null = escondido)
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);

  // Escuta events de loading externos (TemplateDialog, etc.) com timeout de
  // segurança configurável (default 30s) pra não travar o usuário caso algo
  // falhe silenciosamente. Operações com IA podem passar timeoutMs maior
  // (ex: 300000 = 5min).
  useEffect(() => {
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    function onLoading(e: Event) {
      const detail = (e as CustomEvent<{
        message: string | null;
        timeoutMs?: number;
      }>).detail;
      const msg = detail?.message ?? null;
      setLoadingMsg(msg);
      if (safetyTimer) clearTimeout(safetyTimer);
      if (msg) {
        const timeoutMs = detail?.timeoutMs ?? 30000;
        safetyTimer = setTimeout(() => setLoadingMsg(null), timeoutMs);
      }
    }
    window.addEventListener('fluxo:loading', onLoading);
    return () => {
      window.removeEventListener('fluxo:loading', onLoading);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, []);

  // ESC fecha o overlay (kill switch caso fique travado)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && loadingMsg) {
        setLoadingMsg(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loadingMsg]);

  // Normaliza zIndex: frames sempre ficam atrás (0), outros nodes na frente (1).
  // Isso evita que clicar em um filho dentro do frame selecione o frame em vez
  // do filho (React Flow seleciona o node com zIndex/posição mais alta no hit).
  // Combinado com `pointer-events: none` no body do FrameNode.
  const normalizeZIndex = (ns: FluxoNode[]): FluxoNode[] =>
    ns.map((n) => ({
      ...n,
      zIndex: n.zIndex ?? (n.type === 'frame' ? 0 : 1),
    }));

  const seedNodes = isDemo
    ? normalizeZIndex(DEMO_NODES)
    : normalizeZIndex((initialState?.nodes ?? []) as FluxoNode[]);
  const seedEdges = isDemo ? DEMO_EDGES : initialState?.edges ?? [];
  const seedViewport =
    !isDemo && initialState ? initialState.viewport : DEFAULT_VIEWPORT;

  const [nodes, setNodes, onNodesChange] = useNodesState<FluxoNode>(seedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(seedEdges);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[0] ?? null; // compat: 1º selecionado
  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIds(id ? [id] : []);
  }, []);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [autoTracking, setAutoTracking] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [blipExportOpen, setBlipExportOpen] = useState(false);
  const [visualExportOpen, setVisualExportOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  // Modo de seleção retangular: panOnDrag false, selectionOnDrag true
  const [selectMode, setSelectMode] = useState(false);

  // Undo history — snapshots (nodes, edges) das últimas N ações
  const historyRef = useRef<{ nodes: FluxoNode[]; edges: Edge[] }[]>([]);
  const isUndoingRef = useRef(false);
  const HISTORY_LIMIT = 50;

  const pushHistory = useCallback(() => {
    if (isUndoingRef.current) return; // não captura durante undo
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)) as FluxoNode[],
      edges: JSON.parse(JSON.stringify(edges)) as Edge[],
    });
    if (historyRef.current.length > HISTORY_LIMIT) {
      historyRef.current.shift();
    }
  }, [nodes, edges]);

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    isUndoingRef.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    // Libera flag no próximo tick
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 0);
  }, [setNodes, setEdges]);

  const {
    getViewport,
    screenToFlowPosition,
    setCenter,
    getInternalNode,
  } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // ---- Autosave (debounced) -----------------------------------------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(() => {
    if (isDemo || isReadOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('pending');
    saveTimer.current = setTimeout(async () => {
      try {
        const stateToSave = {
          nodes,
          edges,
          viewport: getViewport(),
        };
        // Caminho 1: usuário ANÔNIMO via share link com permission='edit'.
        // Não tem auth.uid() → usa RPC SECURITY DEFINER (saveSharedPageState/
        // saveSharedProjectState) que valida o token e bypassa RLS.
        if (isSharedEdit && shareToken) {
          const { saveSharedPageState, saveSharedProjectState } = await import(
            '@/lib/actions/shares'
          );
          if (activePageId) {
            await saveSharedPageState(shareToken, activePageId, stateToSave);
          } else {
            await saveSharedProjectState(shareToken, stateToSave);
          }
        }
        // Caminho 2: usuário AUTENTICADO (owner ou member) — actions normais
        // que dependem de RLS.
        else if (activePageId) {
          await savePageState(activePageId, stateToSave);
        } else {
          await saveProjectState(projectId!, stateToSave);
        }
        setSaveStatus('saved');
      } catch (err) {
        console.error('autosave failed:', err);
        setSaveStatus('error');
      }
    }, 1500);
  }, [
    isDemo,
    isReadOnly,
    isSharedEdit,
    shareToken,
    projectId,
    activePageId,
    nodes,
    edges,
    getViewport,
  ]);

  useEffect(() => {
    scheduleSave();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [scheduleSave]);

  // ---- Páginas: trocar e recarregar ---------------------------------------
  const handleSwitchPage = useCallback(
    async (newPageId: string) => {
      if (!projectId || newPageId === activePageId) return;
      setLoadingMsg('Trocando de página…');
      // Salva a página atual imediatamente (sem debounce)
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (activePageId) {
        try {
          await savePageState(activePageId, {
            nodes,
            edges,
            viewport: getViewport(),
          });
        } catch {
          /* ignora — vai tentar de novo no autosave */
        }
      }
      // Carrega a nova
      const newPage = pages.find((p) => p.id === newPageId);
      if (newPage) {
        setNodes((newPage.state.nodes ?? []) as FluxoNode[]);
        setEdges(newPage.state.edges ?? []);
        setActivePageId(newPageId);
      } else {
        // página não está no cache — refetch
        const fresh = await listPages(projectId);
        setPages(fresh);
        const found = fresh.find((p) => p.id === newPageId);
        if (found) {
          setNodes((found.state.nodes ?? []) as FluxoNode[]);
          setEdges(found.state.edges ?? []);
          setActivePageId(newPageId);
        }
      }
      setLoadingMsg(null);
    },
    [
      projectId,
      activePageId,
      pages,
      nodes,
      edges,
      getViewport,
      setNodes,
      setEdges,
    ]
  );

  const refetchPages = useCallback(async () => {
    if (!projectId) return;
    const fresh = await listPages(projectId);
    setPages(fresh);
    // Se a página ativa foi deletada, troca pra primeira
    if (activePageId && !fresh.some((p) => p.id === activePageId)) {
      const fallback = fresh[0];
      if (fallback) {
        setNodes((fallback.state.nodes ?? []) as FluxoNode[]);
        setEdges(fallback.state.edges ?? []);
        setActivePageId(fallback.id);
      }
    }
  }, [projectId, activePageId, setNodes, setEdges]);

  // -- Carrega comentários ao montar (refetch on-demand depois das mutações) -
  useEffect(() => {
    if (isDemo || !projectId || isReadOnly) return;
    listComments(projectId)
      .then(setComments)
      .catch(() => {
        /* silencia erro inicial */
      });
  }, [isDemo, projectId, isReadOnly]);

  // Refetch comentários on-demand — passado pro CommentsPanel
  const refetchComments = useCallback(async () => {
    if (isDemo || !projectId || isReadOnly) return;
    try {
      const data = await listComments(projectId);
      setComments(data);
    } catch {
      /* ignora */
    }
  }, [isDemo, projectId, isReadOnly]);

  // =========================================================================
  // CRIAÇÃO DE NODE (centralizada)
  // =========================================================================
  /**
   * Cria um node novo. Tudo que está dependente do tipo + autoTracking:
   *
   *   BOT bubble novo:
   *     - 1 tracking child: {slug}_exibicao (à esquerda)
   *     - Se houver bubble/menu anterior → edge automática anterior → este
   *
   *   USER bubble novo:
   *     - No BOT/MENU anterior (se houver) → cria tracking {slug-bot}_input
   *     - Cria EXCEÇÃO como child do USER (à direita, sem code)
   *     - Edge automática BOT/MENU → USER
   *
   *   Menu novo:
   *     - 3 trackings child: {slug}_exibicao, _selecao, _inesperado
   *     - Edge automática anterior → este (se anterior for bubble/menu)
   *
   *   Outros tipos: cria sem auto-tracking nem auto-connect.
   */
  const createNode = useCallback(
    (
      type: FluxoNodeType,
      opts?: { position?: { x: number; y: number }; extraData?: Partial<FluxoNodeData> }
    ) => {
      pushHistory();
      let createdId = '';
      const edgesToCreate: { id: string; source: string; target: string }[] = [];

      setNodes((prev) => {
        // 1) Resolver posição (explícita > abaixo selecionado > abaixo último > centro)
        let position = opts?.position;
        const refId = selectedId ?? lastAddedId;
        const refNode = refId ? prev.find((n) => n.id === refId) : undefined;
        if (!position) {
          position = getPositionBelow(refNode, { x: 200, y: 200 });
        }

        // 2) Resolver código por frame
        const containingFrame = findContainingFrameAt(
          position.x,
          position.y,
          prev
        );
        const prefix = resolveFramePrefix(containingFrame);

        const id = `${type}-${nanoid(6)}`;
        createdId = id;

        // Tipos que NÃO recebem code (botões, mídias, link e input user são
        // "ação/conteúdo" do bloco anterior, não unidade emissora).
        // direcionamento TEM código (é endereçável).
        // Mantenha em sincronia com helpers.ts:reorganizeCodes (NO_CODE_TYPES).
        const noCode =
          type === 'tracking' ||
          type === 'excecao' ||
          type === 'bubble-user' ||
          type === 'btn-short' ||
          type === 'btn-long' ||
          type === 'condicional' ||
          type === 'atendimento-humano' ||
          type === 'link' ||
          type === 'midia-imagem-bot' ||
          type === 'midia-imagem-user' ||
          type === 'midia-documento-bot' ||
          type === 'midia-documento-user' ||
          type === 'midia-video-bot' ||
          type === 'midia-video-user';
        const code =
          type === 'frame'
            ? resolveFramePrefix({
                ...({} as FluxoNode),
                data: {
                  ...(NODE_DEFAULTS[type] as FluxoNodeData),
                  ...(opts?.extraData ?? {}),
                },
              } as FluxoNode)
            : noCode
            ? undefined
            : generateNextCodeForPrefix(prefix, prev);

        const newNode: FluxoNode = {
          id,
          type,
          position,
          // zIndex: frame fica atrás (0), outros na frente (1)
          zIndex: type === 'frame' ? 0 : 1,
          data: {
            ...NODE_DEFAULTS[type],
            ...(code !== undefined ? { code } : {}),
            ...(opts?.extraData ?? {}),
          },
        };

        let nextNodes: FluxoNode[] = [...prev, newNode];

        // Helpers locais ----
        // Tipos que participam do fluxo de mensagens (auto-edge sequencial)
        const isFlowNode = (t?: string) =>
          t === 'bubble-bot' ||
          t === 'bubble-user' ||
          t === 'menu' ||
          t === 'midia-imagem-bot' ||
          t === 'midia-imagem-user' ||
          t === 'midia-documento-bot' ||
          t === 'midia-documento-user' ||
          t === 'midia-video-bot' ||
          t === 'midia-video-user';

        // Tipos que se comportam como "USER recebendo input" — disparam
        // tracking_input no anterior + exceção como child
        const isUserInput = (t?: string) =>
          t === 'bubble-user' ||
          t === 'midia-imagem-user' ||
          t === 'midia-documento-user' ||
          t === 'midia-video-user';

        // Helper: deriva NOME CURTO do bloco (pra usar em label de tracking).
        // Substitui o antigo `getSlug` — agora usa palavras-chave separadas por
        // ESPAÇO em vez de underscore, e ignora stopwords PT.
        const getTrackingName = (n: FluxoNode | undefined): string => {
          if (!n) return '';
          const t = n.type as FluxoNodeType;
          if (t === 'bubble-bot' || t === 'bubble-user') {
            return extractTrackingName((n.data.text as string | undefined) ?? '');
          }
          if (t === 'menu') {
            return extractTrackingName((n.data.header as string | undefined) ?? '');
          }
          if (t?.startsWith('midia-')) {
            return extractTrackingName(
              (n.data.caption as string | undefined) ??
                (n.data.filename as string | undefined) ??
                ''
            );
          }
          return extractTrackingName((n.data.label as string | undefined) ?? '');
        };

        // 3) Auto-connect: se o anterior é flowNode e o novo também → liga
        if (
          autoTracking &&
          isFlowNode(type) &&
          refNode &&
          isFlowNode(refNode.type)
        ) {
          edgesToCreate.push({
            id: `e-${refNode.id}-${id}`,
            source: refNode.id,
            target: id,
          });
        }

        if (!autoTracking) return nextNodes;

        // 4) Tracking auto pra BOT e Menu (children do próprio newNode)
        if (type === 'bubble-bot' || type === 'menu') {
          const name = getTrackingName(newNode);

          const kinds: string[] =
            type === 'bubble-bot'
              ? ['exibicao']
              : ['exibicao', 'selecao', 'inesperado'];

          kinds.forEach((kind, idx) => {
            const tId = `tracking-${nanoid(6)}`;
            nextNodes = [
              ...nextNodes,
              {
                id: tId,
                type: 'tracking',
                parentId: id,
                position: getRelativePositionLeft(idx),
                data: { label: `${name} ${kind}` },
              },
            ];
            // SEM edge: tracking é "filho" visual do bubble (via parentId),
            // não é parte do fluxo de mensagens.
          });
        }

        // 5) Quando criar um nó tipo "USER input" (bubble-user OU mídia-user):
        //    a) Tracking _input no nó anterior do fluxo (child dele, empilhado)
        //    b) Exceção como child desse nó (à direita, sem code)
        if (isUserInput(type)) {
          // (a) Tracking de input no anterior (bot/menu/mídia-bot)
          if (
            refNode &&
            refNode.type &&
            isFlowNode(refNode.type) &&
            !isUserInput(refNode.type)
          ) {
            const refName = getTrackingName(refNode);

            // Conta trackings já filhos do anterior pra empilhar abaixo
            const existingTrackings = nextNodes.filter(
              (n) => n.type === 'tracking' && n.parentId === refNode.id
            );
            const stackIdx = existingTrackings.length;

            const tId = `tracking-${nanoid(6)}`;
            nextNodes = [
              ...nextNodes,
              {
                id: tId,
                type: 'tracking',
                parentId: refNode.id,
                position: getRelativePositionLeft(stackIdx),
                data: { label: `${refName} input` },
              },
            ];
          }

          // (b) Exceção à direita do USER input, sem code, sem edge
          const eId = `excecao-${nanoid(6)}`;
          nextNodes = [
            ...nextNodes,
            {
              id: eId,
              type: 'excecao',
              parentId: id,
              position: { x: EXCECAO_REL_X, y: EXCECAO_REL_Y },
              data: { label: 'Exceção / Fallback' },
            },
          ];
        }

        return nextNodes;
      });

      // Cria as edges acumuladas
      if (edgesToCreate.length > 0) {
        setEdges((prev) => [
          ...prev,
          ...edgesToCreate.map((e) => ({ ...e, animated: true })),
        ]);
      }

      setLastAddedId(createdId);
      setSelectedId(createdId);
      return createdId;
    },
    [selectedId, lastAddedId, autoTracking, setNodes, setEdges, pushHistory]
  );

  // =========================================================================
  // Conexão entre nodes
  // =========================================================================
  const onConnect = useCallback(
    (params: Connection) => {
      pushHistory();
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    },
    [setEdges, pushHistory]
  );

  // Captura snapshot ANTES de iniciar drag dos nodes
  const onNodeDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  // =========================================================================
  // Seleção
  // =========================================================================
  const onSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[]; edges: Edge[] }) => {
      setSelectedIds(selected.map((n) => n.id));
    },
    []
  );

  // =========================================================================
  // Update / Duplicate / Delete
  // =========================================================================
  const updateNodeData = useCallback(
    (patch: Partial<FluxoNodeData>) => {
      if (!selectedId) return;
      pushHistory();
      setNodes((prev) => {
        const selected = prev.find((n) => n.id === selectedId);
        if (!selected) return prev;

        // ----- RE-SYNC de trackings filhos -----
        // Se o usuário alterou o texto-fonte do nome (bot.text / menu.header /
        // midia-*.caption), as labels dos trackings filhos auto-gerados
        // (formato "{nome antigo} {sufixo}") precisam virar
        // "{nome novo} {sufixo}". Labels que NÃO terminam com sufixo conhecido
        // (exibicao/selecao/inesperado/input) ficam intactos — assume-se
        // customização do usuário.
        const type = selected.type;
        let oldSource: string | undefined;
        let newSource: string | undefined;
        if (
          (type === 'bubble-bot' || type === 'bubble-user') &&
          patch.text !== undefined
        ) {
          oldSource = (selected.data.text as string | undefined) ?? '';
          newSource = patch.text as string;
        } else if (type === 'menu' && patch.header !== undefined) {
          oldSource = (selected.data.header as string | undefined) ?? '';
          newSource = patch.header as string;
        } else if (
          typeof type === 'string' &&
          type.startsWith('midia-') &&
          patch.caption !== undefined
        ) {
          oldSource = (selected.data.caption as string | undefined) ?? '';
          newSource = patch.caption as string;
        }

        const newName =
          newSource !== undefined ? extractTrackingName(newSource) : '';
        const shouldResync =
          oldSource !== undefined &&
          newSource !== undefined &&
          extractTrackingName(oldSource) !== newName;

        return prev.map((n) => {
          if (n.id === selectedId) {
            return { ...n, data: { ...n.data, ...patch } };
          }
          // Tracking auto-gerado filho do node alterado → re-slug
          if (
            shouldResync &&
            n.type === 'tracking' &&
            n.parentId === selectedId
          ) {
            const currentLabel = n.data.label as string | undefined;
            if (!currentLabel) return n;
            const parsed = parseTrackingLabel(currentLabel);
            if (!parsed) return n; // não casa com formato auto — customizado
            return {
              ...n,
              data: { ...n.data, label: `${newName} ${parsed.suffix}` },
            };
          }
          return n;
        });
      });
    },
    [selectedId, setNodes, pushHistory]
  );

  const duplicateNode = useCallback(() => {
    if (!selectedId) return;
    const orig = nodes.find((n) => n.id === selectedId);
    if (!orig || !orig.type) return;
    pushHistory();
    const newId = `${orig.type}-${nanoid(6)}`;
    const newPosition = {
      x: orig.position.x + 40,
      y: orig.position.y + 40,
    };
    const containingFrame = findContainingFrameAt(
      newPosition.x,
      newPosition.y,
      nodes
    );
    const prefix = resolveFramePrefix(containingFrame);
    const code =
      orig.type === 'frame' ? prefix : generateNextCodeForPrefix(prefix, nodes);
    setNodes((prev) => [
      ...prev,
      {
        ...orig,
        id: newId,
        position: newPosition,
        selected: true,
        data: { ...orig.data, code },
      },
    ]);
    setSelectedId(newId);
    setLastAddedId(newId);
  }, [selectedId, nodes, setNodes, pushHistory]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;

    // Pula travados e avisa
    const lockedHit = selectedIds.some((id) => {
      const n = nodes.find((x) => x.id === id);
      return n?.data?.locked === true;
    });
    if (lockedHit) {
      // eslint-disable-next-line no-alert
      alert(
        'Há frame(s) travado(s) na seleção. Destrave nas propriedades antes de apagar.'
      );
      return;
    }

    pushHistory();
    // IDs a deletar = selecionados + todos children (parentId em selecionados)
    const toDelete = new Set<string>(selectedIds);
    for (const n of nodes) {
      if (n.parentId && toDelete.has(n.parentId)) {
        toDelete.add(n.id);
      }
    }
    setNodes((prev) => prev.filter((n) => !toDelete.has(n.id)));
    setEdges((prev) =>
      prev.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target))
    );
    if (lastAddedId && toDelete.has(lastAddedId)) setLastAddedId(null);
    setSelectedIds([]);
  }, [selectedIds, nodes, lastAddedId, setNodes, setEdges, pushHistory]);

  // =========================================================================
  // Atalhos de teclado
  // =========================================================================
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl/Cmd + Z → undo
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'z' &&
        !e.shiftKey
      ) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl/Cmd + C → copia o texto principal do(s) node(s) selecionado(s)
      // pra área de transferência. Resolve o "campo principal" por tipo:
      //  - bot/user: data.text
      //  - menu: data.header
      //  - btn-short/btn-long/direcionamento/excecao/tracking/condicional: data.label
      //  - condicional: data.condition (prioritário) ou label
      //  - frame: data.title
      //  - link: data.linkTitle
      //  - mídias: data.caption || data.filename
      //  - integracao/iag: data.title
      //  - atendimento-humano: data.label
      // Múltiplos selecionados → junta com newline.
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'c' &&
        selectedIds.length > 0
      ) {
        const lines: string[] = [];
        for (const id of selectedIds) {
          const n = nodes.find((nn) => nn.id === id);
          if (!n) continue;
          const d = n.data ?? {};
          const value =
            (d.condition as string | undefined) ??
            (d.label as string | undefined) ??
            (d.text as string | undefined) ??
            (d.header as string | undefined) ??
            (d.linkTitle as string | undefined) ??
            (d.title as string | undefined) ??
            (d.caption as string | undefined) ??
            (d.filename as string | undefined) ??
            (d.code as string | undefined) ??
            '';
          if (value) lines.push(value);
        }
        if (lines.length > 0) {
          e.preventDefault();
          const text = lines.join('\n');
          navigator.clipboard
            .writeText(text)
            .then(() => {
              // Feedback visual via overlay loading (some imediatamente)
              window.dispatchEvent(
                new CustomEvent('fluxo:loading', {
                  detail: { message: `📋 Copiado (${text.length} chars)` },
                })
              );
              setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent('fluxo:loading', {
                    detail: { message: null },
                  })
                );
              }, 700);
            })
            .catch((err) => {
              console.error('[copy] falha:', err);
            });
          return;
        }
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'Escape') {
        setSelectedIds([]);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedId) {
          e.preventDefault();
          duplicateNode();
        }
      } else if (e.key === 'h' || e.key === 'H') {
        // Atalho H: modo Mover (pan canvas)
        setSelectMode(false);
      } else if (e.key === 'v' || e.key === 'V') {
        // Atalho V: modo Selecionar (rubber band)
        setSelectMode(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedIds, nodes, deleteSelected, duplicateNode, handleUndo]);

  // =========================================================================
  // Drag-and-drop da paleta
  // =========================================================================
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/fluxo-node-type') as
        | FluxoNodeType
        | '';
      if (!type || !(type in NODE_DEFAULTS)) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      createNode(type, { position });
    },
    [createNode, screenToFlowPosition]
  );

  // =========================================================================
  // Jump-to-node — centraliza o canvas num nó específico
  // =========================================================================
  const handleJumpToNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      // Resolve posição ABSOLUTA (se for child, soma com parent)
      let x = node.position.x;
      let y = node.position.y;
      if (node.parentId) {
        const parent = nodes.find((n) => n.id === node.parentId);
        if (parent) {
          x += parent.position.x;
          y += parent.position.y;
        }
      }

      // Centro do nó
      const type = node.type as FluxoNodeType;
      const width =
        (node.data?.width as number | undefined) ??
        APPROX_WIDTH_BY_TYPE[type] ??
        240;
      const height =
        (node.data?.height as number | undefined) ??
        APPROX_HEIGHT_BY_TYPE[type] ??
        100;

      setCenter(x + width / 2, y + height / 2, {
        duration: 600,
        zoom: 1.2,
      });
      setSelectedId(nodeId);
    },
    [nodes, setCenter]
  );

  // Centraliza no destino do direcionamento.
  //
  // Resolução em 3 níveis (mais específico → menos específico):
  //  1. `targetNodeId` aponta pra um BLOCO específico (não-frame) → centra nele
  //  2. `targetNodeId` aponta pra um FRAME → centra no frame
  //  3. `targetFrameId` (slug humano) → busca o frame e centra nele
  //
  // Permite que direcionamento aponte tanto pro frame inteiro quanto pra um
  // bloco específico dentro (ex: pular pra S005 dentro da Saudação).
  const handleJumpToFrame = useCallback(
    (target: { targetNodeId?: string; targetFrameId?: string } | string) => {
      const opts =
        typeof target === 'string' ? { targetFrameId: target } : target;

      // 1) targetNodeId aponta pra bloco específico (não-frame)?
      const block =
        opts.targetNodeId &&
        nodes.find((n) => n.id === opts.targetNodeId && n.type !== 'frame');

      if (block) {
        const w =
          block.measured?.width ??
          (block.data?.width as number | undefined) ??
          200;
        const h =
          block.measured?.height ??
          (block.data?.height as number | undefined) ??
          80;
        setCenter(
          block.position.x + w / 2,
          block.position.y + h / 2,
          { duration: 700, zoom: 1 }
        );
        setSelectedId(block.id);
        return;
      }

      // 2) Frame
      const frame =
        (opts.targetNodeId &&
          nodes.find((n) => n.id === opts.targetNodeId && n.type === 'frame')) ||
        (opts.targetFrameId &&
          nodes.find(
            (n) => n.type === 'frame' && n.data?.frameId === opts.targetFrameId
          )) ||
        null;
      if (!frame) return;
      const width = (frame.data?.width as number | undefined) ?? 540;
      const height = (frame.data?.height as number | undefined) ?? 400;
      setCenter(
        frame.position.x + width / 2,
        frame.position.y + height / 2,
        { duration: 700, zoom: 0.7 }
      );
      setSelectedId(frame.id);
    },
    [nodes, setCenter, setSelectedId]
  );

  // Escuta o event 'fluxo:jump-to-frame' disparado pelos direcionamentos clickables
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<JumpToFrameDetail>).detail;
      if (detail) handleJumpToFrame(detail);
    };
    window.addEventListener(FLUXO_JUMP_TO_FRAME_EVENT, handler);
    return () => window.removeEventListener(FLUXO_JUMP_TO_FRAME_EVENT, handler);
  }, [handleJumpToFrame]);

  // =========================================================================
  // Reorganizar códigos
  // =========================================================================
  const handleRemoveEdge = useCallback(
    (edgeId: string) => {
      pushHistory();
      setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    },
    [setEdges, pushHistory]
  );

  const handleAddEdge = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      // Não duplica edge se já existe a mesma direção
      const exists = edges.some(
        (e) => e.source === sourceId && e.target === targetId
      );
      if (exists) return;
      pushHistory();
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${sourceId}-${targetId}-${Date.now().toString(36)}`,
          source: sourceId,
          target: targetId,
          animated: true,
        },
      ]);
    },
    [edges, setEdges, pushHistory]
  );

  const handleUpdateEdge = useCallback(
    (edgeId: string, patch: { source?: string; target?: string }) => {
      pushHistory();
      setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                source: patch.source ?? e.source,
                target: patch.target ?? e.target,
              }
            : e
        )
      );
    },
    [setEdges, pushHistory]
  );

  const handleReorganizeCodes = useCallback(() => {
    const ok = window.confirm(
      'Reorganizar IDs?\n\nIsso vai renumerar todos os blocos em sequência pela posição vertical (de cima pra baixo).\n\n⚠️ Códigos antigos serão perdidos. Use com cuidado se você já referenciou esses IDs em outros lugares.'
    );
    if (!ok) return;
    pushHistory();
    setNodes((prev) => reorganizeCodes(prev));
  }, [setNodes, pushHistory]);

  // Abre o modal de template (upload de arquivo, paste, ou exemplo)
  const handleOpenTemplateDialog = useCallback(() => {
    setTemplateOpen(true);
  }, []);

  const handleResetPage = useCallback(() => {
    const ok = window.confirm(
      'Resetar a página atual?\n\n⚠️ Apaga TODOS os nodes e edges desta página. Frames, bubbles, conexões — tudo.\n\nÚtil quando a página ficou em estado inválido. Não pode ser desfeito.'
    );
    if (!ok) return;
    pushHistory();
    setNodes([]);
    setEdges([]);
    setSelectedIds([]);
  }, [setNodes, setEdges, pushHistory]);

  const handleOrganizeLayout = useCallback(
    (skipConfirm = false) => {
      if (!skipConfirm) {
        const ok = window.confirm(
          'Organizar layout?\n\nOs componentes principais (bubbles, menus, mídias, integrações, IAG) serão alinhados em coluna vertical à direita de cada frame.\n\nOs frames serão redimensionados pra caber exatamente o conteúdo. Trackings e exceções movem junto.'
        );
        if (!ok) return;
      }

      pushHistory();

      // Callback: usa dimensões REAIS medidas pelo React Flow (não aproximadas)
      const getMeasured = (id: string) => {
        const internal = getInternalNode(id);
        const w = internal?.measured?.width;
        const h = internal?.measured?.height;
        if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
          return { w, h };
        }
        return undefined;
      };

      // Conserta o grafo ANTES do organize: conecta btn-shorts órfãos ao
      // seu main destino e remove edges direct main→main redundantes. O
      // organize precisa ver o grafo corrigido pra calcular branches/merges.
      const cleanedEdges = repairMainFlowEdges(edges, nodes);
      const edgesChanged =
        cleanedEdges.length !== edges.length ||
        cleanedEdges.some((e, i) => e.id !== edges[i]?.id);
      if (edgesChanged) setEdges(cleanedEdges);
      setNodes((prev) => organizeLayoutByFrame(prev, cleanedEdges, getMeasured));
    },
    [setNodes, setEdges, edges, nodes, getInternalNode, pushHistory]
  );

  // Auto-organize ao carregar com ?autoOrganize=1 (após aplicar template)
  useEffect(() => {
    if (isDemo || isReadOnly || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoOrganize') !== '1') return;

    // Aguarda nodes renderizarem pra getInternalNode().measured ficar disponível
    const t = setTimeout(() => {
      handleOrganizeLayout(true);
      // Remove o query param sem causar reload
      const url = new URL(window.location.href);
      url.searchParams.delete('autoOrganize');
      window.history.replaceState({}, '', url.toString());
    }, 1500);

    return () => clearTimeout(t);
  }, [isDemo, isReadOnly, handleOrganizeLayout]);

  // =========================================================================
  // RENDER
  // =========================================================================
  const selectedNode = selectedId
    ? nodes.find((n) => n.id === selectedId) ?? null
    : null;

  // IDs dos nós com comentários abertos (raiz, não resolvidos, ancorados)
  const nodeIdsWithComments = new Set(
    comments
      .filter((c) => !c.parent_id && !c.resolved_at && c.node_id)
      .map((c) => c.node_id as string)
  );

  // Aplica draggable=false em nodes locked OU em modo read-only.
  // Adiciona box-shadow amarelo em nós com comentários abertos.
  const displayNodes = nodes.map((n) => {
    const out: typeof n = { ...n };
    if (isReadOnly || n.data?.locked) {
      out.draggable = false;
      out.deletable = false;
      out.selectable = !isReadOnly;
    }
    if (nodeIdsWithComments.has(n.id)) {
      out.style = {
        ...n.style,
        boxShadow: '0 0 0 3px rgba(251, 191, 36, 0.85)',
        borderRadius: 12,
      };
    }
    return out;
  });

  const statusLabel = {
    idle: '',
    pending: '💾 Salvando…',
    saved: '✅ Salvo',
    error: '⚠️ Erro ao salvar',
  }[saveStatus];

  return (
    <div className="flex h-screen w-full bg-wpp-bg-chat overflow-hidden">
      {!isReadOnly && (
        <ResizableSidebar
          defaultWidth={paletteCollapsed ? 48 : 256}
          minWidth={paletteCollapsed ? 48 : 200}
          maxWidth={480}
          storageKey={
            paletteCollapsed
              ? undefined
              : 'fluxo-left-sidebar-width'
          }
        >
          {!isDemo && projectId && pages.length > 0 && !paletteCollapsed && (
            <PagesSidebar
              projectId={projectId}
              pages={pages}
              activePageId={activePageId}
              onSwitchPage={handleSwitchPage}
              onPagesChanged={refetchPages}
            />
          )}
          <Palette
            collapsed={paletteCollapsed}
            onToggle={() => setPaletteCollapsed((v) => !v)}
            onAddNode={(type) => createNode(type)}
          />
        </ResizableSidebar>
      )}

      <div
        ref={reactFlowWrapper}
        className="flex-1 relative"
        onDragOver={isReadOnly ? undefined : onDragOver}
        onDrop={isReadOnly ? undefined : onDrop}
      >
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onNodeDragStart={onNodeDragStart}
          nodeTypes={nodeTypes}
          defaultViewport={seedViewport}
          fitView={isDemo}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null}
          panOnDrag={!selectMode}
          selectionOnDrag={selectMode}
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode="Shift"
          minZoom={0.1}
          maxZoom={2.5}
        >
          <Background gap={16} size={1} />
          <Controls />
          <MiniMap nodeColor="#7857ff" maskColor="rgba(0,0,0,0.1)" />
          {/* Guias de alinhamento (linhas X/Y) durante o drag de um node */}
          <HelperLines />

          <Panel
            position="top-left"
            className="bg-white px-4 py-2 rounded-md shadow border border-gray-200 flex items-center gap-3"
          >
            {!isShared && (
              <Link
                href="/dashboard"
                className="text-blip-purple hover:underline text-sm font-medium"
              >
                ←
              </Link>
            )}
            <div>
              <div className="text-sm font-semibold text-blip-purple">
                {projectName ?? '🚀 Fluxo Platform — Editor'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {isReadOnly
                  ? '👁 Visualização (somente leitura)'
                  : isDemo
                  ? 'Modo demo (não salva)'
                  : 'Autosave ativo'}
              </div>
            </div>
          </Panel>

          {/* Toolbar central com ações do projeto (oculta em read-only) */}
          {!isDemo && !isReadOnly && (
            <Panel
              position="top-center"
              className="bg-white px-2 py-1.5 rounded-md shadow border border-gray-200 flex items-center gap-1"
            >
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="px-3 py-1 text-xs font-semibold text-white bg-blip-purple hover:bg-blip-purple-dark rounded"
                title="Gerar link de compartilhamento"
              >
                🔗 Compartilhar
              </button>
              <div className="w-px h-4 bg-gray-200" />
              {/* DEV: dump do estado pra análise — escrever em tmp/state-snapshot.json */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { dumpProjectStateToFile } = await import(
                      '@/lib/actions/debug-dump'
                    );
                    const r = await dumpProjectStateToFile(projectId);
                    alert(
                      `✅ Snapshot exportado!\n\nArquivo: ${r.path}\nProjeto: ${r.projectName}\nFrames: ${r.framesCount}\nNodes: ${r.totalNodes}`
                    );
                  } catch (err) {
                    alert(
                      `❌ ${err instanceof Error ? err.message : 'Falha no dump'}`
                    );
                  }
                }}
                className="px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                title="DEV: exporta o estado atual pra tmp/state-snapshot.json (pra análise)"
              >
                🐛 Dump JSON
              </button>
              <div className="w-px h-4 bg-gray-200" />
              <button
                type="button"
                onClick={() => {
                  setCommentsOpen((v) => !v);
                  if (!commentsOpen) setPanelCollapsed(true); // recolhe propriedades
                }}
                className={`px-3 py-1 text-xs font-medium rounded flex items-center gap-1 ${
                  commentsOpen
                    ? 'bg-yellow-100 text-yellow-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Abrir comentários"
              >
                💬 Comentários
                {comments.filter((c) => !c.parent_id && !c.resolved_at).length > 0 && (
                  <span className="bg-yellow-400 text-yellow-900 rounded-full px-1.5 py-0 text-[10px] font-bold">
                    {comments.filter((c) => !c.parent_id && !c.resolved_at).length}
                  </span>
                )}
              </button>
              <div className="w-px h-4 bg-gray-200" />
              <button
                type="button"
                onClick={() => handleOrganizeLayout(false)}
                className="px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                title="Alinha componentes principais em coluna vertical dentro de cada frame"
              >
                📐 Organizar layout
              </button>
              <div className="w-px h-4 bg-gray-200" />
              {!isDemo && !isReadOnly && projectId && (
                <>
                  <button
                    type="button"
                    onClick={() => setBlipExportOpen(true)}
                    className="px-3 py-1 text-xs font-medium text-blip-purple hover:bg-blip-purple/10 rounded"
                    title="Exporta o projeto como .zip de JSONs compatível com a plataforma Blip"
                  >
                    📦 Exportar Blip
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualExportOpen(true)}
                    className="px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                    title="Exporta o canvas como imagem (PNG / PDF / HTML)"
                  >
                    📷 Exportar imagem
                  </button>
                  <div className="w-px h-4 bg-gray-200" />
                </>
              )}
              <button
                type="button"
                onClick={handleOpenTemplateDialog}
                className="px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded"
                title="Subir arquivo de escopo, colar texto ou usar exemplo"
              >
                🌱 Carregar Template
              </button>
              <button
                type="button"
                onClick={handleResetPage}
                className="px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded"
                title="Apaga tudo desta página (canvas vazio)"
              >
                🧹 Resetar página
              </button>
              <div className="w-px h-4 bg-gray-200" />
              <button
                type="button"
                onClick={handleReorganizeCodes}
                className="px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                title="Renumera todos os IDs em sequência pela posição"
              >
                🔢 Reorganizar IDs
              </button>
              <div className="w-px h-4 bg-gray-200" />
              <label
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded cursor-pointer select-none"
                title="Quando ativo, cria tracking automaticamente ao adicionar bubbles"
              >
                <input
                  type="checkbox"
                  checked={autoTracking}
                  onChange={(e) => setAutoTracking(e.target.checked)}
                  className="rounded border-gray-300 text-blip-purple focus:ring-blip-purple"
                />
                Tracking auto
              </label>
            </Panel>
          )}

          {!isDemo && !isReadOnly && saveStatus !== 'idle' && (
            <Panel
              position="top-right"
              className="bg-white px-3 py-1.5 rounded-md shadow border border-gray-200 text-xs text-gray-600"
            >
              {statusLabel}
            </Panel>
          )}

        </ReactFlow>

        {/* Barra inferior com modos Mover/Selecionar */}
        {!isReadOnly && (
          <BottomToolbar selectMode={selectMode} onChangeMode={setSelectMode} />
        )}

        {/* Overlay de loading (trocar página, aplicar template, etc.) */}
        <LoadingOverlay visible={!!loadingMsg} message={loadingMsg ?? ''} />

        {/* Banner com resumo do parse da IA (lê de sessionStorage uma vez) */}
        {!isReadOnly && <AIParseSummary />}
      </div>

      {!isReadOnly && (
        <PropertiesPanel
          selectedNode={selectedNode}
          onUpdate={updateNodeData}
          onDelete={deleteSelected}
          onDuplicate={duplicateNode}
          collapsed={panelCollapsed}
          onToggle={() => setPanelCollapsed((v) => !v)}
          allNodes={nodes}
          allEdges={edges}
          onJumpToNode={handleJumpToNode}
          onJumpToFrame={(frameId) => handleJumpToFrame(frameId)}
          onRemoveEdge={handleRemoveEdge}
          onAddEdge={handleAddEdge}
          onUpdateEdge={handleUpdateEdge}
        />
      )}

      {!isReadOnly && !isDemo && projectId && commentsOpen && (
        <CommentsPanel
          projectId={projectId}
          nodes={nodes}
          selectedNodeId={selectedId}
          onToggle={() => setCommentsOpen(false)}
          onJumpToNode={handleJumpToNode}
          onCommentsChanged={refetchComments}
        />
      )}

      {/* Modal de compartilhamento — só pra projetos reais autenticados */}
      {!isDemo && !isReadOnly && projectId && (
        <ShareDialog
          projectId={projectId}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Modal "Carregar Template" — upload/paste/exemplo */}
      {!isDemo && !isReadOnly && projectId && (
        <TemplateDialog
          projectId={projectId}
          open={templateOpen}
          onClose={() => setTemplateOpen(false)}
        />
      )}

      {/* Modal "Exportar Blip" — gera .zip de JSONs por frame */}
      {!isDemo && !isReadOnly && projectId && blipExportOpen && (
        <BlipExportDialog
          projectId={projectId}
          projectName={projectName ?? 'fluxo'}
          currentPageId={activePageId ?? undefined}
          currentNodes={nodes as unknown as FluxoNode[]}
          currentEdges={edges as unknown as Edge[]}
          onClose={() => setBlipExportOpen(false)}
        />
      )}

      {/* Modal "Exportar imagem" — captura o canvas como PNG/PDF/HTML */}
      {visualExportOpen && (
        <ExportVisualDialog
          projectName={projectName ?? 'fluxo'}
          onClose={() => setVisualExportOpen(false)}
        />
      )}
    </div>
  );
}

export default function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
