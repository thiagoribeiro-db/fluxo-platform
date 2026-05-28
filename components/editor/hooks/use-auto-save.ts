'use client';

/**
 * Hook de autosave — salva nodes/edges no banco com debounce + garantias
 * contra perda de dados.
 *
 * Estratégia de 4 camadas:
 *
 *  1. DEBOUNCE (1.5s de inatividade)
 *     Save dispara 1.5s após a última mudança. Evita writes excessivos durante
 *     drag ou edição rápida.
 *
 *  2. MAX WAIT (30s de edição contínua)
 *     Se o usuário editar sem parar, o save é forçado a cada 30s mesmo sem
 *     pausa. Sem isso, uma sessão longa de edição contínua perderia tudo se
 *     a aba fosse fechada no meio.
 *
 *  3. RETRY (1 tentativa automática após falha)
 *     Se o save falhar (rede instável, timeout), agenda uma nova tentativa em
 *     10s. Se o usuário editar antes do retry, o retry é cancelado e o debounce
 *     normal assume.
 *
 *  4. FLUSH DE EMERGÊNCIA (beforeunload + visibilitychange)
 *     `beforeunload`: envia via `fetch keepalive` quando o usuário fecha/recarrega
 *       a aba — o browser completa o request mesmo após o documento ser destruído.
 *     `visibilitychange`: salva via Server Action quando a aba vai pra background
 *       (cobre mobile onde beforeunload não é confiável).
 *
 * Suporta 3 caminhos de destino:
 *   1. Share link com permission=edit (RPC SECURITY DEFINER)
 *   2. Auth normal com active_page_id → savePageState
 *   3. Auth legado sem pages → saveProjectState
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Viewport } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import { savePageState } from '@/lib/actions/pages';
import { saveProjectState } from '@/lib/actions/projects';

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';

interface UseAutoSaveOpts {
  nodes: FluxoNode[];
  edges: Edge[];
  getViewport: () => Viewport;
  projectId: string | undefined;
  activePageId: string | null;
  isDemo: boolean;
  isReadOnly: boolean;
  isSharedEdit: boolean;
  shareToken: string | undefined;
  /** Debounce: salva N ms após a última mudança. Default 1500ms. */
  debounceMs?: number;
  /** Max wait: força save após N ms de edição contínua. Default 30000ms. */
  maxWaitMs?: number;
}

interface UseAutoSaveResult {
  saveStatus: SaveStatus;
  /** Cancela timers pendentes. Útil pra integração externa (ex: troca de página). */
  cancelPending: () => void;
  /** Força um save imediato (ignora debounce). Usado antes de operações destrutivas. */
  flushNow: () => Promise<void>;
}

const DEFAULT_DEBOUNCE = 1500;
const DEFAULT_MAX_WAIT = 30_000;
const RETRY_DELAY = 10_000;

