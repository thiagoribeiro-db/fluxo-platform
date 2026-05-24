import { describe, expect, it } from 'vitest';
import type { FluxoNode, ProjectState } from '@/lib/types';
import { diffStates } from './diff';

function node(p: Partial<FluxoNode> & { id: string; type: string }): FluxoNode {
  const { id, type, position, data, ...rest } = p;
  return {
    id,
    type: type as FluxoNode['type'],
    position: position ?? { x: 0, y: 0 },
    data: data ?? {},
    ...rest,
  } as FluxoNode;
}

function state(nodes: FluxoNode[] = [], edges: ProjectState['edges'] = []): ProjectState {
  return { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } };
}

describe('diffStates', () => {
  it('retorna tudo zerado quando states são idênticos', () => {
    const s = state([
      node({ id: 'a', type: 'bubble-bot', data: { text: 'Oi' } }),
    ]);
    const d = diffStates(s, s);
    expect(d.counts.nodesAdded).toBe(0);
    expect(d.counts.nodesRemoved).toBe(0);
    expect(d.counts.nodesModified).toBe(0);
    expect(d.counts.nodesUnchanged).toBe(1);
    expect(d.nodes).toHaveLength(0); // unchanged não entra na lista
  });

  it('detecta node adicionado', () => {
    const prev = state([]);
    const curr = state([node({ id: 'new', type: 'bubble-bot', data: { text: 'Olá' } })]);
    const d = diffStates(prev, curr);
    expect(d.counts.nodesAdded).toBe(1);
    expect(d.nodes[0]).toMatchObject({
      id: 'new',
      status: 'added',
      label: 'Olá',
    });
  });

  it('detecta node removido', () => {
    const prev = state([node({ id: 'old', type: 'bubble-bot', data: { text: 'Tchau' } })]);
    const curr = state([]);
    const d = diffStates(prev, curr);
    expect(d.counts.nodesRemoved).toBe(1);
    expect(d.nodes[0]).toMatchObject({
      id: 'old',
      status: 'removed',
      label: 'Tchau',
    });
  });

  it('detecta node modificado (texto alterado)', () => {
    const prev = state([node({ id: 'b1', type: 'bubble-bot', data: { text: 'Oi' } })]);
    const curr = state([node({ id: 'b1', type: 'bubble-bot', data: { text: 'Olá!' } })]);
    const d = diffStates(prev, curr);
    expect(d.counts.nodesModified).toBe(1);
    expect(d.nodes[0]).toMatchObject({
      id: 'b1',
      status: 'modified',
      changedFields: ['data.text'],
    });
    expect(d.nodes[0].changeSummary).toContain('Oi');
    expect(d.nodes[0].changeSummary).toContain('Olá!');
  });

  it('detecta node movido (position diff > 1)', () => {
    const prev = state([
      node({ id: 'b1', type: 'bubble-bot', position: { x: 0, y: 0 }, data: { text: 'A' } }),
    ]);
    const curr = state([
      node({ id: 'b1', type: 'bubble-bot', position: { x: 100, y: 100 }, data: { text: 'A' } }),
    ]);
    const d = diffStates(prev, curr);
    expect(d.counts.nodesModified).toBe(1);
    expect(d.nodes[0].changedFields).toEqual(['position']);
    expect(d.nodes[0].changeSummary).toBe('Movido');
  });

  it('ignora diferenças de position menores que 1px', () => {
    const prev = state([
      node({ id: 'b1', type: 'bubble-bot', position: { x: 0, y: 0 }, data: {} }),
    ]);
    const curr = state([
      node({ id: 'b1', type: 'bubble-bot', position: { x: 0.5, y: 0.3 }, data: {} }),
    ]);
    const d = diffStates(prev, curr);
    expect(d.counts.nodesModified).toBe(0);
    expect(d.counts.nodesUnchanged).toBe(1);
  });

  it('detecta edge adicionada e removida', () => {
    const prev = state([], [
      { id: 'e1', source: 'a', target: 'b' },
    ]);
    const curr = state([], [
      { id: 'e2', source: 'b', target: 'c' },
    ]);
    const d = diffStates(prev, curr);
    expect(d.counts.edgesAdded).toBe(1);
    expect(d.counts.edgesRemoved).toBe(1);
    expect(d.edges.find((e) => e.status === 'added')?.id).toBe('e2');
    expect(d.edges.find((e) => e.status === 'removed')?.id).toBe('e1');
  });

  it('detecta edge modificada (sourceHandle mudou)', () => {
    const prev = state([], [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'true' },
    ]);
    const curr = state([], [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'false' },
    ]);
    const d = diffStates(prev, curr);
    expect(d.counts.edgesModified).toBe(1);
    expect(d.edges[0].changedFields).toEqual(['sourceHandle']);
  });

  it('resolve frame label pra nodes dentro de um frame', () => {
    const nodes = [
      node({
        id: 'frame-s',
        type: 'frame',
        position: { x: 0, y: 0 },
        data: { title: 'Saudação', frameId: 'saudacao', width: 500, height: 500 },
      }),
      node({
        id: 'b1',
        type: 'bubble-bot',
        position: { x: 100, y: 100 },
        data: { text: 'Oi' },
      }),
    ];
    const prev = state([nodes[0]]); // só frame
    const curr = state(nodes); // frame + bubble
    const d = diffStates(prev, curr);
    expect(d.counts.nodesAdded).toBe(1);
    expect(d.nodes[0].frameLabel).toBe('Saudação');
  });

  it('cenário misto: 1 added + 1 removed + 1 modified', () => {
    const prev = state([
      node({ id: 'a', type: 'bubble-bot', data: { text: 'A' } }),
      node({ id: 'b', type: 'bubble-bot', data: { text: 'B' } }),
    ]);
    const curr = state([
      node({ id: 'a', type: 'bubble-bot', data: { text: 'A novo' } }), // modified
      // 'b' removed
      node({ id: 'c', type: 'menu', data: { header: 'C' } }), // added
    ]);
    const d = diffStates(prev, curr);
    expect(d.counts.nodesAdded).toBe(1);
    expect(d.counts.nodesRemoved).toBe(1);
    expect(d.counts.nodesModified).toBe(1);
    expect(d.counts.nodesUnchanged).toBe(0);
  });
});
