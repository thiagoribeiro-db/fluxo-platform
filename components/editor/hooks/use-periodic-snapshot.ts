'use client';

/**
 * Hook que cria um snapshot automático da página a cada `intervalMs`
 * (default: 5 minutos) enquanto o usuário está editando ativamente.
 *
 * "Ativamente" = pelo menos 1 mudança de nodes/edges desde o último snapshot.
 * Não cria snapshots de páginas vazias nem de sessões inativas.
 *
 * Por que 5 minutos?
 *   - Curto o suficiente para limitar a perda em caso de falha
 *   - Longo o suficiente para não poluir o histórico de versões
 *   - O banco mantém até 50 versões por página; com 5 min, ~4 horas de histórico
 */

import { useEffect, useRef } from 'react';
import { createVersion } from '@/lib/actions/page-versions';
import type { FluxoNode } from '@/lib/types';
import type { Edge } from '@xyflow/react';
import type { Viewport } from '@xyflow/react';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

interface UsePeriodicSnapshotOpts {
  pageId: string | null;
  nodes: FluxoNode[];
  edges: Edge[];
  getViewport: () => Viewport;
  /** Se true, não cria snapshots (modo demo, read-only, share-view). */
  disabled?: boolean;
  intervalMs?: number;
}

export function usePeriodicSnapshot({
  pageId,
  nodes,
  edges,
  getViewport,
  disabled = false,
  intervalMs = DEFAULT_INTERVAL_MS,
}: UsePeriodicSnapshotOpts) {
  /** Flag: houve pelo menos 1 mudança desde o último snapshot. */
  const isDirtyRef = useRef(false);
  /** Ref para o state atual — evita recrear o timer ao mudar nodes. */
  const stateRef = useRef({ nodes, edges, getViewport });

  // Mantém stateRef sempre atualizado sem recriar o timer
  useEffect(() => {
    stateRef.current = { nodes, edges, getViewport };
  }, [nodes, edges, getViewport]);

  // Marca como dirty quando nodes ou edges mudam
  useEffect(() => {
    isDirtyRef.current = true;
  }, [nodes, edges]);

  // Timer periódico — criado uma vez por `pageId`
  useEffect(() => {
    if (disabled || !pageId) return;

    const interval = setInterval(async () => {
      if (!isDirtyRef.current) return;
      const { nodes: ns, edges: es, getViewport: gv } = stateRef.current;
      if (!ns || ns.length === 0) return;

      isDirtyRef.current = false; // reset antes do await (evita double-save)

      try {
        await createVersion(
          pageId,
          `Auto-snapshot ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          { nodes: ns, edges: es, viewport: gv() }
        );
      } catch (err) {
        // Não-fatal: o autosave principal ainda está rodando; isso é um backup
        // extra. Log silencioso para não alarmar o usuário.
        // eslint-disable-next-line no-console
        console.warn('[usePeriodicSnapshot] falha ao criar snapshot:', err);
        isDirtyRef.current = true; // tenta de novo no próximo ciclo
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [pageId, disabled, intervalMs]);
}
