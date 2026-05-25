import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  checkIaRateLimit,
  resetAllBuckets,
  IA_RATE_LIMITS,
} from './rate-limit';

beforeEach(() => {
  resetAllBuckets();
});

describe('checkRateLimit', () => {
  it('permite até `max` chamadas seguidas', () => {
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit('key-a', { max: 3, windowMs: 1000 });
      expect(r.allowed).toBe(true);
      expect(r.current).toBe(i + 1);
    }
  });

  it('bloqueia a (max+1)ª chamada e retorna retryAfterMs', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit('key-b', { max: 3, windowMs: 1000 });
    }
    const r = checkRateLimit('key-b', { max: 3, windowMs: 1000 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
    expect(r.retryAfterMs).toBeLessThanOrEqual(1000);
    expect(r.message).toMatch(/Limite atingido/i);
  });

  it('libera após a janela passar', async () => {
    for (let i = 0; i < 2; i++) {
      checkRateLimit('key-c', { max: 2, windowMs: 50 });
    }
    expect(checkRateLimit('key-c', { max: 2, windowMs: 50 }).allowed).toBe(false);
    // espera a janela passar
    await new Promise((r) => setTimeout(r, 60));
    expect(checkRateLimit('key-c', { max: 2, windowMs: 50 }).allowed).toBe(true);
  });

  it('chaves diferentes têm buckets independentes', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('user-a', { max: 5, windowMs: 1000 });
    }
    expect(checkRateLimit('user-a', { max: 5, windowMs: 1000 }).allowed).toBe(false);
    expect(checkRateLimit('user-b', { max: 5, windowMs: 1000 }).allowed).toBe(true);
  });
});

describe('checkIaRateLimit', () => {
  it('respeita o limite da feature configurada', () => {
    const max = IA_RATE_LIMITS.PARSE_FLOW.max;
    for (let i = 0; i < max; i++) {
      expect(checkIaRateLimit('u1', 'PARSE_FLOW').allowed).toBe(true);
    }
    expect(checkIaRateLimit('u1', 'PARSE_FLOW').allowed).toBe(false);
  });

  it('user anônimo (null) ainda é limitado por bucket "anon"', () => {
    const max = IA_RATE_LIMITS.PARSE_FLOW.max;
    for (let i = 0; i < max; i++) {
      expect(checkIaRateLimit(null, 'PARSE_FLOW').allowed).toBe(true);
    }
    expect(checkIaRateLimit(null, 'PARSE_FLOW').allowed).toBe(false);
  });

  it('users diferentes não compartilham bucket', () => {
    const max = IA_RATE_LIMITS.PARSE_FLOW.max;
    for (let i = 0; i < max; i++) {
      checkIaRateLimit('u1', 'PARSE_FLOW');
    }
    expect(checkIaRateLimit('u1', 'PARSE_FLOW').allowed).toBe(false);
    expect(checkIaRateLimit('u2', 'PARSE_FLOW').allowed).toBe(true);
  });
});
