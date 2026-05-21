import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import { organizeLayoutByFrame } from './helpers';

// Helpers
function frame(
  id: string,
  prefix: string,
  position = { x: 0, y: 0 },
  width = 656,
  height = 400
): FluxoNode {
  return {
    id,
    type: 'frame',
    position,
    data: { prefix, title: prefix, width, height },
  };
}

function bot(id: string, code: string, x = 0, y = 0): FluxoNode {
  return {
    id,
    type: 'bubble-bot',
    position: { x, y },
    data: { code, text: `t-${code}` },
  };
}

describe('organizeLayoutByFrame — modo vertical (sem branches)', () => {
  it('empilha bots verticalmente alinhados pela direita do frame', () => {
    const f = frame('f1', 'S');
    const b1 = bot('b1', 'S001', 100, 200);
    const b2 = bot('b2', 'S002', 100, 300);
    const result = organizeLayoutByFrame([f, b1, b2], []);

    // Bots reposicionados dentro do frame
    const newB1 = result.find((n) => n.id === 'b1')!;
    const newB2 = result.find((n) => n.id === 'b2')!;
    expect(newB1.position.y).toBeLessThan(newB2.position.y);
    // Estão DENTRO do frame (X positivo + < frame.x + width)
    expect(newB1.position.x).toBeGreaterThan(0);
    expect(newB1.position.x + 380).toBeLessThanOrEqual(656 + 100); // tolera margem
  });

  it('preserva ordem por Y original (mais cedo = mais cima)', () => {
    const f = frame('f1', 'X');
    // Y original B antes de A
    const a = bot('a', 'X002', 0, 500);
    const b = bot('b', 'X001', 0, 300);
    const result = organizeLayoutByFrame([f, a, b], []);
    const newA = result.find((n) => n.id === 'a')!;
    const newB = result.find((n) => n.id === 'b')!;
    // B (Y original menor) fica acima de A após organize
    expect(newB.position.y).toBeLessThan(newA.position.y);
  });

  it('frame cresce verticalmente pra caber os mains', () => {
    const f = frame('f1', 'S', { x: 0, y: 0 }, 656, 100); // height insuficiente
    // 5 bots: precisam de mais que 100px
    const bots = Array.from({ length: 5 }, (_, i) =>
      bot(`b${i}`, `S00${i + 1}`, 0, i * 50)
    );
    const result = organizeLayoutByFrame([f, ...bots], []);
    const newFrame = result.find((n) => n.id === 'f1')!;
    expect(newFrame.data?.height).toBeGreaterThan(100);
  });
});

describe('organizeLayoutByFrame — agrupamento por code prefix', () => {
  it('mains com code prefix vão pro frame com mesmo prefix mesmo se posição é outro', () => {
    const fS = frame('fS', 'S', { x: 0, y: 0 });
    const fOF = frame('fOF', 'OF', { x: 1000, y: 0 });
    // S001 posicionado MUITO LONGE, dentro da área do OF
    const node = bot('s1', 'S001', 1100, 100);
    const result = organizeLayoutByFrame([fS, fOF, node], []);
    const newS1 = result.find((n) => n.id === 's1')!;
    // Foi reposicionado pra dentro do frame S (x perto de 0)
    expect(newS1.position.x).toBeLessThan(700);
  });
});

describe('organizeLayoutByFrame — modo diamante (branches)', () => {
  it('ativa diamond quando há branch real (>1 sucessor main via btn)', () => {
    const f = frame('f', 'X', { x: 0, y: 0 }, 1500, 1000);
    const root = bot('root', 'X001', 0, 0);
    const childA = bot('a', 'X002', 0, 0);
    const childB = bot('b', 'X003', 0, 0);
    const btnA: FluxoNode = {
      id: 'btnA',
      type: 'btn-short',
      position: { x: 0, y: 0 },
      data: { buttonText: 'A' },
    };
    const btnB: FluxoNode = {
      id: 'btnB',
      type: 'btn-short',
      position: { x: 0, y: 0 },
      data: { buttonText: 'B' },
    };
    const edges: Edge[] = [
      { id: 'e1', source: 'root', target: 'btnA' },
      { id: 'e2', source: 'root', target: 'btnB' },
      { id: 'e3', source: 'btnA', target: 'a' },
      { id: 'e4', source: 'btnB', target: 'b' },
    ];
    const result = organizeLayoutByFrame(
      [f, root, childA, childB, btnA, btnB],
      edges
    );
    const newA = result.find((n) => n.id === 'a')!;
    const newB = result.find((n) => n.id === 'b')!;
    // Em diamond: childA e childB ficam em colunas DIFERENTES (X distintos)
    expect(newA.position.x).not.toBe(newB.position.x);
    // E mesma depth (Y igual ou próximo)
    expect(Math.abs(newA.position.y - newB.position.y)).toBeLessThan(20);
  });
});
