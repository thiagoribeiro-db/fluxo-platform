/**
 * Diff entre dois ProjectState (snapshots de versão).
 *
 * Classifica cada node e edge como:
 *  - added    → existe no `current` mas não no `previous` (esta versão)
 *  - removed  → existe no `previous` mas não no `current`
 *  - modified → existe em ambos mas com data/position diferente
 *  - unchanged → idênticos (mostrado só no contador, não listado)
 *
 * Função PURA — sem dependência de runtime. Testável.
 */
import type { Edge } from '@xyflow/react';
import type { FluxoNode, ProjectState } from '@/lib/types';

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface NodeDiff {
  id: string;
  status: DiffStatus;
  /** Tipo do node (do current, ou do previous se removed). */
  type: string;
  /** Code/label humano pra exibir no UI. */
  label: string;
  code?: string;
  /** Frame onde está (resolvido por bbox no current, ou no previous se removed). */
  frameLabel?: string;
  /** Pra `modified`: campos que mudaram (paths em node.data). */
  changedFields?: string[];
  /** Pra `modified`: descrição textual da mudança (1 frase). */
  changeSummary?: string;
}

export interface EdgeDiff {
  id: string;
  status: DiffStatus;
  source: string;
  target: string;
  /** Pra `modified`: campos que mudaram (source/target/sourceHandle). */
  changedFields?: string[];
}

export interface ProjectDiff {
  nodes: NodeDiff[];
  edges: EdgeDiff[];
  counts: {
    nodesAdded: number;
    nodesRemoved: number;
    nodesModified: number;
    nodesUnchanged: number;
    edgesAdded: number;
    edgesRemoved: number;
    edgesModified: number;
    edgesUnchanged: number;
  };
}

/**
 * Compara dois states e retorna o diff classificado.
 *
 * @param previous Estado da versão antiga (snapshot)
 * @param current Estado atual (no canvas)
 */
export function diffStates(previous: ProjectState, current: ProjectState): ProjectDiff {
  const prevNodes = previous.nodes ?? [];
  const currNodes = current.nodes ?? [];
  const prevEdges = previous.edges ?? [];
  const currEdges = current.edges ?? [];

  // ---- Nodes ----------------------------------------------------------
  const prevById = new Map(prevNodes.map((n) => [n.id, n]));
  const currById = new Map(currNodes.map((n) => [n.id, n]));

  const nodes: NodeDiff[] = [];
  const counts = {
    nodesAdded: 0,
    nodesRemoved: 0,
    nodesModified: 0,
    nodesUnchanged: 0,
    edgesAdded: 0,
    edgesRemoved: 0,
    edgesModified: 0,
    edgesUnchanged: 0,
  };

  // Adicionados (em current mas não em prev) + modificados
  for (const curr of currNodes) {
    const prev = prevById.get(curr.id);
    if (!prev) {
      counts.nodesAdded++;
      nodes.push({
        id: curr.id,
        status: 'added',
        type: curr.type ?? 'unknown',
        label: describeNode(curr),
        code: curr.data?.code as string | undefined,
        frameLabel: resolveFrame(curr, currNodes),
      });
      continue;
    }
    const diff = nodeDiff(prev, curr);
    if (diff.changedFields.length > 0) {
      counts.nodesModified++;
      nodes.push({
        id: curr.id,
        status: 'modified',
        type: curr.type ?? 'unknown',
        label: describeNode(curr),
        code: curr.data?.code as string | undefined,
        frameLabel: resolveFrame(curr, currNodes),
        changedFields: diff.changedFields,
        changeSummary: diff.summary,
      });
    } else {
      counts.nodesUnchanged++;
    }
  }

  // Removidos (em prev mas não em curr)
  for (const prev of prevNodes) {
    if (currById.has(prev.id)) continue;
    counts.nodesRemoved++;
    nodes.push({
      id: prev.id,
      status: 'removed',
      type: prev.type ?? 'unknown',
      label: describeNode(prev),
      code: prev.data?.code as string | undefined,
      frameLabel: resolveFrame(prev, prevNodes),
    });
  }

  // ---- Edges ----------------------------------------------------------
  const prevEdgeById = new Map(prevEdges.map((e) => [e.id, e]));
  const currEdgeById = new Map(currEdges.map((e) => [e.id, e]));

  const edges: EdgeDiff[] = [];

  for (const curr of currEdges) {
    const prev = prevEdgeById.get(curr.id);
    if (!prev) {
      counts.edgesAdded++;
      edges.push({
        id: curr.id,
        status: 'added',
        source: curr.source,
        target: curr.target,
      });
      continue;
    }
    const changedFields = edgeDiffFields(prev, curr);
    if (changedFields.length > 0) {
      counts.edgesModified++;
      edges.push({
        id: curr.id,
        status: 'modified',
        source: curr.source,
        target: curr.target,
        changedFields,
      });
    } else {
      counts.edgesUnchanged++;
    }
  }

  for (const prev of prevEdges) {
    if (currEdgeById.has(prev.id)) continue;
    counts.edgesRemoved++;
    edges.push({
      id: prev.id,
      status: 'removed',
      source: prev.source,
      target: prev.target,
    });
  }

  return { nodes, edges, counts };
}

