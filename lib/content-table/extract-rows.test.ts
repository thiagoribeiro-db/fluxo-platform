import { describe, expect, it } from 'vitest';
import type { FluxoNode } from '@/lib/types';
import { applyFieldPatch, extractContentRows } from './extract-rows';

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

describe('extractContentRows', () => {
  it('retorna [] quando não há nodes', () => {
    expect(extractContentRows([])).toEqual([]);
  });

  it('extrai mensagem do bubble-bot', () => {
    const nodes: FluxoNode[] = [
      node({
        id: 'bot-1',
        type: 'bubble-bot',
        position: { x: 100, y: 100 },
        data: { code: 'S001', text: 'Olá!' },
      }),
    ];
    const rows = extractContentRows(nodes);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      nodeId: 'bot-1',
      code: 'S001',
      fieldLabel: 'Mensagem',
      fieldPath: 'text',
      value: 'Olá!',
    });
  });

  it('extrai header + footer + opções do menu (1 linha por opção)', () => {
    const nodes: FluxoNode[] = [
      node({
        id: 'menu-1',
        type: 'menu',
        position: { x: 100, y: 100 },
        data: {
          code: 'M001',
          header: 'Como posso ajudar?',
          footer: 'Enviar',
          options: ['Opção A', 'Opção B', 'Opção C'],
        },
      }),
    ];
    const rows = extractContentRows(nodes);
    // 1 header + 1 footer + 3 opções = 5
    expect(rows).toHaveLength(5);
    expect(rows[0].fieldLabel).toBe('Header');
    expect(rows[1].fieldLabel).toBe('Footer (botão)');
    expect(rows[2].fieldLabel).toBe('Opção 1');
    expect(rows[2].fieldPath).toBe('options[0]');
    expect(rows[3].fieldPath).toBe('options[1]');
    expect(rows[4].fieldPath).toBe('options[2]');
  });

  it('extrai todos os campos do condicional', () => {
    const nodes: FluxoNode[] = [
      node({
        id: 'cond-1',
        type: 'condicional',
        position: { x: 100, y: 100 },
        data: {
          code: 'C001',
          condition: 'É feriado?',
          trueLabel: 'Sim',
          falseLabel: 'Não',
        },
      }),
    ];
    const rows = extractContentRows(nodes);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.fieldLabel)).toEqual([
      'Condição',
      'Label TRUE',
      'Label FALSE',
    ]);
  });

  it('resolve frame container pelo bbox', () => {
    const nodes: FluxoNode[] = [
      node({
        id: 'frame-S',
        type: 'frame',
        position: { x: 0, y: 0 },
        data: { title: 'Saudação', frameId: 'saudacao', prefix: 'S', width: 500, height: 500 },
      }),
      node({
        id: 'bot-inside',
        type: 'bubble-bot',
        position: { x: 100, y: 100 }, // dentro
        data: { code: 'S001', text: 'Oi' },
      }),
      node({
        id: 'bot-outside',
        type: 'bubble-bot',
        position: { x: 1000, y: 1000 }, // fora
        data: { text: 'Sou órfão' },
      }),
    ];
    const rows = extractContentRows(nodes);
    expect(rows).toHaveLength(2);
    const inside = rows.find((r) => r.nodeId === 'bot-inside')!;
    const outside = rows.find((r) => r.nodeId === 'bot-outside')!;
    expect(inside.frameLabel).toBe('Saudação');
    expect(inside.framePrefix).toBe('S');
    expect(outside.frameLabel).toBe('Sem frame');
    expect(outside.frameId).toBeNull();
  });

  it('exclui trackings e exceções por padrão', () => {
    const nodes: FluxoNode[] = [
      node({ id: 'bot-1', type: 'bubble-bot', data: { text: 'Oi' } }),
      node({
        id: 'trk-1',
        type: 'tracking',
        parentId: 'bot-1',
        data: { label: 'oi exibicao' },
      } as FluxoNode),
      node({
        id: 'exc-1',
        type: 'excecao',
        parentId: 'bot-1',
        data: { label: 'Exceção' },
      } as FluxoNode),
    ];
    const rows = extractContentRows(nodes);
    expect(rows).toHaveLength(1);
    expect(rows[0].nodeId).toBe('bot-1');
  });

  it('inclui trackings/exceções quando includeChildren=true', () => {
    const nodes: FluxoNode[] = [
      node({ id: 'bot-1', type: 'bubble-bot', data: { text: 'Oi' } }),
      node({
        id: 'trk-1',
        type: 'tracking',
        parentId: 'bot-1',
        data: { label: 'oi exibicao' },
      } as FluxoNode),
    ];
    const rows = extractContentRows(nodes, { includeChildren: true });
    expect(rows).toHaveLength(2);
  });

  it('filtra por query (busca em value/code/frame/fieldLabel)', () => {
    const nodes: FluxoNode[] = [
      node({ id: 'b1', type: 'bubble-bot', data: { code: 'S001', text: 'Olá mundo' } }),
      node({ id: 'b2', type: 'bubble-bot', data: { code: 'S002', text: 'Tchau' } }),
    ];
    expect(extractContentRows(nodes, { query: 'mundo' })).toHaveLength(1);
    expect(extractContentRows(nodes, { query: 'S002' })).toHaveLength(1);
    expect(extractContentRows(nodes, { query: 'nada' })).toHaveLength(0);
  });

  it('filtra por tipos', () => {
    const nodes: FluxoNode[] = [
      node({ id: 'b1', type: 'bubble-bot', data: { text: 'A' } }),
      node({ id: 'b2', type: 'bubble-user', data: { text: 'B' } }),
      node({ id: 'm1', type: 'menu', data: { header: 'H', options: [] } }),
    ];
    const rows = extractContentRows(nodes, { types: ['bubble-bot', 'menu'] });
    // bubble-bot (1 linha: text) + menu (2 linhas: header + footer, options vazio) = 3
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.nodeType !== 'bubble-user')).toBe(true);
  });
});

describe('applyFieldPatch', () => {
  it('atualiza campo simples', () => {
    const patched = applyFieldPatch({ text: 'old' }, 'text', 'new');
    expect(patched.text).toBe('new');
  });

  it('atualiza item de array (options[N])', () => {
    const patched = applyFieldPatch(
      { options: ['A', 'B', 'C'] },
      'options[1]',
      'B-NEW'
    );
    expect((patched.options as string[])[1]).toBe('B-NEW');
    expect((patched.options as string[])[0]).toBe('A');
    expect((patched.options as string[])[2]).toBe('C');
  });

  it('preserva outras keys do data', () => {
    const patched = applyFieldPatch(
      { text: 'old', code: 'S001', extra: 42 },
      'text',
      'new'
    );
    expect(patched.code).toBe('S001');
    expect(patched.extra).toBe(42);
  });
});
