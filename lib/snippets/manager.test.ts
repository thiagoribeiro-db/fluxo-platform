import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSnippet,
  deleteSnippet,
  listSnippets,
  searchSnippets,
  updateSnippet,
} from './manager';

// vitest roda em node por padrão (sem localStorage). Mockamos um shim em
// memória pra que `listSnippets` & cia. funcionem nos testes. Também
// definimos `window` pq o manager checa `typeof window === 'undefined'`.
const store: Record<string, string> = {};
const ls = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
};
vi.stubGlobal('localStorage', ls);
vi.stubGlobal('window', { localStorage: ls });

beforeEach(() => {
  localStorage.clear();
});

describe('snippets manager', () => {
  it('listSnippets retorna [] quando vazio', () => {
    expect(listSnippets()).toEqual([]);
  });

  it('createSnippet adiciona no topo e persiste', () => {
    const a = createSnippet('Hello', 'Bom dia!');
    expect(a.id).toBeTruthy();
    expect(a.name).toBe('Hello');
    expect(a.body).toBe('Bom dia!');
    const list = listSnippets();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(a.id);
  });

  it('updateSnippet altera nome e body', () => {
    const a = createSnippet('X', 'old');
    const updated = updateSnippet(a.id, { name: 'X2', body: 'new' });
    expect(updated?.name).toBe('X2');
    expect(updated?.body).toBe('new');
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(a.updatedAt);
  });

  it('updateSnippet retorna null em id inexistente', () => {
    expect(updateSnippet('nope', { name: 'x' })).toBeNull();
  });

  it('deleteSnippet remove e retorna true', () => {
    const a = createSnippet('X', 'val');
    expect(deleteSnippet(a.id)).toBe(true);
    expect(listSnippets()).toHaveLength(0);
  });

  it('deleteSnippet retorna false em id inexistente', () => {
    expect(deleteSnippet('nope')).toBe(false);
  });

  it('searchSnippets filtra case-insensitive em name e body', () => {
    createSnippet('Saudação', 'Olá tudo bem?');
    createSnippet('Despedida', 'Até logo!');
    createSnippet('Erro', 'Algo deu errado, tente de novo.');

    expect(searchSnippets('saudacao')).toHaveLength(0); // não acha sem acento
    expect(searchSnippets('SAUDA')).toHaveLength(1);
    expect(searchSnippets('OLÁ')).toHaveLength(1);
    expect(searchSnippets('errado')).toHaveLength(1);
    expect(searchSnippets('')).toHaveLength(3);
  });

  it('createSnippet trim nome e fallback "Sem nome"', () => {
    const a = createSnippet('   ', 'x');
    expect(a.name).toBe('Sem nome');
  });

  it('listSnippets ordena por updatedAt DESC (mais recente primeiro)', async () => {
    const a = createSnippet('A', '1');
    // Garante delta de timestamp
    await new Promise((r) => setTimeout(r, 5));
    const b = createSnippet('B', '2');
    const list = listSnippets();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });
});
