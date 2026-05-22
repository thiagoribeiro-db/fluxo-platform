/**
 * Hook que gerencia state de páginas do projeto + troca + refetch.
 *
 * Responsabilidades:
 *   - Manter `pages` e `activePageId` em sync com o banco
 *   - `handleSwitchPage`: salva atual + marca nova como ativa NO BANCO +
 *     carrega state da nova
 *   - `refetchPages`: pull list do banco; se a ativa foi deletada,
 *     fallback pra primeira
 *
 * IMPORTANTE: `setActivePage` é chamado no banco a CADA troca pra evitar
 * dataloss em casos onde o backend lê `projects.active_page_id` (ex:
 * applyTemplate, applyEscopo). Ver fix #49 do histórico de tasks.
 */
import { useCallback, useState } from 'react';
import type { Edge, Viewport } from '@xyflow/react';
import type { FluxoNode, ProjectPage } from '@/lib/types';
import {
  listPages,
  savePageState,
  setActivePage,
} from '@/lib/actions/pages';
import { handleError } from '@/lib/utils/errors';

interface UsePagesOpts {
  projectId: string | undefined;
  initialPages?: ProjectPage[];
  initialActivePageId?: string | null;
  /** Pra salvar a página atual antes de trocar (snapshot do que tá no canvas). */
  nodes: FluxoNode[];
  edges: Edge[];
  getViewport: () => Viewport;
  /** Hook chamado ANTES de salvar/trocar — caller usa pra cancelar autosave pendente. */
  onBeforeSwitch?: () => void;
  /** Carrega state da nova página no canvas. */
  setNodes: (nodes: FluxoNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  /** Loading overlay (controlado pelo caller). */
  setLoadingMsg: (msg: string | null) => void;
}

interface UsePagesResult {
  pages: ProjectPage[];
  activePageId: string | null;
  setPages: React.Dispatch<React.SetStateAction<ProjectPage[]>>;
  setActivePageId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Troca de página: salva atual + setActivePage no banco + carrega nova */
  handleSwitchPage: (newPageId: string) => Promise<void>;
  /** Refetch da lista do banco — usado após mutações (rename/delete/create) */
  refetchPages: () => Promise<void>;
}

export function usePages({
  projectId,
  initialPages,
  initialActivePageId,
  nodes,
  edges,
  getViewport,
  onBeforeSwitch,
  setNodes,
  setEdges,
  setLoadingMsg,
}: UsePagesOpts): UsePagesResult {
  const [pages, setPages] = useState<ProjectPage[]>(initialPages ?? []);
  const [activePageId, setActivePageId] = useState<string | null>(
    initialActivePageId ?? null
  );

  const handleSwitchPage = useCallback(
    async (newPageId: string) => {
      if (!projectId || newPageId === activePageId) return;
      setLoadingMsg('Trocando de página…');
      // Caller pode cancelar autosave pendente aqui (evita corrida)
      onBeforeSwitch?.();
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
      // CRÍTICO: marca a nova página como ativa NO BANCO antes de qualquer
      // operação subsequente (templates, IA, save) que dependa de
      // `projects.active_page_id`. Sem isto, o backend escreve na página
      // antiga e sobrescreve trabalho do usuário (fix #49).
      try {
        await setActivePage(projectId, newPageId);
      } catch (err) {
        handleError(err, {
          context: 'set-active-page',
          userMessage:
            'Falha ao marcar a página como ativa. Tente trocar novamente antes de aplicar templates.',
        });
        setLoadingMsg(null);
        return;
      }
      // Carrega o state da nova
      const newPage = pages.find((p) => p.id === newPageId);
      if (newPage) {
        setNodes((newPage.state.nodes ?? []) as FluxoNode[]);
        setEdges(newPage.state.edges ?? []);
        setActivePageId(newPageId);
      } else {
        // Página não está no cache local — refetch
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
      onBeforeSwitch,
      setNodes,
      setEdges,
      setLoadingMsg,
    ]
  );

  const refetchPages = useCallback(async () => {
    if (!projectId) return;
    const fresh = await listPages(projectId);
    setPages(fresh);
    // Se a página ativa foi deletada (ex: pelo PagesSidebar), fallback pra primeira
    if (activePageId && !fresh.some((p) => p.id === activePageId)) {
      const fallback = fresh[0];
      if (fallback) {
        setNodes((fallback.state.nodes ?? []) as FluxoNode[]);
        setEdges(fallback.state.edges ?? []);
        setActivePageId(fallback.id);
      }
    }
  }, [projectId, activePageId, setNodes, setEdges]);

  return {
    pages,
    activePageId,
    setPages,
    setActivePageId,
    handleSwitchPage,
    refetchPages,
  };
}
