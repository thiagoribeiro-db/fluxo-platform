import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import {
  countBySeverity,
  groupByNode,
  lintFlow,
  worstSeverity,
} from './flow-linter';

// ============================================================================
// Helpers
// ============================================================================

function frame(
  id: string,
  title: string,
  pos = { x: 0, y: 0 },
  size = { w: 656, h: 400 }
): FluxoNode {
  return {
    id,
    type: 'frame',
    position: pos,
    data: { title, frameId: title.toLowerCase(), width: size.w, height: size.h },
  };
}

function bot(id: string, text: string, pos = { x: 100, y: 100 }, code?: string): FluxoNode {
  return {
    id,
    type: 'bubble-bot',
    position: pos,
    data: { text, code },
  };
}

function menu(
  id: string,
  header: string,
  options: string[],
  pos = { x: 100, y: 200 },
  code?: string
): FluxoNode {
  return {
    id,
    type: 'menu',
    position: pos,
    data: { header, options, code },
  };
}

function btn(id: string, label: string, pos = { x: 0, y: 0 }): FluxoNode {
  return {
    id,
    type: 'btn-short',
    position: pos,
    data: { label, buttonText: label },
  };
}

function dir(
  id: string,
  opts: { targetNodeId?: string; targetFrameId?: string },
  code?: string
): FluxoNode {
  return {
    id,
    type: 'direcionamento',
    position: { x: 100, y: 300 },
    data: { ...opts, code },
  };
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target };
}

// ============================================================================
// Bubble vazio
// ============================================================================

describe('lintFlow — empty-text', () => {
  it('reporta bubble-bot sem texto', () => {
    const nodes = [frame('f', 'saudacao'), bot('b1', '', { x: 100, y: 50 })];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'empty-text', severity: 'warning', nodeId: 'b1' })
    );
  });

  it('NÃO reporta bubble com texto', () => {
    const nodes = [frame('f', 'saudacao'), bot('b1', 'Olá!', { x: 100, y: 50 })];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems.filter((p) => p.code === 'empty-text')).toHaveLength(0);
  });
});

// ============================================================================
// Menu
// ============================================================================

describe('lintFlow — menu', () => {
  it('reporta menu sem opções como error', () => {
    const nodes = [frame('f', 'saudacao'), menu('m1', 'Escolha', [], { x: 100, y: 100 })];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'menu-no-options', severity: 'error', nodeId: 'm1' })
    );
  });

  it('reporta menu sem header como warning', () => {
    const nodes = [frame('f', 'saudacao'), menu('m1', '', ['A', 'B'], { x: 100, y: 100 })];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'empty-menu-header', severity: 'warning', nodeId: 'm1' })
    );
  });

  it('reporta info quando menu tem > 10 opções', () => {
    const opts = Array.from({ length: 12 }, (_, i) => `Opção ${i + 1}`);
    const nodes = [frame('f', 'saudacao'), menu('m1', 'Escolha', opts, { x: 100, y: 100 })];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'menu-too-many-options', severity: 'info' })
    );
  });

  it('opções com strings vazias não contam', () => {
    const nodes = [
      frame('f', 'saudacao'),
      menu('m1', 'X', ['  ', '', 'Real'], { x: 100, y: 100 }),
    ];
    const problems = lintFlow({ nodes, edges: [] });
    // Tem 1 opção real → não é menu-no-options
    expect(problems.filter((p) => p.code === 'menu-no-options')).toHaveLength(0);
  });
});

// ============================================================================
// Direcionamento
// ============================================================================

describe('lintFlow — direcionamento', () => {
  it('reporta direcionamento sem target', () => {
    const nodes = [frame('f', 'saudacao'), dir('d1', {})];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'direcionamento-no-target', severity: 'warning' })
    );
  });

  it('reporta direcionamento que aponta pra frame inexistente', () => {
    const nodes = [
      frame('f', 'saudacao'),
      dir('d1', { targetFrameId: 'frame-fantasma' }),
    ];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'dangling-direcionamento', severity: 'error' })
    );
  });

  it('NÃO reporta quando aponta pra frame existente', () => {
    const nodes = [
      frame('f1', 'saudacao'),
      frame('f2', 'algo-mais', { x: 1000, y: 0 }),
      dir('d1', { targetFrameId: 'algo-mais' }),
    ];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems.filter((p) => p.code === 'dangling-direcionamento')).toHaveLength(0);
  });
});

