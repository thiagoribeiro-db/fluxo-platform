import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import { organizeLayoutByFrame, reflowFrameGrid } from './helpers';

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

describe('organizeLayoutByFrame — bubble-user com exceção (dupla horizontal vs empilhada)', () => {
  function user(id: string, code: string, x = 0, y = 0): FluxoNode {
    return {
      id,
      type: 'bubble-user',
      position: { x, y },
      data: { code, text: `u-${code}` },
    };
  }
  function exc(id: string, parentId: string): FluxoNode {
    return {
      id,
      type: 'excecao',
      position: { x: 0, y: 0 },
      parentId,
      data: { text: 'Não entendi…' },
    };
  }

  it('frame folgado: dupla horizontal — exceção fica à DIREITA do user (mesma linha)', () => {
    // Frame com largura confortável (900px) — cabe bubble (380) + GAP + excecao (240) sem stress
    const f = frame('f1', 'S', { x: 0, y: 0 }, 900, 400);
    const u = user('u1', 'S001', 0, 100);
    const e = exc('e1', 'u1');
    const result = organizeLayoutByFrame([f, u, e], []);
    const newU = result.find((n) => n.id === 'u1')!;
    const newE = result.find((n) => n.id === 'e1')!;
    // Exceção é filha (parentId) → position relativa ao user
    // Horizontal = x > 0 (à direita) e y ≈ 0 (mesma linha)
    expect(newE.position.x).toBeGreaterThan(0);
    expect(newE.position.y).toBe(0);
    // A "dupla" deve estar dentro do frame: borda direita não passa do frame.
    // Exceção tem position relativa ao user (parentId), então absoluta =
    // user.x + e.x + e.w.
    const newFrame = result.find((n) => n.id === 'f1')!;
    const frameRight = newFrame.position.x + (newFrame.data!.width as number);
    const excAbsRight = newU.position.x + newE.position.x + 240;
    expect(excAbsRight).toBeLessThanOrEqual(frameRight + 1);
  });

  it('frame truncado por vizinho: fallback EMPILHADO — exceção fica ABAIXO do user', () => {
    // Frame f1 começa em x=0, vizinho f2 em x=420 → cap por vizinho força f1 estreito.
    // Sem cap, f1 cresceria pra ~660+ pra caber dupla horizontal. Com cap, fica ~400.
    const f1 = frame('f1', 'S', { x: 0, y: 0 }, 400, 400);
    const f2 = frame('f2', 'T', { x: 420, y: 0 }, 400, 400);
    const u = user('u1', 'S001', 0, 100);
    const e = exc('e1', 'u1');
    const result = organizeLayoutByFrame([f1, f2, u, e], []);
    const newU = result.find((n) => n.id === 'u1')!;
    const newE = result.find((n) => n.id === 'e1')!;
    // Fallback: exceção tem y > 0 (abaixo) — NÃO mais y=0 (lado a lado)
    expect(newE.position.y).toBeGreaterThan(0);
    // User não vaza pra esquerda do frame (x relativo >= 0)
    expect(newU.position.x).toBeGreaterThanOrEqual(0);
    // E continua dentro do frame f1 (não invade f2 em x=420)
    expect(newU.position.x + 380).toBeLessThanOrEqual(420);
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

// =============================================================================
// reflowFrameGrid
// =============================================================================
describe('reflowFrameGrid — elimina sobreposições verticais entre frames', () => {
  it('não muda nada se só há 1 frame', () => {
    const f = frame('f1', 'S', { x: 0, y: 0 }, 656, 800);
    const b = bot('b1', 'S001', 200, 100);
    const nodes = [f, b];
    const result = reflowFrameGrid(nodes);
    expect(result).toBe(nodes); // mesma referência (sem mudanças)
  });

  it('não muda nada se frames não se sobrepõem', () => {
    const f1 = frame('f1', 'S', { x: 0, y: 0 }, 656, 500);
    const f2 = frame('f2', 'O', { x: 0, y: 800 }, 656, 500); // y=800 > 500+200=700 (folga ok)
    const nodes = [f1, f2];
    const result = reflowFrameGrid(nodes);
    const newF2 = result.find((n) => n.id === 'f2')!;
    expect(newF2.position.y).toBe(800); // sem mudança
  });

  it('empurra frame que está sobreposto pro baixo', () => {
    // f1: y=0, h=2000 — cresce além do reservado
    // f2: y=1700 — posição original (colisão: f1 termina em y=2000)
    const f1 = frame('f1', 'S', { x: 0, y: 0 }, 656, 2000);
    const f2 = frame('f2', 'O', { x: 0, y: 1700 }, 656, 500);
    const b1 = bot('b1', 'S001', 200, 100);
    const b2 = bot('b2', 'O001', 200, 1800);
    const nodes = [f1, f2, b1, b2];
    const result = reflowFrameGrid(nodes);

    const newF1 = result.find((n) => n.id === 'f1')!;
    const newF2 = result.find((n) => n.id === 'f2')!;
    const newB2 = result.find((n) => n.id === 'b2')!;

    // f1 não se move (é o primeiro)
    expect(newF1.position.y).toBe(0);
    // f2 é empurrado pra baixo de f1 + PUSH_GAP(200)
    expect(newF2.position.y).toBe(2200); // 2000 + 200
    // b2 (conteúdo de f2) também se move
    expect(newB2.position.y).toBe(1800 + 500); // 1800 + (2200 - 1700)
  });

  it('frames em colunas diferentes (sem X overlap) não se empurram', () => {
    // col 0: x=0, col 1: x=900 — sem overlap horizontal
    const f1 = frame('f1', 'S', { x: 0, y: 0 }, 656, 2000);   // col 0, alta
    const f2 = frame('f2', 'O', { x: 900, y: 1700 }, 656, 500); // col 1 — não deve mover
    const nodes = [f1, f2];
    const result = reflowFrameGrid(nodes);
    const newF2 = result.find((n) => n.id === 'f2')!;
    expect(newF2.position.y).toBe(1700); // col diferente → sem mudança
  });

  it('empurra em cascata: 3 frames sobrepostos na mesma coluna', () => {
    const f1 = frame('f1', 'S', { x: 0, y: 0 }, 656, 2000);    // termina em 2000
    const f2 = frame('f2', 'O', { x: 0, y: 1700 }, 656, 2000); // colisão → vai pra 2200, termina em 4200
    const f3 = frame('f3', 'T', { x: 0, y: 3400 }, 656, 500);  // colisão com f2 ajustado → vai pra 4400
    const nodes = [f1, f2, f3];
    const result = reflowFrameGrid(nodes);

    const newF2 = result.find((n) => n.id === 'f2')!;
    const newF3 = result.find((n) => n.id === 'f3')!;

    expect(newF2.position.y).toBe(2200); // 2000 + 200
    expect(newF3.position.y).toBe(4400); // 2200 + 2000 + 200
  });

  it('nodes com parentId não se movem (são relativos ao parent)', () => {
    const f1 = frame('f1', 'S', { x: 0, y: 0 }, 656, 2000);
    const f2 = frame('f2', 'O', { x: 0, y: 1700 }, 656, 500);
    const b2 = bot('b2', 'O001', 200, 1800);
    const tracking: FluxoNode = {
      id: 'trk1',
      type: 'tracking',
      parentId: 'b2',
      position: { x: -256, y: 0 }, // relativo ao b2
      data: { label: 'tracking_exibicao' },
    };
    const nodes = [f1, f2, b2, tracking];
    const result = reflowFrameGrid(nodes);

    const newTrk = result.find((n) => n.id === 'trk1')!;
    // Tracking tem parentId → posição NÃO deve mudar
    expect(newTrk.position.x).toBe(-256);
    expect(newTrk.position.y).toBe(0);
  });
});
