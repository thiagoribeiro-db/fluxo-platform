import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadVersioned, saveVersioned, clearVersioned } from './storage';

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
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
};
vi.stubGlobal('localStorage', ls);
vi.stubGlobal('window', { localStorage: ls });

beforeEach(() => {
  localStorage.clear();
});

describe('loadVersioned + saveVersioned', () => {
  it('lê dado já salvo na versão target', () => {
    saveVersioned('snippets', 1, [{ id: 'a', name: 'x' }]);
    const data = loadVersioned<Array<{ id: string }>>('snippets', 1, {
      defaultValue: [],
    });
    expect(data).toEqual([{ id: 'a', name: 'x' }]);
  });

  it('retorna defaultValue se não há nada salvo', () => {
    expect(loadVersioned('empty', 1, { defaultValue: [42] })).toEqual([42]);
  });

  it('retorna defaultValue se JSON corrompido', () => {
    localStorage.setItem('fluxo:bad:v1', '{not valid json');
    expect(loadVersioned('bad', 1, { defaultValue: [] })).toEqual([]);
  });

  it('migra de v1 pra v2 quando target=v2 e só tem v1', () => {
    saveVersioned('mig', 1, [{ id: 'a', oldName: 'antigo' }]);
    const data = loadVersioned<Array<{ id: string; newName: string }>>(
      'mig',
      2,
      {
        defaultValue: [],
        migrations: [
          (v1) =>
            (v1 as Array<{ id: string; oldName: string }>).map((x) => ({
              id: x.id,
              newName: x.oldName, // rename
            })),
        ],
      }
    );
    expect(data).toEqual([{ id: 'a', newName: 'antigo' }]);
    // E persiste na v2 + limpa v1
    expect(localStorage.getItem('fluxo:mig:v2')).toContain('newName');
    expect(localStorage.getItem('fluxo:mig:v1')).toBeNull();
  });

  it('retorna defaultValue se migration falta entre versões', () => {
    saveVersioned('jump', 1, ['old']);
    const data = loadVersioned('jump', 3, {
      defaultValue: ['default'],
      migrations: [], // sem migrations
    });
    expect(data).toEqual(['default']);
  });

  it('validate=false descarta dado e usa default', () => {
    saveVersioned('val', 1, { corrupted: true });
    const data = loadVersioned('val', 1, {
      defaultValue: { corrupted: false },
      validate: (d) => (d as { corrupted: boolean }).corrupted === false,
    });
    expect(data).toEqual({ corrupted: false });
  });
});

describe('clearVersioned', () => {
  it('remove todas as versões de uma feature', () => {
    saveVersioned('multi', 1, 'old');
    saveVersioned('multi', 2, 'new');
    saveVersioned('other', 1, 'keep');
    clearVersioned('multi');
    expect(localStorage.getItem('fluxo:multi:v1')).toBeNull();
    expect(localStorage.getItem('fluxo:multi:v2')).toBeNull();
    expect(localStorage.getItem('fluxo:other:v1')).toBe('"keep"');
  });
});
