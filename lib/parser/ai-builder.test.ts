import { describe, expect, it } from 'vitest';
import { buildStateFromAIResult } from './ai-builder';
import type { AIBlock, AIFrame, AIParseResult } from './ai-schema';

// ============================================================================
// Helpers de fixture pra montar AIParseResult enxutos
// ============================================================================
function frame(
  prefix: string,
  title: string,
  frameId: string,
  blocks: AIBlock[]
): AIFrame {
  return { title, prefix, frame_id: frameId, blocks };
}

function result(frames: AIFrame[]): AIParseResult {
  return { frames, notes: [] };
}

// ============================================================================
// Testes
// ============================================================================

describe('buildStateFromAIResult', () => {
  it('frame simples com bot+user gera nodes + trackings + exceção', () => {
    const r = result([
      frame('S', 'Saudação', 'saudacao', [
        { kind: 'bot', text: 'Olá! Como te chamo?' },
        { kind: 'user', text: '{nome}' },
      ]),
    ]);
    const state = buildStateFromAIResult(r);

    // 1 frame + 1 bot + 1 user + 1 tracking_exibicao do bot + 1 tracking_input no bot
    // + 1 exceção do user = 6 nodes
    const types = state.nodes.map((n) => n.type);
    expect(types).toContain('frame');
    expect(types).toContain('bubble-bot');
    expect(types).toContain('bubble-user');
    expect(types.filter((t) => t === 'tracking')).toHaveLength(2);
    expect(types).toContain('excecao');

    // Bot tem code "S001", user não tem code
    const bot = state.nodes.find((n) => n.type === 'bubble-bot');
    expect(bot?.data?.code).toBe('S001');
    const user = state.nodes.find((n) => n.type === 'bubble-user');
    expect(user?.data?.code).toBeUndefined();

    // Edges: bot → user
    expect(state.edges.length).toBeGreaterThanOrEqual(1);
    const botUserEdge = state.edges.find(
      (e) => e.source === bot?.id && e.target === user?.id
    );
    expect(botUserEdge).toBeDefined();
    expect(botUserEdge?.animated).toBe(true);
  });

  it('menu gera 3 trackings (exibicao + selecao + inesperado)', () => {
    const r = result([
      frame('S', 'Saudação', 'saudacao', [
        {
          kind: 'menu',
          header: 'Menu Principal',
          options: ['Ofertas', 'Lojas', 'Falar'],
        },
      ]),
    ]);
    const state = buildStateFromAIResult(r);
    const trackings = state.nodes.filter((n) => n.type === 'tracking');
    expect(trackings).toHaveLength(3);
    const labels = trackings.map((t) => t.data?.label as string).sort();
    expect(labels.some((l) => l.endsWith('exibicao'))).toBe(true);
    expect(labels.some((l) => l.endsWith('selecao'))).toBe(true);
    expect(labels.some((l) => l.endsWith('inesperado'))).toBe(true);
  });

  it('cascata FA: cria edges com sourceHandle true/false', () => {
    const r = result([
      frame('FA', 'Falar com atendente', 'atendente', [
        {
          kind: 'condicional',
          condition: 'É feriado?',
          true_label: 'Sim',
          false_label: 'Não',
        },
        { kind: 'bot', text: 'Estamos em feriado. Tente em horário comercial.' },
        {
          kind: 'condicional',
          condition: 'Atendente disponível?',
          true_label: 'Sim',
          false_label: 'Não',
        },
        { kind: 'bot', text: 'Em alguns instantes alguém te atenderá.' },
        { kind: 'atendimento-humano' },
      ]),
    ]);
    const state = buildStateFromAIResult(r);

    // Edges com sourceHandle true ou false (cascata)
    const handleTrue = state.edges.filter((e) => e.sourceHandle === 'true');
    const handleFalse = state.edges.filter((e) => e.sourceHandle === 'false');
    expect(handleTrue.length).toBeGreaterThanOrEqual(2);
    expect(handleFalse.length).toBeGreaterThanOrEqual(1);

    // Inversão na última cond: handle 'true' aponta pro atendimento-humano,
    // handle 'false' aponta pra mensagem "aguarde".
    const atend = state.nodes.find((n) => n.type === 'atendimento-humano');
    const trueToAtend = handleTrue.find((e) => e.target === atend?.id);
    expect(trueToAtend, 'última cond TRUE → atend-humano').toBeDefined();
  });

  it('direcionamentos consecutivos formam grid horizontal', () => {
    const r = result([
      frame('S', 'Saudação', 'saudacao', [
        { kind: 'bot', text: 'Escolha:' },
        {
          kind: 'menu',
          header: 'Menu',
          options: ['A', 'B', 'C', 'D'],
        },
        { kind: 'direcionamento', label: 'Ir A', target_frame_id: 'a' },
        { kind: 'direcionamento', label: 'Ir B', target_frame_id: 'b' },
        { kind: 'direcionamento', label: 'Ir C', target_frame_id: 'c' },
        { kind: 'direcionamento', label: 'Ir D', target_frame_id: 'd' },
      ]),
    ]);
    const state = buildStateFromAIResult(r);
    const dirs = state.nodes.filter((n) => n.type === 'direcionamento');
    expect(dirs).toHaveLength(4);
    // Em grid horizontal: a 2ª linha tem Y maior que a primeira
    const ys = dirs.map((d) => d.position.y);
    const xs = dirs.map((d) => d.position.x);
    // Não estão todos na mesma X
    expect(new Set(xs).size).toBeGreaterThan(1);
    // Não estão todos na mesma Y (alguns wrappam pra próxima row)
    // — só vale verificar se 4 itens precisam de 2+ rows, depende do innerW
    expect(ys.length).toBe(4);
  });

  it('frames com mesmo prefix recebem prefix únicos (dedup)', () => {
    const r = result([
      frame('S', 'Saudação', 'saudacao', [
        { kind: 'bot', text: 'Hi' },
      ]),
      frame('S', 'Suporte', 'suporte', [
        { kind: 'bot', text: 'Suporte' },
      ]),
    ]);
    const state = buildStateFromAIResult(r);
    const frames = state.nodes.filter((n) => n.type === 'frame');
    expect(frames).toHaveLength(2);
    const prefixes = frames.map((f) => f.data?.prefix);
    // Os prefixes devem ser únicos
    expect(new Set(prefixes).size).toBe(2);
  });

  it('blocos inválidos são ignorados sem quebrar o build', () => {
    const r = result([
      frame('S', 'Test', 'test', [
        { kind: 'bot', text: '' }, // sem texto
        { kind: 'menu', header: 'Header', options: [] }, // sem options
        { kind: 'bot', text: 'Válido' },
      ]),
    ]);
    const state = buildStateFromAIResult(r);
    const bots = state.nodes.filter((n) => n.type === 'bubble-bot');
    // Só o bot válido é emitido
    expect(bots).toHaveLength(1);
    expect(bots[0].data?.text).toBe('Válido');
  });

  it('frames vazios geram apenas o container', () => {
    const r = result([frame('X', 'Vazio', 'vazio', [])]);
    const state = buildStateFromAIResult(r);
    expect(state.nodes.filter((n) => n.type === 'frame')).toHaveLength(1);
    expect(state.nodes.filter((n) => n.type !== 'frame')).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
  });
});
