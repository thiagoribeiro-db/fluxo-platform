/**
 * Hook React do Test Playground — encapsula o `flow-runner` mantendo o
 * histórico de eventos (timeline) e a função `send` pra avançar.
 *
 * USO:
 *   const playback = usePlayback(nodes, edges);
 *   playback.start();
 *   playback.send({ userInput: 'Sim' });
 *   playback.reset();
 *   playback.timeline; // RunnerEvent[]
 *   playback.state.awaiting;
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import {
  resetRun,
  startRun,
  step,
  type RunnerEvent,
  type RunnerState,
  type StepInput,
} from './flow-runner';

export interface PlaybackHook {
  /** Lista cumulativa de todos os eventos da sessão (mensagens, choices, system, end). */
  timeline: RunnerEvent[];
  /** Estado do runner (currentNodeId, awaiting, finished). */
  state: RunnerState;
  /** Envia input pro próximo step. */
  send: (input: StepInput) => void;
}

const INITIAL_STATE: RunnerState = {
  currentNodeId: null,
  awaiting: { kind: 'none' },
  finished: false,
};

/**
 * Hook do Test Playground. Auto-inicia no primeiro render usando os
 * nodes/edges do snapshot — sem necessidade de chamar `start()` manualmente.
 *
 * Pra resetar a conversa: o consumidor deve remontar o componente que
 * usa este hook (típico: via key prop). É a forma mais limpa de garantir
 * que TODO state interno é zerado.
 */
export function usePlayback(
  nodes: FluxoNode[],
  edges: Edge[]
): PlaybackHook {
  // Lazy initializer — roda APENAS no primeiro render, calculando o
  // estado inicial via startRun. Garante que o auto-start é determinístico
  // e usa exatamente os nodes/edges atuais (não deps stale).
  const [timeline, setTimeline] = useState<RunnerEvent[]>(() => {
    return startRun(nodes, edges).events;
  });
  const [state, setState] = useState<RunnerState>(() => {
    return startRun(nodes, edges).state;
  });

  // Refs atualizadas a cada render (pra usar dentro de send/reset sem
  // ficar com closure stale).
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const send = useCallback(
    (input: StepInput) => {
      const result = step(nodesRef.current, edgesRef.current, state, input);
      setTimeline((prev) => [...prev, ...result.events]);
      setState(result.state);
    },
    [state]
  );

  return useMemo(
    () => ({ timeline, state, send }),
    [timeline, state, send]
  );
}

// Re-export pra quem precisa rodar fora do hook
export { resetRun };