// =============================================================================
// HELPERS INTERNOS
// =============================================================================

/** Descreve um node em 1 linha legível (truncate em 60 chars). */
function describeNode(n: FluxoNode): string {
  const d = n.data ?? {};
  const truncate = (s: string, max = 60) =>
    s.length > max ? s.slice(0, max - 1) + '…' : s;
  const text =
    (d.title as string | undefined) ??
    (d.text as string | undefined) ??
    (d.header as string | undefined) ??
    (d.label as string | undefined) ??
    (d.condition as string | undefined) ??
    (d.caption as string | undefined) ??
    (d.linkTitle as string | undefined) ??
    '';
  return text ? truncate(text) : n.type ?? n.id;
}

/** Resolve o frame que contém um node (por bbox). */
function resolveFrame(node: FluxoNode, allNodes: FluxoNode[]): string | undefined {
  if (node.type === 'frame') return undefined;
  const frames = allNodes.filter((n) => n.type === 'frame');
  for (const f of frames) {
    const fLeft = f.position.x;
    const fTop = f.position.y;
    const fW = (f.data?.width as number | undefined) ?? 540;
    const fH = (f.data?.height as number | undefined) ?? 400;
    const cx = node.position.x + 50;
    const cy = node.position.y + 25;
    if (cx >= fLeft && cx <= fLeft + fW && cy >= fTop && cy <= fTop + fH) {
      return (f.data?.title as string | undefined) ?? (f.data?.frameId as string | undefined) ?? 'Frame';
    }
  }
  return undefined;
}

interface NodeDiffResult {
  changedFields: string[];
  summary: string;
}

/**
 * Compara dois nodes (mesmo ID) e retorna lista de campos que mudaram.
 * Cobre: position, data (deep compare por key), parentId, type.
 */
function nodeDiff(prev: FluxoNode, curr: FluxoNode): NodeDiffResult {
  const changed: string[] = [];

  // Position
  if (
    Math.abs(prev.position.x - curr.position.x) > 1 ||
    Math.abs(prev.position.y - curr.position.y) > 1
  ) {
    changed.push('position');
  }

  // Type (raro mas pode acontecer)
  if (prev.type !== curr.type) {
    changed.push('type');
  }

  // ParentId
  if (prev.parentId !== curr.parentId) {
    changed.push('parentId');
  }

  // Data — compara por key
  const prevData = (prev.data ?? {}) as Record<string, unknown>;
  const currData = (curr.data ?? {}) as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(prevData), ...Object.keys(currData)]);
  for (const key of allKeys) {
    const pv = prevData[key];
    const cv = currData[key];
    if (!deepEqual(pv, cv)) {
      changed.push(`data.${key}`);
    }
  }

  return {
    changedFields: changed,
    summary: buildSummary(changed, prevData, currData),
  };
}

/** Sumário textual curto das mudanças. */
function buildSummary(
  changed: string[],
  prevData: Record<string, unknown>,
  currData: Record<string, unknown>
): string {
  if (changed.length === 0) return '';

  // Prioriza mudanças visíveis (text, label, etc.) sobre position
  const visibleFields = ['data.text', 'data.label', 'data.header', 'data.title', 'data.condition'];
  const visibleChange = changed.find((c) => visibleFields.includes(c));
  if (visibleChange) {
    const key = visibleChange.replace('data.', '');
    const pv = (prevData[key] as string | undefined) ?? '';
    const cv = (currData[key] as string | undefined) ?? '';
    const truncate = (s: string) => (s.length > 40 ? s.slice(0, 39) + '…' : s);
    return `"${truncate(pv)}" → "${truncate(cv)}"`;
  }

  if (changed.includes('position')) {
    return changed.length === 1 ? 'Movido' : `Movido + ${changed.length - 1} campo(s)`;
  }

  return `${changed.length} campo(s) alterado(s)`;
}

/** Lista campos que mudaram numa edge. */
function edgeDiffFields(prev: Edge, curr: Edge): string[] {
  const changed: string[] = [];
  if (prev.source !== curr.source) changed.push('source');
  if (prev.target !== curr.target) changed.push('target');
  if (prev.sourceHandle !== curr.sourceHandle) changed.push('sourceHandle');
  if (prev.targetHandle !== curr.targetHandle) changed.push('targetHandle');
  return changed;
}

/** Deep equal simples — suficiente pra valores serializáveis (JSON). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  // Arrays
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (Array.isArray(b)) return false;
  // Objects
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k]
    )
  );
}
