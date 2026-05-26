// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getLastSeen, markSeen, hasUnseenUpdate } from './seen-tracker';

describe('seen-tracker', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('getLastSeen retorna undefined quando nunca foi marcado', () => {
    expect(getLastSeen('flow', 'abc')).toBeUndefined();
  });

  it('markSeen + getLastSeen round-trip', () => {
    markSeen('flow', 'abc', '2026-05-25T12:00:00Z');
    expect(getLastSeen('flow', 'abc')).toBe('2026-05-25T12:00:00Z');
  });

  it('markSeen sem when usa Date.now()', () => {
    markSeen('flow', 'abc');
    const stored = getLastSeen('flow', 'abc');
    expect(stored).toBeDefined();
    expect(Date.parse(stored!)).toBeCloseTo(Date.now(), -3); // dentro de 1s
  });

  it('hasUnseenUpdate: true quando updatedAt > lastSeen', () => {
    markSeen('flow', 'abc', '2026-05-25T10:00:00Z');
    expect(hasUnseenUpdate('flow', 'abc', '2026-05-25T11:00:00Z')).toBe(true);
  });

  it('hasUnseenUpdate: false quando updatedAt <= lastSeen', () => {
    markSeen('flow', 'abc', '2026-05-25T11:00:00Z');
    expect(hasUnseenUpdate('flow', 'abc', '2026-05-25T10:00:00Z')).toBe(false);
    expect(hasUnseenUpdate('flow', 'abc', '2026-05-25T11:00:00Z')).toBe(false);
  });

  it('hasUnseenUpdate: true quando nunca foi visto E updatedAt existe', () => {
    expect(hasUnseenUpdate('flow', 'abc', '2026-05-25T11:00:00Z')).toBe(true);
  });

  it('hasUnseenUpdate: false quando updatedAt vazio/inválido', () => {
    expect(hasUnseenUpdate('flow', 'abc', undefined)).toBe(false);
    expect(hasUnseenUpdate('flow', 'abc', null)).toBe(false);
    expect(hasUnseenUpdate('flow', 'abc', 'lixo')).toBe(false);
  });

  it('scopes diferentes não interferem', () => {
    markSeen('flow', 'abc', '2026-05-25T10:00:00Z');
    markSeen('spec', 'abc', '2026-05-25T11:00:00Z');
    expect(getLastSeen('flow', 'abc')).toBe('2026-05-25T10:00:00Z');
    expect(getLastSeen('spec', 'abc')).toBe('2026-05-25T11:00:00Z');
  });
});
