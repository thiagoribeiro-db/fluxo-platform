import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import { findEntryNodeId, resetRun, startRun, step } from './flow-runner';

// ============================================================================
// Helpers
// ============================================================================

function frame(id: string, frameId: string, pos = { x: 0, y: 0 }): FluxoNode {
  return {
    id,
    type: 'frame',
    position: pos,
    data: { title: frameId, frameId, width: 656, height: 400 },
  };
}

function bot(id: string, text: string, pos = { x: 100, y: 50 }): FluxoNode {
  return { id, type: 'bubble-bot', position: pos, data: { text } };
}

function user(id: string, pos = { x: 100, y: 100 }): FluxoNode {
  return { id, type: 'bubble-user', position: pos, data: {} };
}

function menu(id: string, header: string, options: string[], pos = { x: 100, y: 100 }): FluxoNode {
  return { id, type: 'menu', position: pos, data: { header, options } };
}

function btn(id: string, label: string, pos = { x: 0, y: 0 }): FluxoNode {
  return { id, type: 'btn-short', position: pos, data: { label } };
}

function entryPoint(id: string, pos = { x: 50, y: 30 }): FluxoNode {
  return { id, type: 'entry-point', position: pos, data: { label: 'Início' } };
}

function direcionamento(id: string, targetFrameId: string, pos = { x: 100, y: 200 }): FluxoNode {
  return {
    id,
    type: 'direcionamento',
    position: pos,
    data: { targetFrameId, label: 'Ir' },
  };
}

function atendimentoHumano(id: string, pos = { x: 100, y: 200 }): FluxoNode {
  return { id, type: 'atendimento-humano', position: pos, data: {} };
}

function edge(id: string, source: string, target: string, sourceHandle?: string): Edge {
  return { id, source, target, ...(sourceHandle ? { sourceHandle } : {}) };
}

// ============================================================================
// findEntryNodeId
// ============================================================================

describe('findEntryNodeId', () => {
  it('prefere entry-point quando existe', () => {
    const nodes = [frame('f', 'saudacao'), entryPoint('e1'), bot('b1', 'Oi')];
    const edges = [edge('x', 'e1', 'b1')];
    expect(findEntryNodeId(nodes, edges)).toBe('e1');
  });

  it('cai pro primeiro main do primeiro frame quando não tem entry-point', () => {
    const nodes = [frame('f', 'saudacao'), bot('b1', 'Oi')];
    expect(findEntryNodeId(nodes, [])).toBe('b1');
  });

  it('retorna null em fluxo vazio', () => {
    expect(findEntryNodeId([], [])).toBeNull();
  });
});

// ============================================================================
// startRun — cenários básicos
// ============================================================================

describe('startRun', () => {
  it('emite uma bot-text e chega num bubble-user', () => {
    const nodes = [
      frame('f', 'saudacao'),
      entryPoint('e1'),
      bot('b1', 'Olá! Como posso ajudar?'),
      user('u1'),
    ];
    const edges = [edge('e-1', 'e1', 'b1'), edge('e-2', 'b1', 'u1')];
    const result = startRun(nodes, edges);

    const botMessages = result.events.filter((e) => e.kind === 'bot-text');
    expect(botMessages).toHaveLength(1);
    expect((botMessages[0] as { text: string }).text).toBe('Olá! Como posso ajudar?');
    expect(result.state.awaiting.kind).toBe('text');
    expect(result.state.finished).toBe(false);
  });

  it('emite um menu e fica esperando choice', () => {
    const nodes = [
      frame('f', 'saudacao'),
      menu('m1', 'Escolha', ['Sim', 'Não']),
    ];
    const result = startRun(nodes, []);

    const menus = result.events.filter((e) => e.kind === 'bot-menu');
    expect(menus).toHaveLength(1);
    expect(result.state.awaiting.kind).toBe('menu');
  });

  it('mensagem amigável em fluxo vazio', () => {
    const result = startRun([], []);
    expect(result.state.finished).toBe(true);
    expect(result.events.some((e) => e.kind === 'system')).toBe(true);
  });
});

// ============================================================================
// step — interação completa
// ============================================================================

