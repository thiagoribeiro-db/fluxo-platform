import { describe, it, expect } from 'vitest';
import { alignNodes, countEligible } from './align';
import type { FluxoNode } from '@/lib/types';

function mkNode(
  id: string,
  type: FluxoNode['type'],
  x: number,
  y: number,
  w = 100,
  h = 50,
  parentId?: string
): FluxoNode {
  return {
    id,
    type,
    position: { x, y },
    parentId,
    data: { width: w, height: h },
  } as FluxoNode;
}

describe('alignNodes', () => {
  describe('countEligible', () => {
    it('ignora frames e children', () => {
      const nodes = [
        mkNode('a', 'bubble-bot', 0, 0),
        mkNode('b', 'bubble-user', 100, 100),
        mkNode('c', 'frame', 0, 0, 500, 500),
        mkNode('d', 'tracking', 0, 0, 80, 30, 'a'),
      ];
      expect(countEligible(nodes, ['a', 'b', 'c', 'd'])).toBe(2);
    });
  });

  describe('align-left', () => {
    it('alinha tudo ao menor x', () => {
      const nodes = [
        mkNode('a', 'bubble-bot', 10, 0),
        mkNode('b', 'bubble-bot', 50, 100),
        mkNode('c', 'bubble-bot', 100, 200),
      ];
      const out = alignNodes(nodes, ['a', 'b', 'c'], 'align-left');
      expect(out.find((n) => n.id === 'a')!.position.x).toBe(10);
      expect(out.find((n) => n.id === 'b')!.position.x).toBe(10);
      expect(out.find((n) => n.id === 'c')!.position.x).toBe(10);
      // Y intacto
      expect(out.find((n) => n.id === 'b')!.position.y).toBe(100);
    });
  });

  describe('align-right', () => {
    it('alinha o right edge', () => {
      const nodes = [
        mkNode('a', 'bubble-bot', 0, 0, 100),
        mkNode('b', 'bubble-bot', 50, 100, 200), // right = 250
      ];
      const out = alignNodes(nodes, ['a', 'b'], 'align-right');
      // a deve ir pra x = 250 - 100 = 150; b fica em 50
      expect(out.find((n) => n.id === 'a')!.position.x).toBe(150);
      expect(out.find((n) => n.id === 'b')!.position.x).toBe(50);
    });
  });

  describe('align-top', () => {
    it('alinha ao menor y', () => {
      const nodes = [
        mkNode('a', 'bubble-bot', 0, 10),
        mkNode('b', 'bubble-bot', 100, 50),
      ];
      const out = alignNodes(nodes, ['a', 'b'], 'align-top');
      expect(out.find((n) => n.id === 'a')!.position.y).toBe(10);
      expect(out.find((n) => n.id === 'b')!.position.y).toBe(10);
    });
  });

  describe('distribute-h', () => {
    it('mantém extremos e espaça o meio uniformemente', () => {
      // 3 nodes de width 100 entre x=0 e x=400 (right do último).
      // span = 400, totalW = 300, gap = (400-300)/(3-1) = 50.
      const nodes = [
        mkNode('a', 'bubble-bot', 0, 0, 100),
        mkNode('b', 'bubble-bot', 80, 0, 100), // meio, deve ir pra 150
        mkNode('c', 'bubble-bot', 300, 0, 100),
      ];
      const out = alignNodes(nodes, ['a', 'b', 'c'], 'distribute-h');
      expect(out.find((n) => n.id === 'a')!.position.x).toBe(0);
      expect(out.find((n) => n.id === 'c')!.position.x).toBe(300);
      // a.right = 100, gap = 50, b.x = 150
      expect(out.find((n) => n.id === 'b')!.position.x).toBe(150);
    });
  });

  describe('minimum violation', () => {
    it('retorna nodes sem mudança se < 2 elegíveis em align', () => {
      const nodes = [mkNode('a', 'bubble-bot', 10, 0)];
      const out = alignNodes(nodes, ['a'], 'align-left');
      expect(out).toBe(nodes);
    });

    it('retorna nodes sem mudança se < 3 elegíveis em distribute', () => {
      const nodes = [
        mkNode('a', 'bubble-bot', 0, 0),
        mkNode('b', 'bubble-bot', 100, 0),
      ];
      const out = alignNodes(nodes, ['a', 'b'], 'distribute-h');
      expect(out).toBe(nodes);
    });
  });

  describe('ignora children e frames', () => {
    it('children (parentId) não são alinhados', () => {
      const nodes = [
        mkNode('a', 'bubble-bot', 0, 0),
        mkNode('b', 'bubble-bot', 100, 0),
        mkNode('c', 'tracking', -50, 0, 80, 30, 'a'),
      ];
      const out = alignNodes(nodes, ['a', 'b', 'c'], 'align-left');
      expect(out.find((n) => n.id === 'c')!.position.x).toBe(-50); // intacto
      // a e b alinhados em x=0
      expect(out.find((n) => n.id === 'a')!.position.x).toBe(0);
      expect(out.find((n) => n.id === 'b')!.position.x).toBe(0);
    });
  });
});