export function useAutoSave({
  nodes,
  edges,
  getViewport,
  projectId,
  activePageId,
  isDemo,
  isReadOnly,
  isSharedEdit,
  shareToken,
  debounceMs = DEFAULT_DEBOUNCE,
  maxWaitMs = DEFAULT_MAX_WAIT,
}: UseAutoSaveOpts): UseAutoSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Timers
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref com o state mais recente — sempre atualizado, lido pelos timers e handlers
  const latestStateRef = useRef<{ nodes: FluxoNode[]; edges: Edge[] }>({ nodes, edges });
  const hasPendingRef = useRef(false);

  // Mantém latestStateRef sincronizado sem recriar scheduleSave a cada render
  useEffect(() => {
    latestStateRef.current = { nodes, edges };
  }, [nodes, edges]);

  // -------------------------------------------------------------------------
  // doSave: lógica central de persistência. Chamada por todos os caminhos.
  // -------------------------------------------------------------------------
  const doSave = useCallback(async (ns: FluxoNode[], es: Edge[]) => {
    if (isDemo || isReadOnly) return;
    hasPendingRef.current = false;

    // Cancela retry pendente (este save já substitui)
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }

    try {
      const stateToSave = { nodes: ns, edges: es, viewport: getViewport() };

      if (isSharedEdit && shareToken) {
        const { saveSharedPageState, saveSharedProjectState } = await import(
          '@/lib/actions/shares'
        );
        if (activePageId) {
          await saveSharedPageState(shareToken, activePageId, stateToSave);
        } else {
          await saveSharedProjectState(shareToken, stateToSave);
        }
      } else if (activePageId) {
        await savePageState(activePageId, stateToSave);
      } else if (projectId) {
        await saveProjectState(projectId, stateToSave);
      }

      setSaveStatus('saved');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[autosave] failed:', err);
      setSaveStatus('error');

      // Retry automático em 10s — se o usuário editar antes, o retry é
      // cancelado e o debounce normal assume (evita double-save).
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        const { nodes: rns, edges: res } = latestStateRef.current;
        void doSave(rns, res);
      }, RETRY_DELAY);
    }
  }, [
    isDemo,
    isReadOnly,
    isSharedEdit,
    shareToken,
    projectId,
    activePageId,
    getViewport,
  ]);

  // -------------------------------------------------------------------------
  // cancelPending: limpa todos os timers
  // -------------------------------------------------------------------------
  const cancelPending = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (maxWaitTimer.current) {
      clearTimeout(maxWaitTimer.current);
      maxWaitTimer.current = null;
    }
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    hasPendingRef.current = false;
  }, []);

  // -------------------------------------------------------------------------
  // flushNow: salva imediatamente, cancelando debounce pendente
  // -------------------------------------------------------------------------
  const flushNow = useCallback(async () => {
    cancelPending();
    const { nodes: ns, edges: es } = latestStateRef.current;
    await doSave(ns, es);
  }, [cancelPending, doSave]);

  // -------------------------------------------------------------------------
  // scheduleSave: debounce + maxWait
  // -------------------------------------------------------------------------
  const scheduleSave = useCallback(() => {
    if (isDemo || isReadOnly) return;

    setSaveStatus('pending');
    hasPendingRef.current = true;

    // Cancela retry pendente — o usuário editou, o debounce assume
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }

    // Debounce: reset a cada mudança
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      // Cancela maxWait (debounce venceu)
      if (maxWaitTimer.current) {
        clearTimeout(maxWaitTimer.current);
        maxWaitTimer.current = null;
      }
      const { nodes: ns, edges: es } = latestStateRef.current;
      void doSave(ns, es);
    }, debounceMs);

    // MaxWait: dispara só se ainda não há um timer de maxWait rodando.
    // Garante save mesmo durante edição contínua (ex: arrasta node por 2min).
    if (!maxWaitTimer.current) {
      maxWaitTimer.current = setTimeout(() => {
        maxWaitTimer.current = null;
        // Cancela debounce (maxWait venceu)
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = null;
        }
        const { nodes: ns, edges: es } = latestStateRef.current;
        void doSave(ns, es);
      }, maxWaitMs);
    }
  }, [isDemo, isReadOnly, debounceMs, maxWaitMs, doSave]);

  // Dispara scheduleSave quando nodes ou edges mudam.
  // `nodes` e `edges` são adicionados às deps explicitamente para que o
  // efeito reexecute a cada mudança (triggering o debounce), mesmo que
  // `scheduleSave` seja estável (não inclui nodes/edges nas suas próprias deps).
  useEffect(() => {
    scheduleSave();
    return cancelPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleSave, cancelPending, nodes, edges]);

  // -------------------------------------------------------------------------
  // Flush de emergência: beforeunload + visibilitychange
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isDemo || isReadOnly) return;

    const handleBeforeUnload = () => {
      if (!hasPendingRef.current) return;
      cancelPending();

      const { nodes: ns, edges: es } = latestStateRef.current;
      const body = JSON.stringify({ nodes: ns, edges: es, viewport: getViewport() });

      if (activePageId) {
        fetch(`/api/autosave/page/${activePageId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {/* melhor esforço */});
      } else if (projectId) {
        fetch(`/api/autosave/project/${projectId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {/* melhor esforço */});
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden' || !hasPendingRef.current) return;
      cancelPending();
      const { nodes: ns, edges: es } = latestStateRef.current;
      void doSave(ns, es);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isDemo, isReadOnly, activePageId, projectId, getViewport, cancelPending, doSave]);

  return { saveStatus, cancelPending, flushNow };
}