// ============================================================================
// Botão sem target
// ============================================================================

describe('lintFlow — btn-no-target', () => {
  it('reporta btn-short sem outgoing edge', () => {
    const nodes = [frame('f', 'x'), btn('b1', 'Confirmar')];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'btn-no-target', nodeId: 'b1' })
    );
  });

  it('NÃO reporta btn com outgoing edge', () => {
    const nodes = [frame('f', 'x'), btn('b1', 'Sim'), bot('next', 'OK')];
    const edges = [edge('e1', 'b1', 'next')];
    const problems = lintFlow({ nodes, edges });
    expect(problems.filter((p) => p.code === 'btn-no-target')).toHaveLength(0);
  });
});

// ============================================================================
// Code collision
// ============================================================================

describe('lintFlow — code-collision', () => {
  it('reporta dois nodes com o mesmo code', () => {
    const nodes = [
      frame('f', 'x'),
      bot('b1', 'A', { x: 100, y: 50 }, 'S001'),
      bot('b2', 'B', { x: 100, y: 100 }, 'S001'),
    ];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems.filter((p) => p.code === 'code-collision').length).toBeGreaterThan(0);
  });

  it('NÃO reporta quando codes são únicos', () => {
    const nodes = [
      frame('f', 'x'),
      bot('b1', 'A', { x: 100, y: 50 }, 'S001'),
      bot('b2', 'B', { x: 100, y: 100 }, 'S002'),
    ];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems.filter((p) => p.code === 'code-collision')).toHaveLength(0);
  });
});

// ============================================================================
// Frame vazio
// ============================================================================

describe('lintFlow — frame-empty', () => {
  it('reporta frame sem nenhum main dentro do bbox', () => {
    const nodes = [frame('f', 'saudacao', { x: 0, y: 0 }, { w: 656, h: 400 })];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'frame-empty', nodeId: 'f' })
    );
  });

  it('NÃO reporta quando frame tem main dentro', () => {
    const nodes = [
      frame('f', 'saudacao', { x: 0, y: 0 }, { w: 656, h: 400 }),
      bot('b1', 'oi', { x: 100, y: 100 }),
    ];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems.filter((p) => p.code === 'frame-empty')).toHaveLength(0);
  });
});

// ============================================================================
// Helpers
// ============================================================================

describe('countBySeverity / groupByNode / worstSeverity', () => {
  it('conta por severity corretamente', () => {
    const nodes = [
      frame('f', 'x'),
      menu('m1', '', [], { x: 100, y: 100 }), // error + warning
    ];
    const problems = lintFlow({ nodes, edges: [] });
    const counts = countBySeverity(problems);
    expect(counts.error).toBeGreaterThanOrEqual(1);
    expect(counts.warning).toBeGreaterThanOrEqual(1);
  });

  it('groupByNode agrupa múltiplos problems no mesmo nó', () => {
    const nodes = [
      frame('f', 'x'),
      menu('m1', '', [], { x: 100, y: 100 }), // 2 problems no m1
    ];
    const problems = lintFlow({ nodes, edges: [] });
    const grouped = groupByNode(problems);
    expect(grouped.get('m1')?.length).toBeGreaterThanOrEqual(2);
  });

  it('worstSeverity retorna error > warning > info', () => {
    expect(
      worstSeverity([
        { code: 'empty-text', severity: 'warning', message: 'a' },
        { code: 'menu-no-options', severity: 'error', message: 'b' },
      ])
    ).toBe('error');
    expect(
      worstSeverity([
        { code: 'empty-text', severity: 'warning', message: 'a' },
        { code: 'unreachable-node', severity: 'info', message: 'b' },
      ])
    ).toBe('warning');
    expect(worstSeverity([])).toBeNull();
  });
});

// ============================================================================
// Variáveis quebradas
// ============================================================================

