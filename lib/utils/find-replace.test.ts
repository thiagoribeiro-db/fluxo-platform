import { describe, expect, it } from 'vitest';
import type { FluxoNode } from '@/lib/types';
import { findInNodes, replaceInNodes } from './find-replace';

function bot(id: string, text: string): FluxoNode {
  return { id, type: 'bubble-bot', position: { x: 0, y: 0 }, data: { text, code: id } };
}

function menu(id: string, header: string, options: string[]): FluxoNode {
  return {
    id,
    type: 'menu',
    position: { x: 0, y: 0 },
    data: { header, options, code: id },
  };
}

describe('findInNodes', () => {
  it('encontra texto em bubble-bot', () => {
    const nodes = [bot('b1', 'Olá! Tudo bem?'), bot('b2', 'Adeus')];
    const matches = findInNodes(nodes, 'olá');
    expect(matches).toHaveLength(1);
    expect(matches[0].nodeId).toBe('b1');
    expect(matches[0].count).toBe(1);
  });

  it('case-insensitive por default', () => {
    const nodes = [bot('b1', 'OLÁ')];
    expect(findInNodes(nodes, 'olá')).toHaveLength(1);
    expect(findInNodes(nodes, 'olá', { matchCase: true })).toHaveLength(0);
  });

  it('conta ocorrências múltiplas no mesmo campo', () => {
    const nodes = [bot('b1', 'oi oi oi')];
    const matches = findInNodes(nodes, 'oi');
    expect(matches[0].count).toBe(3);
  });

  it('encontra em menu header e options', () => {
    const nodes = [menu('m1', 'Escolha', ['Comprar oferta', 'Falar com bot'])];
    const matches = findInNodes(nodes, 'oferta');
    expect(matches).toHaveLength(1);
    expect(matches[0].field).toBe('options[0]');
  });
});

describe('replaceInNodes', () => {
  it('substitui em bubble-bot', () => {
    const nodes = [bot('b1', 'Olá mundo')];
    const result = replaceInNodes(nodes, 'mundo', 'galera');
    expect(result.totalReplacements).toBe(1);
    expect(result.affectedNodeIds).toEqual(['b1']);
    const newBot = result.nodes[0];
    expect((newBot.data as { text: string }).text).toBe('Olá galera');
  });

  it('preserva nodes não-afetados (mesma ref)', () => {
    const nodes = [bot('b1', 'Olá'), bot('b2', 'Adeus')];
    const result = replaceInNodes(nodes, 'Olá', 'Oi');
    expect(result.nodes[1]).toBe(nodes[1]); // mesma referência
    expect(result.nodes[0]).not.toBe(nodes[0]); // mudou
  });

  it('substitui em menu options', () => {
    const nodes = [menu('m1', 'Escolha', ['Sim', 'Não'])];
    const result = replaceInNodes(nodes, 'Sim', 'Confirmar');
    const updated = result.nodes[0];
    expect((updated.data as { options: string[] }).options).toEqual(['Confirmar', 'Não']);
  });

  it('case-insensitive replace preserva caso original (substitui pela versão nova)', () => {
    const nodes = [bot('b1', 'OLÁ olá')];
    const result = replaceInNodes(nodes, 'olá', 'oi');
    expect((result.nodes[0].data as { text: string }).text).toBe('oi oi');
    expect(result.totalReplacements).toBe(2);
  });
});
