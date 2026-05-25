import { describe, it, expect } from 'vitest';
import { extractVariables, filterVariables } from './extract-variables';
import type { FluxoNode } from '@/lib/types';

function mkNode(
  id: string,
  type: FluxoNode['type'],
  data: Record<string, unknown> = {}
): FluxoNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data,
  } as FluxoNode;
}

describe('extractVariables', () => {
  it('extrai trackings (input + output) com sufixo na label', () => {
    const nodes = [
      mkNode('t1', 'tracking', { label: 'Nome input', code: 'B001' }),
      mkNode('t2', 'tracking', { label: 'Cidade output', code: 'B002' }),
    ];
    const vars = extractVariables(nodes);
    expect(vars).toHaveLength(2);
    expect(vars[0]).toMatchObject({
      name: 'nome',
      source: 'tracking-input',
      code: 'B001',
    });
    expect(vars[1]).toMatchObject({
      name: 'cidade',
      source: 'tracking-output',
      code: 'B002',
    });
  });

  it('extrai iag-saida pelo title', () => {
    const nodes = [
      mkNode('ia1', 'iag-saida', { title: 'Resposta IA', code: 'IA001' }),
    ];
    const vars = extractVariables(nodes);
    expect(vars).toHaveLength(1);
    expect(vars[0]).toMatchObject({ name: 'resposta_ia', source: 'iag-saida' });
  });

  it('extrai bubble-user pelo code', () => {
    const nodes = [mkNode('u1', 'bubble-user', { code: 'U001' })];
    const vars = extractVariables(nodes);
    expect(vars).toHaveLength(1);
    expect(vars[0]).toMatchObject({ name: 'u001', source: 'bubble-user' });
  });

  it('dedupe por name — primeiro ganha', () => {
    const nodes = [
      mkNode('t1', 'tracking', { label: 'Nome input' }),
      mkNode('t2', 'tracking', { label: 'Nome output' }), // mesmo slug "nome"
    ];
    const vars = extractVariables(nodes);
    expect(vars).toHaveLength(1);
    expect(vars[0].source).toBe('tracking-input');
  });

  it('ignora acentos e espaços (slug normaliza)', () => {
    const nodes = [
      mkNode('t1', 'tracking', { label: 'Endereço de Entrega input' }),
    ];
    const vars = extractVariables(nodes);
    expect(vars[0].name).toBe('endereco_de_entrega');
    expect(vars[0].displayLabel).toBe('Endereço de Entrega');
  });

  it('ignora nodes sem data ou sem label/code', () => {
    const nodes = [
      mkNode('a', 'bubble-bot', { text: 'Olá' }),
      mkNode('b', 'tracking', {}),
    ];
    const vars = extractVariables(nodes);
    expect(vars).toHaveLength(0);
  });
});

describe('filterVariables', () => {
  const vars = [
    {
      name: 'nome',
      displayLabel: 'Nome',
      source: 'tracking-input' as const,
      nodeId: 't1',
    },
    {
      name: 'cidade',
      displayLabel: 'Cidade',
      source: 'tracking-input' as const,
      nodeId: 't2',
    },
    {
      name: 'endereco',
      displayLabel: 'Endereço',
      source: 'tracking-input' as const,
      nodeId: 't3',
    },
  ];

  it('retorna tudo se query vazia', () => {
    expect(filterVariables(vars, '')).toHaveLength(3);
  });

  it('filtra por name', () => {
    const out = filterVariables(vars, 'nom');
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('nome');
  });

  it('filtra por displayLabel case-insensitive', () => {
    const out = filterVariables(vars, 'CIDADE');
    expect(out).toHaveLength(1);
    expect(out[0].displayLabel).toBe('Cidade');
  });
});
