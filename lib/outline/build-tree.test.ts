import { describe, expect, it } from 'vitest';
import type { FluxoNode } from '@/lib/types';
import { buildOutlineTree } from './build-tree';

// Helper pra criar node mínimo
function node(partial: Partial<FluxoNode> & { id: string; type: string }): FluxoNode {
  const { id, type, position, data, ...rest } = partial;
  return {
    id,
    type: type as FluxoNode['type'],
    position: position ?? { x: 0, y: 0 },
    data: data ?? {},
    ...rest,
  } as FluxoNode;
}

describe('buildOutlineTree', () => {
  it('retorna lista vazia quando não há nodes', () => {
    expect(buildOutlineTree([])).toEqual([]);
  });

  it('agrupa blocos dentro do frame que os contém', () => {
    const nodes: FluxoNode[] = [
      node({
        id: 'frame-1',
        type: 'frame',
        position: { x: 0, y: 0 },
        data: { title: 'Saudação', frameId: 'saudacao', prefix: 'S', width: 500, height: 500 },
      }),
      node({
        id: 'bot-1',
        type: 'bubble-bot',
        position: { x: 100, y: 100 },
        data: { code: 'S001', text: 'Olá!' },
      }),
      node({
        id: 'menu-1',
        type: 'menu',
        position: { x: 100, y: 200 },
        data: { code: 'S002', header: 'Como posso ajudar?' },
      }),
    ];

    const tree = buildOutlineTree(nodes);
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('frame');
    expect(tree[0].label).toBe('Saudação');
    expect(tree[0].prefix).toBe('S');
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children?.[0].code).toBe('S001');
    expect(tree[0].children?.[1].code).toBe('S002');
  });

  it('coloca blocos fora de qualquer frame no grupo "Sem frame"', () => {
    const nodes: FluxoNode[] = [
      node({
        id: 'frame-1',
        type: 'frame',
        position: { x: 0, y: 0 },
        data: { title: 'F1', frameId: 'f1', width: 100, height: 100 },
      }),
      node({
        id: 'bot-orphan',
        type: 'bubble-bot',
        position: { x: 500, y: 500 }, // fora do frame
        data: { text: 'Sou órfão' },
      }),
    ];

    const tree = buildOutlineTree(nodes);
    expect(tree).toHaveLength(2);
    expect(tree[1].kind).toBe('orphan-group');
    expect(tree[1].children).toHaveLength(1);
  });

  it('esconde trackings, exceções e botões da lista', () => {
    const nodes: FluxoNode[] = [
      node({
        id: 'frame-1',
        type: 'frame',
        position: { x: 0, y: 0 },
        data: { title: 'F', frameId: 'f', width: 500, height: 500 },
      }),
      node({
        id: 'bot-1',
        type: 'bubble-bot',
        position: { x: 100, y: 100 },
        data: { code: 'S001', text: 'Oi' },
      }),
      node({
        id: 'trk-1',
        type: 'tracking',
        position: { x: 100, y: 150 },
        data: { label: 'oi exibicao' },
        // parentId define que é child visual — não deveria aparecer
        parentId: 'bot-1',
      } as FluxoNode),
      node({
        id: 'btn-1',
        type: 'btn-short',
        position: { x: 100, y: 200 },
        data: { label: 'Sim' },
      }),
    ];

    const tree = buildOutlineTree(nodes);
    // Apenas o bubble-bot aparece como child do frame
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children?.[0].code).toBe('S001');
  });

  it('filtra por query (busca em label e code)', () => {
    const nodes: FluxoNode[] = [
      node({
        id: 'frame-saudacao',
        type: 'frame',
        position: { x: 0, y: 0 },
        data: { title: 'Saudação', frameId: 'saudacao', prefix: 'S', width: 500, height: 500 },
      }),
      node({
        id: 'frame-ofertas',
        type: 'frame',
        position: { x: 1000, y: 0 },
        data: { title: 'Ofertas', frameId: 'ofertas', prefix: 'O', width: 500, height: 500 },
      }),
      node({
        id: 'bot-1',
        type: 'bubble-bot',
        position: { x: 100, y: 100 },
        data: { code: 'S001', text: 'Olá mundo' },
      }),
    ];

    // Busca pelo título do frame
    const r1 = buildOutlineTree(nodes, { query: 'ofertas' });
    expect(r1).toHaveLength(1);
    expect(r1[0].label).toBe('Ofertas');

    // Busca pelo code do bloco
    const r2 = buildOutlineTree(nodes, { query: 'S001' });
    expect(r2).toHaveLength(1);
    expect(r2[0].children).toHaveLength(1);
    expect(r2[0].children?.[0].code).toBe('S001');

    // Busca por texto do bloco
    const r3 = buildOutlineTree(nodes, { query: 'mundo' });
    expect(r3).toHaveLength(1);
    expect(r3[0].children?.[0].label).toContain('mundo');
  });

  it('ordena frames e blocos por posição (Y, depois X)', () => {
    const nodes: FluxoNode[] = [
      node({
        id: 'f-b',
        type: 'frame',
        position: { x: 0, y: 1000 },
        data: { title: 'Segundo', frameId: 'b', width: 500, height: 500 },
      }),
      node({
        id: 'f-a',
        type: 'frame',
        position: { x: 0, y: 0 },
        data: { title: 'Primeiro', frameId: 'a', width: 500, height: 500 },
      }),
    ];
    const tree = buildOutlineTree(nodes);
    expect(tree[0].label).toBe('Primeiro');
    expect(tree[1].label).toBe('Segundo');
  });
});
