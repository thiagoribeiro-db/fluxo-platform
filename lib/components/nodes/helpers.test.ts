import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import {
  repairMainFlowEdges,
  resolveFramePrefix,
  findOwnerFrame,
  generateNextCodeForPrefix,
} from './helpers';

// Helpers de fixture
function frame(id: string, prefix: string, title?: string): FluxoNode {
  return {
    id,
    type: 'frame',
    position: { x: 0, y: 0 },
    data: { prefix, title: title ?? prefix, width: 600, height: 400 },
  };
}

function bot(id: string, code: string, x = 0, y = 0): FluxoNode {
  return {
    id,
    type: 'bubble-bot',
    position: { x, y },
    data: { code, text: `texto ${code}` },
  };
}

function btn(id: string, label: string, x = 0, y = 0): FluxoNode {
  return {
    id,
    type: 'btn-short',
    position: { x, y },
    data: { buttonText: label },
  };
}

function edge(source: string, target: string, sourceHandle?: 'true' | 'false'): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
  };
}

describe('resolveFramePrefix', () => {
  it('usa data.prefix se setado', () => {
    expect(resolveFramePrefix(frame('f1', 'OF'))).toBe('OF');
  });

  it('extrai iniciais do title se sem prefix', () => {
    const f: FluxoNode = {
      id: 'f',
      type: 'frame',
      position: { x: 0, y: 0 },
      data: { title: 'Algo Mais' },
    };
    expect(resolveFramePrefix(f)).toBe('AM');
  });

  it('retorna X como fallback', () => {
    expect(resolveFramePrefix(undefined)).toBe('X');
    const empty: FluxoNode = {
      id: 'f',
      type: 'frame',
      position: { x: 0, y: 0 },
      data: {},
    };
    expect(resolveFramePrefix(empty)).toBe('X');
  });
});

describe('findOwnerFrame', () => {
  it('match por code prefix wins sobre containment espacial', () => {
    const fS = frame('frame-s', 'S');
    const fOF = frame('frame-of', 'OF');
    // Bubble S001 posicionado bem longe (provavelmente "dentro" de outro frame)
    const node = bot('n1', 'S001', 9999, 9999);
    expect(findOwnerFrame(node, [fS, fOF, node])?.id).toBe('frame-s');
  });

  it('frame undefined quando node sem code e fora de qualquer frame', () => {
    const fS = frame('frame-s', 'S');
    // bubble-user sem code, longe
    const node: FluxoNode = {
      id: 'u1',
      type: 'bubble-user',
      position: { x: 9999, y: 9999 },
      data: {},
    };
    expect(findOwnerFrame(node, [fS, node])).toBeUndefined();
  });
});

describe('generateNextCodeForPrefix', () => {
  it('retorna primeiro disponível', () => {
    expect(generateNextCodeForPrefix('S', [])).toBe('S001');
    expect(
      generateNextCodeForPrefix('S', [bot('a', 'S001'), bot('b', 'S003')])
    ).toBe('S002');
  });

  it('ignora codes de outros prefixos', () => {
    expect(
      generateNextCodeForPrefix('OF', [
        bot('a', 'S001'),
        bot('b', 'S002'),
        bot('c', 'OF005'),
      ])
    ).toBe('OF001');
  });
});

describe('repairMainFlowEdges', () => {
  it('conecta btns órfãos ao main filho quando há edge atalho main→main', () => {
    // Estrutura: A → btnSim, A → btnNao, A → B (atalho) — btns sem saída
    const nodes = [
      bot('A', 'X001'),
      bot('B', 'X002'),
      btn('btn-sim', 'Sim'),
      btn('btn-nao', 'Não'),
    ];
    const edges = [
      edge('A', 'btn-sim'),
      edge('A', 'btn-nao'),
      edge('A', 'B'),
    ];
    const result = repairMainFlowEdges(edges, nodes);
    // Esperado: removeu A→B, criou btn-sim→B, btn-nao→B
    const directAB = result.find(
      (e) => e.source === 'A' && e.target === 'B'
    );
    expect(directAB, 'edge direta A→B foi removida').toBeUndefined();
    const fromSim = result.filter(
      (e) => e.source === 'btn-sim' && e.target === 'B'
    );
    expect(fromSim).toHaveLength(1);
    const fromNao = result.filter(
      (e) => e.source === 'btn-nao' && e.target === 'B'
    );
    expect(fromNao).toHaveLength(1);
  });

  it('remove edge main→main redundante quando há caminho alternativo via btn', () => {
    // A → btn → B (já existe), e A → B redundante
    const nodes = [bot('A', 'X001'), bot('B', 'X002'), btn('btn1', 'opt')];
    const edges = [
      edge('A', 'btn1'),
      edge('btn1', 'B'),
      edge('A', 'B'), // redundante
    ];
    const result = repairMainFlowEdges(edges, nodes);
    expect(result.find((e) => e.source === 'A' && e.target === 'B')).toBeUndefined();
    expect(result.find((e) => e.source === 'A' && e.target === 'btn1')).toBeDefined();
    expect(result.find((e) => e.source === 'btn1' && e.target === 'B')).toBeDefined();
  });

  it('preserva edge main→main legítima sem btn intermediário', () => {
    // A → B sem btns: cadeia linear
    const nodes = [bot('A', 'X001'), bot('B', 'X002')];
    const edges = [edge('A', 'B')];
    const result = repairMainFlowEdges(edges, nodes);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('A');
    expect(result[0].target).toBe('B');
  });

  it('não dispara repair quando há ambiguidade (>1 destino direto)', () => {
    // A tem 2 edges diretas pra mains diferentes + btn órfão → ambíguo
    const nodes = [
      bot('A', 'X001'),
      bot('B', 'X002'),
      bot('C', 'X003'),
      btn('btn1', 'opt'),
    ];
    const edges = [
      edge('A', 'btn1'),
      edge('A', 'B'),
      edge('A', 'C'),
    ];
    const result = repairMainFlowEdges(edges, nodes);
    // Não conserta: mantém edges originais
    expect(result.find((e) => e.source === 'A' && e.target === 'B')).toBeDefined();
    expect(result.find((e) => e.source === 'A' && e.target === 'C')).toBeDefined();
  });
});
