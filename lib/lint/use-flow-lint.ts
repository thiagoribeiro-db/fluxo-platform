/**
 * Hook React: roda o `flow-linter` com debounce sempre que nodes/edges mudam.
 *
 * USO:
 *   const { problems, severityByNodeId } = useFlowLint(nodes, edges);
 *
 * O linter é uma função pura mas pode rodar em grafos grandes — debounce
 * 500ms evita rerodar a cada mudança de drag. Pra forçar imediato,
 * passe `debounceMs={0}`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import {
  lintFlow,
  worstSeverity,
  type Problem,
  type ProblemSeverity,
} from './flow-linter';

interface UseFlowLintResult {
  problems: Problem[];
  /** Map node id → pior severity (pra colorir badges sem percorrer 2x) */
  severityByNodeId: Map<string, ProblemSeverity>;
  counts: { error: number; warning: number; info: number; total: number };
}

export function useFlowLint(
  nodes: FluxoNode[],
  edges: Edge[],
  debounceMs = 500
): UseFlowLintResult {
  const [problems, setProblems] = useState<Problem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const run = () => {
      const next = lintFlow({ nodes, edges });
      setProblems(next);
    };
    if (debounceMs === 0) {
      run();
    } else {
      timerRef.current = setTimeout(run, debounceMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, edges, debounceMs]);

  return useMemo(() => {
    const severityByNodeId = new Map<string, ProblemSeverity>();
    const byNode = new Map<string, Problem[]>();
    let error = 0, warning = 0, info = 0;
    for (const p of problems) {
      if (p.severity === 'error') error++;
      else if (p.severity === 'warning') warning++;
      else info++;
      if (p.nodeId) {
        if (!byNode.has(p.nodeId)) byNode.set(p.nodeId, []);
        byNode.get(p.nodeId)!.push(p);
      }
    }
    for (const [id, ps] of byNode) {
      const sev = worstSeverity(ps);
      if (sev) severityByNodeId.set(id, sev);
    }
    return {
      problems,
      severityByNodeId,
      counts: { error, warning, info, total: problems.length },
    };
  }, [problems]);
}