describe('lintFlow — broken-variable', () => {
  function tracking(id: string, label: string): FluxoNode {
    return {
      id,
      type: 'tracking',
      position: { x: 0, y: 0 },
      data: { label },
    } as FluxoNode;
  }

  it('reporta {{x}} quando x não está declarado', () => {
    const nodes = [
      frame('f', 'saudacao'),
      bot('b1', 'Olá {{nome_inexistente}}!', { x: 100, y: 50 }),
    ];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({
        code: 'broken-variable',
        severity: 'warning',
        nodeId: 'b1',
      })
    );
  });

  it('NÃO reporta {{x}} quando x foi declarado em tracking', () => {
    const nodes = [
      frame('f', 'saudacao'),
      tracking('t1', 'Nome input'), // declara `nome`
      bot('b1', 'Olá {{nome}}!', { x: 100, y: 50 }),
    ];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems.filter((p) => p.code === 'broken-variable')).toHaveLength(0);
  });

  it('detecta múltiplas variáveis quebradas no mesmo node mas dedupe por slug', () => {
    const nodes = [
      frame('f', 'saudacao'),
      bot('b1', '{{a}} {{a}} {{b}}', { x: 100, y: 50 }),
    ];
    const problems = lintFlow({ nodes, edges: [] });
    const broken = problems.filter((p) => p.code === 'broken-variable');
    expect(broken).toHaveLength(2); // a e b — uma única ocorrência cada
  });

  it('varre opções de menu também', () => {
    const nodes = [
      frame('f', 'x'),
      menu('m1', 'Header', ['Opção {{nada}}'], { x: 100, y: 100 }),
    ];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'broken-variable', nodeId: 'm1' })
    );
  });
});

// ============================================================================
// Pré-validação Blip (limites de chars)
// ============================================================================

describe('lintFlow — limites Blip', () => {
  it('reporta btn-short com mais de 20 chars', () => {
    const longLabel = 'Esse texto é muito longo pra um botão curto, vai estourar';
    const nodes = [frame('f', 'x'), btn('b1', longLabel)];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({
        code: 'btn-short-too-long',
        severity: 'warning',
      })
    );
  });

  it('NÃO reporta btn-short curto', () => {
    const nodes = [frame('f', 'x'), btn('b1', 'Sim')];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems.filter((p) => p.code === 'btn-short-too-long')).toHaveLength(0);
  });

  it('reporta header de menu com mais de 60 chars', () => {
    const longHeader = 'A'.repeat(70);
    const nodes = [frame('f', 'x'), menu('m1', longHeader, ['Sim'])];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'menu-header-too-long', nodeId: 'm1' })
    );
  });

  it('reporta opção de menu com mais de 24 chars', () => {
    const longOpt = 'Essa opção é muito grande pro WhatsApp lista';
    const nodes = [frame('f', 'x'), menu('m1', 'Header', [longOpt])];
    const problems = lintFlow({ nodes, edges: [] });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'menu-option-too-long', nodeId: 'm1' })
    );
  });
});

// ============================================================================
// Loops infinitos
// ============================================================================

describe('lintFlow — infinite-loop', () => {
  it('reporta ciclo entre bots sem bubble-user', () => {
    // bot A → bot B → bot A (loop sem pausa)
    const nodes = [
      frame('f', 'x'),
      bot('a', 'A', { x: 100, y: 50 }, 'B001'),
      bot('b', 'B', { x: 100, y: 150 }, 'B002'),
    ];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')];
    const problems = lintFlow({ nodes, edges });
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'infinite-loop', severity: 'warning' })
    );
  });

  it('NÃO reporta ciclo que passa por bubble-user (pausa pro usuário)', () => {
    const userNode: FluxoNode = {
      id: 'u',
      type: 'bubble-user',
      position: { x: 100, y: 150 },
      data: { text: 'resposta' },
    } as FluxoNode;
    const nodes = [
      frame('f', 'x'),
      bot('a', 'A', { x: 100, y: 50 }),
      userNode,
    ];
    const edges = [edge('e1', 'a', 'u'), edge('e2', 'u', 'a')];
    const problems = lintFlow({ nodes, edges });
    expect(problems.filter((p) => p.code === 'infinite-loop')).toHaveLength(0);
  });

  it('NÃO reporta fluxo linear sem ciclos', () => {
    const nodes = [
      frame('f', 'x'),
      bot('a', 'A'),
      bot('b', 'B'),
      bot('c', 'C'),
    ];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];
    const problems = lintFlow({ nodes, edges });
    expect(problems.filter((p) => p.code === 'infinite-loop')).toHaveLength(0);
  });
});