describe('step — fluxo completo', () => {
  it('bot → user(input) → bot', () => {
    const nodes = [
      frame('f', 'saudacao'),
      bot('b1', 'Qual seu nome?'),
      user('u1'),
      bot('b2', 'Prazer!'),
    ];
    const edges = [
      edge('e-1', 'b1', 'u1'),
      edge('e-2', 'u1', 'b2'),
    ];
    const run1 = startRun(nodes, edges);
    expect(run1.state.awaiting.kind).toBe('text');

    const run2 = step(nodes, edges, run1.state, { userInput: 'Thiago' });
    const lastBot = run2.events.filter((e) => e.kind === 'bot-text').pop();
    expect(lastBot && (lastBot as { text: string }).text).toBe('Prazer!');
  });

  it('menu → escolhe opção → segue pro próximo', () => {
    const nodes = [
      frame('f', 'saudacao'),
      entryPoint('e1'),
      menu('m1', 'Como posso ajudar?', ['Comprar', 'Falar com atendente'], { x: 100, y: 50 }),
      btn('btn-c', 'Comprar', { x: 0, y: 200 }),
      btn('btn-a', 'Falar com atendente', { x: 200, y: 200 }),
      bot('b-c', 'Vamos comprar!', { x: 100, y: 250 }),
      bot('b-a', 'Conectando...', { x: 300, y: 250 }),
    ];
    const edges = [
      edge('e-0', 'e1', 'm1'),
      edge('e-1', 'm1', 'btn-c'),
      edge('e-2', 'm1', 'btn-a'),
      edge('e-3', 'btn-c', 'b-c'),
      edge('e-4', 'btn-a', 'b-a'),
    ];
    const run1 = startRun(nodes, edges);
    expect(run1.state.awaiting.kind).toBe('menu');

    const run2 = step(nodes, edges, run1.state, { userInput: 'Comprar' });
    const lastBot = run2.events.filter((e) => e.kind === 'bot-text').pop();
    expect(lastBot && (lastBot as { text: string }).text).toBe('Vamos comprar!');
  });

  it('atendimento-humano finaliza o fluxo', () => {
    const nodes = [
      frame('f', 'saudacao'),
      bot('b1', 'Oi'),
      atendimentoHumano('ah'),
    ];
    const edges = [edge('e-1', 'b1', 'ah')];
    const result = startRun(nodes, edges);
    expect(result.state.finished).toBe(true);
    const endEvt = result.events.find((e) => e.kind === 'end');
    expect(endEvt && (endEvt as { reason: string }).reason).toBe('handoff');
  });

  it('direcionamento pula pro welcome do frame alvo', () => {
    const nodes = [
      frame('f1', 'saudacao', { x: 0, y: 0 }),
      bot('b1', 'Olá', { x: 100, y: 50 }),
      direcionamento('d1', 'algo-mais', { x: 100, y: 150 }),
      // Outro frame
      frame('f2', 'algo-mais', { x: 1000, y: 0 }),
      bot('b2', 'Algo mais?', { x: 1100, y: 50 }),
    ];
    const edges = [edge('e-1', 'b1', 'd1')];
    const result = startRun(nodes, edges);
    const botTexts = result.events.filter((e) => e.kind === 'bot-text');
    // Deve ter Olá + Algo mais? (passou pelo direcionamento)
    expect(botTexts.length).toBe(2);
    expect((botTexts[1] as { text: string }).text).toBe('Algo mais?');
  });

  it('detecta loop e interrompe', () => {
    const nodes = [
      frame('f', 'saudacao'),
      bot('b1', 'A'),
      bot('b2', 'B'),
    ];
    // ciclo: b1 → b2 → b1
    const edges = [
      edge('e-1', 'b1', 'b2'),
      edge('e-2', 'b2', 'b1'),
    ];
    const result = startRun(nodes, edges);
    const sysMsg = result.events.find((e) => e.kind === 'system');
    expect(sysMsg && (sysMsg as { text: string }).text).toContain('Loop');
    expect(result.state.finished).toBe(true);
  });

  it('condicional bloqueia esperando TRUE/FALSE', () => {
    const nodes = [
      frame('f', 'saudacao'),
      {
        id: 'c1',
        type: 'condicional',
        position: { x: 100, y: 50 },
        data: {
          condition: 'É VIP?',
          trueLabel: 'Sim',
          falseLabel: 'Não',
        },
      } as FluxoNode,
      bot('b-true', 'Bem-vindo VIP!'),
      bot('b-false', 'Olá'),
    ];
    const edges = [
      // Padrão real do projeto: sourceHandle "true"/"false" lowercase.
      // O runner faz match case-insensitive, então "TRUE"/"FALSE" também valeria.
      edge('e-1', 'c1', 'b-true', 'true'),
      edge('e-2', 'c1', 'b-false', 'false'),
    ];
    const run1 = startRun(nodes, edges);
    expect(run1.state.awaiting.kind).toBe('conditional');

    const run2 = step(nodes, edges, run1.state, { conditionalChoice: true });
    const lastBot = run2.events.filter((e) => e.kind === 'bot-text').pop();
    expect(lastBot && (lastBot as { text: string }).text).toBe('Bem-vindo VIP!');
  });
});

// ============================================================================
// resetRun
// ============================================================================

describe('resetRun', () => {
  it('inicia novamente do começo', () => {
    const nodes = [frame('f', 'saudacao'), bot('b1', 'Reset')];
    const result = resetRun(nodes, []);
    expect(result.events.some((e) => e.kind === 'bot-text')).toBe(true);
  });
});
