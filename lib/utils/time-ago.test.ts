import { describe, it, expect } from 'vitest';
import { formatTimeAgo, isRecent } from './time-ago';

const REF = Date.parse('2026-05-25T12:00:00Z');

describe('formatTimeAgo', () => {
  it('retorna string vazia pra undefined/null/inválido', () => {
    expect(formatTimeAgo(undefined)).toBe('');
    expect(formatTimeAgo(null)).toBe('');
    expect(formatTimeAgo('lixo')).toBe('');
  });

  it('"agora mesmo" pra delta < 30s', () => {
    const iso = new Date(REF - 10_000).toISOString();
    expect(formatTimeAgo(iso, { now: REF })).toBe('agora mesmo');
  });

  it('"há poucos segundos" pra delta entre 30s e 1min', () => {
    const iso = new Date(REF - 40_000).toISOString();
    expect(formatTimeAgo(iso, { now: REF })).toBe('há poucos segundos');
  });

  it('"há N min" pra delta entre 1min e 1h', () => {
    const iso = new Date(REF - 5 * 60_000).toISOString();
    expect(formatTimeAgo(iso, { now: REF })).toBe('há 5 min');
  });

  it('"há N h" pra delta entre 1h e 24h', () => {
    const iso = new Date(REF - 3 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(iso, { now: REF })).toBe('há 3 h');
  });

  it('"ontem" pra delta exato de 1 dia', () => {
    const iso = new Date(REF - 24 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(iso, { now: REF })).toBe('ontem');
  });

  it('"há N dias" pra delta entre 2 e 6 dias', () => {
    const iso = new Date(REF - 4 * 24 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(iso, { now: REF })).toBe('há 4 dias');
  });

  it('"há 1 semana" pra delta de 7 dias', () => {
    const iso = new Date(REF - 7 * 24 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(iso, { now: REF })).toBe('há 1 semana');
  });

  it('"há N meses" pra delta > 30 dias', () => {
    const iso = new Date(REF - 90 * 24 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(iso, { now: REF })).toBe('há 3 meses');
  });

  it('fallback ISO se opt setado e delta > 30 dias', () => {
    const iso = new Date(REF - 60 * 24 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(iso, { now: REF, fallbackToIso: true })).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });

  it('lida com timestamp no futuro (clock skew)', () => {
    const iso = new Date(REF + 60_000).toISOString();
    expect(formatTimeAgo(iso, { now: REF })).toBe('no futuro');
  });
});

describe('isRecent', () => {
  it('true pra timestamp dentro da janela default (5 min)', () => {
    const iso = new Date(REF - 2 * 60_000).toISOString();
    expect(isRecent(iso, { now: REF })).toBe(true);
  });

  it('false pra timestamp fora da janela default', () => {
    const iso = new Date(REF - 10 * 60_000).toISOString();
    expect(isRecent(iso, { now: REF })).toBe(false);
  });

  it('aceita janela custom', () => {
    const iso = new Date(REF - 30 * 60_000).toISOString();
    expect(isRecent(iso, { now: REF, withinMs: 60 * 60_000 })).toBe(true);
    expect(isRecent(iso, { now: REF, withinMs: 10 * 60_000 })).toBe(false);
  });

  it('false pra undefined/null/inválido', () => {
    expect(isRecent(undefined)).toBe(false);
    expect(isRecent(null)).toBe(false);
    expect(isRecent('lixo')).toBe(false);
  });
});
