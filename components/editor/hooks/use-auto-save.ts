/**
 * Hook de autosave debounced — salva nodes/edges no banco 1.5s após
 * a última mudança, com indicador de status (idle/pending/saved/error).
 *
 * Suporta 3 caminhos:
 *   1. Share link com permission=edit (usuário anônimo) — RPC SECURITY DEFINER
 *   2. Auth normal com active_page_id → savePageState
 *   3. Auth legado sem pages → saveProjectState
 *
 * Em read-only ou demo, vira no-op (saveStatus permanece 'idle').
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
  /** Debounce em ms. Default 1500. */
  debounceMs?: number;
}

interface UseAutoSaveResult {
  saveStatus: SaveStatus;
  /** Cancela timer pendente. Útil pra integração externa (ex: troca de página). */
  cancelPending: () => void;
}

const DEFAULT_DEBOUNCE = 1500;

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
}: UseAutoSaveOpts): UseAutoSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPending = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (isDemo || isReadOnly) return;
    cancelPending();
    setSaveStatus('pending');
    saveTimer.current = setTimeout(async () => {
      try {
        const stateToSave = { nodes, edges, viewport: getViewport() };

        // 1. Share link com edit (anônimo)
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
        // 2. Auth com active_page_id
        else if (activePageId) {
          await savePageState(activePageId, stateToSave);
        }
        // 3. Auth legado sem pages
        else if (projectId) {
          await saveProjectState(projectId, stateToSave);
        }
        setSaveStatus('saved');
      } catch (err) {
        console.error('autosave failed:', err);
        setSaveStatus('error');
      }
    }, debounceMs);
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
    debounceMs,
    cancelPending,
  ]);

  useEffect(() => {
    scheduleSave();
    return cancelPending;
  }, [scheduleSave, cancelPending]);

  return { saveStatus, cancelPending };
}
