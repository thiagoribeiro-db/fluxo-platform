/**
 * Linter do fluxo — detecta problemas estruturais no canvas em tempo real.
 *
 * Função PURA: recebe `{nodes, edges}` e retorna lista de `Problem`.
 * Sem efeitos colaterais, sem DOM, sem React — facilita testar e cachear.
 *
 * Tipos de problema:
 *   - error    impede o export funcionar corretamente (ex: menu sem opções)
 *   - warning  exporta mas pode gerar comportamento ruim (ex: bubble vazio)
 *   - info     nice-to-fix (ex: node inalcançável)
 *
 * USO no UI:
 *   const problems = lintFlow({ nodes, edges });
 *   const errorsCount = problems.filter(p => p.severity === 'error').length;
 *
 * Pra adicionar uma nova check:
 *   1. Adicione o `code` em `ProblemCode`
 *   2. Implemente uma função `check<Nome>` que recebe (state, push) e popula
 *   3. Registre em `ALL_CHECKS`
 */
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import { extractVariables } from '@/lib/variables/extract-variables';

export type ProblemSeverity = 'error' | 'warning' | 'info';

export type ProblemCode =
  | 'empty-text'
  | 'menu-no-options'
  | 'empty-menu-header'
  | 'menu-too-many-options'
  | 'dangling-direcionamento'
  | 'direcionamento-no-target'
  | 'btn-no-target'
  | 'code-collision'
  | 'frame-empty'
  | 'frame-no-entry-point'
  | 'entry-point-no-target'
  | 'condicional-empty'
  | 'link-no-url'
  | 'unreachable-node'
  | 'broken-variable'
  | 'btn-short-too-long'
  | 'btn-long-too-long'
  | 'menu-header-too-long'
  | 'menu-option-too-long'
  | 'infinite-loop';

export interface Problem {
  /** Identificador estável do tipo de problema (pra filtros/agrupamento). */
  code: ProblemCode;
  severity: ProblemSeverity;
  /** Node afetado — pra navegação e badge visual. */
  nodeId?: string;
  /** Edge afetada (raro). */
  edgeId?: string;
  /** Mensagem curta em PT-BR, exibida no painel. */
  message: string;
  /** Dica opcional de como resolver (1 linha). */
  hint?: string;
}

interface LintState {
  nodes: FluxoNode[];
  edges: Edge[];
  /** Map id → node pra lookups O(1). */
  nodeById: Map<string, FluxoNode>;
  /** Map frameId/title → frame node, pra resolver direcionamentos. */
  frameByFrameId: Map<string, FluxoNode>;
  /** Set de node ids alcançáveis do welcome (computado lazy). */
  reachable?: Set<string>;
}

type Pusher = (p: Problem) => void;

// =============================================================================
// Public entry
// =============================================================================

export interface LintInput {
  nodes: FluxoNode[];
  edges: Edge[];
}

export function lintFlow(input: LintInput): Problem[] {
  const problems: Problem[] = [];
  const push: Pusher = (p) => problems.push(p);

  const nodeById = new Map<string, FluxoNode>();
  const frameByFrameId = new Map<string, FluxoNode>();
  for (const n of input.nodes) {
    nodeById.set(n.id, n);
    if (n.type === 'frame') {
      const fid =
        (n.data?.frameId as string | undefined) ??
        (n.data?.title as string | undefined);
      if (fid) frameByFrameId.set(fid, n);
    }
  }

  const state: LintState = {
    nodes: input.nodes,
    edges: input.edges,
    nodeById,
    frameByFrameId,
  };

  for (const check of ALL_CHECKS) {
    check(state, push);
  }

  return problems;
}

// =============================================================================
// Checks individuais
// =============================================================================

function checkEmptyText(state: LintState, push: Pusher): void {
  for (const n of state.nodes) {
    if (n.type !== 'bubble-bot' && n.type !== 'bubble-user') continue;
    const text = (n.data?.text as string | undefined)?.trim() ?? '';
    if (!text) {
      push({
        code: 'empty-text',
        severity: 'warning',
        nodeId: n.id,
        message: `${n.type === 'bubble-bot' ? 'Bubble bot' : 'Bubble user'}${n.data?.code ? ' ' + n.data.code : ''} sem texto`,
        hint: 'Adicione o conteúdo da mensagem nas propriedades.',
      });
    }
  }
}

function checkMenu(state: LintState, push: Pusher): void {
  for (const n of state.nodes) {
    if (n.type !== 'menu') continue;
    const header = (n.data?.header as string | undefined)?.trim() ?? '';
    const options = (n.data?.options as string[] | undefined) ?? [];
    const nonEmpty = options.filter((o) => o?.trim()).length;

    if (!header) {
      push({
        code: 'empty-menu-header',
        severity: 'warning',
        nodeId: n.id,
        message: `Menu${n.data?.code ? ' ' + n.data.code : ''} sem texto do header`,
        hint: 'O header é a pergunta ou instrução do menu (ex: "Escolha uma opção").',
      });
    }
    if (nonEmpty === 0) {
      push({
        code: 'menu-no-options',
        severity: 'error',
        nodeId: n.id,
        message: `Menu${n.data?.code ? ' ' + n.data.code : ''} sem nenhuma opção válida`,
        hint: 'Adicione pelo menos uma opção. Menus exportados pro Blip exigem opções.',
      });
    }
    if (nonEmpty > 10) {
      push({
        code: 'menu-too-many-options',
        severity: 'info',
        nodeId: n.id,
        message: `Menu${n.data?.code ? ' ' + n.data.code : ''} tem ${nonEmpty} opções (Blip recomenda até 10)`,
        hint: 'WhatsApp lista limita visualmente em ~10 itens. Considere dividir em sub-menus.',
      });
    }
  }
}

function checkDirecionamento(state: LintState, push: Pusher): void {
  for (const n of state.nodes) {
    if (n.type !== 'direcionamento') continue;
    const tNodeId = n.data?.targetNodeId as string | undefined;
    const tFrameId = n.data?.targetFrameId as string | undefined;

    if (!tNodeId && !tFrameId) {
      push({
        code: 'direcionamento-no-target',
        severity: 'warning',
        nodeId: n.id,
        message: `Direcionamento${n.data?.code ? ' ' + n.data.code : ''} sem destino definido`,
        hint: 'Selecione o frame alvo nas propriedades.',
      });
      continue;
    }

    // Verifica que o destino EXISTE
    const targetExists =
      (tNodeId && state.nodeById.has(tNodeId)) ||
      (tFrameId && state.frameByFrameId.has(tFrameId));

    if (!targetExists) {
      push({
        code: 'dangling-direcionamento',
        severity: 'error',
        nodeId: n.id,
        message: `Direcionamento${n.data?.code ? ' ' + n.data.code : ''} aponta pra frame inexistente`,
        hint: `Alvo "${tFrameId ?? tNodeId}" não foi encontrado. Re-selecione o destino.`,
      });
    }
  }
}

function checkBtnNoTarget(state: LintState, push: Pusher): void {
  // Set de sources com pelo menos uma outgoing edge
  const sourcesWithEdges = new Set<string>();
  for (const e of state.edges) sourcesWithEdges.add(e.source);

  for (const n of state.nodes) {
    if (n.type !== 'btn-short' && n.type !== 'btn-long') continue;
    if (!sourcesWithEdges.has(n.id)) {
      const label = (n.data?.label as string | undefined) ?? '';
      const buttonText = (n.data?.buttonText as string | undefined) ?? '';
      const display = label || buttonText || 'sem texto';
      push({
        code: 'btn-no-target',
        severity: 'warning',
        nodeId: n.id,
        message: `Botão "${display}" sem destino`,
        hint: 'Conecte uma seta saindo do botão pro próximo bloco.',
      });
    }
  }
}

function checkCodeCollision(state: LintState, push: Pusher): void {
  const byCode = new Map<string, FluxoNode[]>();
  for (const n of state.nodes) {
    const code = n.data?.code as string | undefined;
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code)!.push(n);
  }
  for (const [code, nodes] of byCode) {
    if (nodes.length > 1) {
      // Reporta o primeiro como "principal" e os demais como colisão
      for (let i = 1; i < nodes.length; i++) {
        push({
          code: 'code-collision',
          severity: 'warning',
          nodeId: nodes[i].id,
          message: `Código duplicado: ${code} aparece em ${nodes.length} nodes`,
          hint: 'Rode "Reordenar IDs" pra normalizar os códigos da página.',
        });
      }
    }
  }
}

function checkFrameEmpty(state: LintState, push: Pusher): void {
  const MAIN_TYPES = new Set<string>([
    'bubble-bot', 'bubble-user', 'menu',
    'midia-imagem-bot', 'midia-imagem-user',
    'midia-documento-bot', 'midia-documento-user',
    'midia-video-bot', 'midia-video-user',
    'link', 'direcionamento', 'condicional', 'atendimento-humano',
    'integracao-api', 'integracao-planilha',
    'iag-entrada', 'iag-reentrada', 'iag-saida',
  ]);

  for (const f of state.nodes) {
    if (f.type !== 'frame') continue;
    const fx = f.position.x;
    const fy = f.position.y;
    const fw = (f.data?.width as number | undefined) ?? 656;
    const fh = (f.data?.height as number | undefined) ?? 400;

    const hasMain = state.nodes.some((n) => {
      if (!n.type || !MAIN_TYPES.has(n.type)) return false;
      if (n.parentId) return false;
      const cx = n.position.x + 100;
      const cy = n.position.y + 30;
      return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
    });

    if (!hasMain) {
      const title =
        (f.data?.title as string | undefined) ??
        (f.data?.frameId as string | undefined) ??
        'sem nome';
      push({
        code: 'frame-empty',
        severity: 'warning',
        nodeId: f.id,
        message: `Frame "${title}" está vazio`,
        hint: 'Adicione pelo menos um bubble, menu ou direcionamento dentro do frame.',
      });
    }
  }
}

function checkEntryPointNoTarget(state: LintState, push: Pusher): void {
  // Entry-points sem edge outgoing — o flow não consegue iniciar a partir deles
  const sourcesWithEdges = new Set<string>();
  for (const e of state.edges) sourcesWithEdges.add(e.source);

  for (const n of state.nodes) {
    if (n.type !== 'entry-point') continue;
    if (sourcesWithEdges.has(n.id)) continue;
    push({
      code: 'entry-point-no-target',
      severity: 'error',
      nodeId: n.id,
      message: 'Marcador de "Início" sem destino conectado',
      hint: 'Conecte uma seta saindo do Início pro primeiro bloco do frame.',
    });
  }
}

function checkFrameNoEntryPoint(state: LintState, push: Pusher): void {
  // Frames que TÊM ao menos um main mas NÃO TÊM entry-point dentro do bbox.
  const MAIN_TYPES = new Set<string>([
    'bubble-bot', 'bubble-user', 'menu',
    'midia-imagem-bot', 'midia-imagem-user',
    'midia-documento-bot', 'midia-documento-user',
    'midia-video-bot', 'midia-video-user',
    'link', 'direcionamento', 'condicional', 'atendimento-humano',
    'integracao-api', 'integracao-planilha',
    'iag-entrada', 'iag-reentrada', 'iag-saida',
  ]);

  const insideBBox = (
    n: FluxoNode,
    fx: number,
    fy: number,
    fw: number,
    fh: number
  ): boolean => {
    if (n.parentId) return false;
    const cx = n.position.x + 100;
    const cy = n.position.y + 30;
    return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
  };

  for (const f of state.nodes) {
    if (f.type !== 'frame') continue;
    const fx = f.position.x;
    const fy = f.position.y;
    const fw = (f.data?.width as number | undefined) ?? 656;
    const fh = (f.data?.height as number | undefined) ?? 400;

    const hasMain = state.nodes.some(
      (n) => n.type && MAIN_TYPES.has(n.type) && insideBBox(n, fx, fy, fw, fh)
    );
    if (!hasMain) continue; // frame vazio é reportado por outro check

    const hasEntryPoint = state.nodes.some(
      (n) => n.type === 'entry-point' && insideBBox(n, fx, fy, fw, fh)
    );
    if (hasEntryPoint) continue;

    const title =
      (f.data?.title as string | undefined) ??
      (f.data?.frameId as string | undefined) ??
      'sem nome';
    push({
      code: 'frame-no-entry-point',
      severity: 'warning',
      nodeId: f.id,
      message: `Frame "${title}" sem marcador de início`,
      hint: 'Use "Organizar layout" pra criar automaticamente, ou arraste um "Início" da paleta.',
    });
  }
}

function checkCondicional(state: LintState, push: Pusher): void {
  for (const n of state.nodes) {
    if (n.type !== 'condicional') continue;
    const cond = (n.data?.condition as string | undefined)?.trim() ?? '';
    if (!cond) {
      push({
        code: 'condicional-empty',
        severity: 'warning',
        nodeId: n.id,
        message: `Condicional${n.data?.code ? ' ' + n.data.code : ''} sem condição definida`,
        hint: 'Preencha a pergunta ou expressão avaliada (ex: "Cliente é VIP?").',
      });
    }
  }
}

function checkLink(state: LintState, push: Pusher): void {
  for (const n of state.nodes) {
    if (n.type !== 'link') continue;
    const url = (n.data?.url as string | undefined)?.trim() ?? '';
    if (!url) {
      push({
        code: 'link-no-url',
        severity: 'warning',
        nodeId: n.id,
        message: `Link${n.data?.code ? ' ' + n.data.code : ''} sem URL`,
        hint: 'Adicione a URL alvo nas propriedades.',
      });
    }
  }
}

function checkUnreachable(state: LintState, push: Pusher): void {
  const MAIN_TYPES = new Set<string>([
    'bubble-bot', 'bubble-user', 'menu',
    'midia-imagem-bot', 'midia-documento-bot', 'midia-video-bot',
  ]);

  // 1. Coleta entry-points explícitos (preferencial).
  const entryPoints = state.nodes.filter((n) => n.type === 'entry-point');

  // 2. Determina os "roots" do BFS de alcançabilidade.
  //    - Se houver entry-points: usa todos eles
  //    - Caso contrário, fallback: primeiro main do primeiro frame (heurística antiga)
  const rootIds: string[] = [];

  if (entryPoints.length > 0) {
    for (const ep of entryPoints) rootIds.push(ep.id);
  } else {
    const frames = state.nodes.filter((n) => n.type === 'frame');
    if (frames.length === 0) return;
    const firstFrame = frames.reduce((a, b) =>
      a.position.y < b.position.y ||
      (a.position.y === b.position.y && a.position.x < b.position.x)
        ? a
        : b
    );
    const fx = firstFrame.position.x;
    const fy = firstFrame.position.y;
    const fw = (firstFrame.data?.width as number | undefined) ?? 656;
    const fh = (firstFrame.data?.height as number | undefined) ?? 400;
    const mainsOfFirstFrame = state.nodes
      .filter((n) => {
        if (!n.type || !MAIN_TYPES.has(n.type)) return false;
        if (n.parentId) return false;
        const cx = n.position.x + 100;
        const cy = n.position.y + 30;
        return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
      })
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    const entry = mainsOfFirstFrame[0];
    if (entry) rootIds.push(entry.id);
  }

  if (rootIds.length === 0) return;

  // 3. BFS multi-source pelos edges
  const adj = new Map<string, string[]>();
  for (const e of state.edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  const reachable = new Set<string>();
  const queue: string[] = [...rootIds];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    const neighbors = adj.get(cur) ?? [];
    for (const t of neighbors) queue.push(t);
  }
  state.reachable = reachable;

  // 4. Reporta mains não-alcançáveis (apenas os com `code` — fluxo intencional)
  for (const n of state.nodes) {
    if (!n.type || !MAIN_TYPES.has(n.type)) continue;
    if (n.parentId) continue;
    if (reachable.has(n.id)) continue;
    const code = n.data?.code as string | undefined;
    if (!code) continue;
    push({
      code: 'unreachable-node',
      severity: 'info',
      nodeId: n.id,
      message: `Node ${code} não é alcançável a partir do início do fluxo`,
      hint: entryPoints.length > 0
        ? 'Adicione um direcionamento, condicional ou edge a partir de um "Início" existente.'
        : 'Adicione um nó "Início" (paleta → Estrutura) e conecte-o ao primeiro bloco do frame.',
    });
  }
}

// =============================================================================
// Variáveis quebradas: {{nome}} usadas que não foram declaradas
// =============================================================================
const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function checkBrokenVariables(state: LintState, push: Pusher): void {
  // 1. Variáveis declaradas — pega da fonte canônica (slug normalizado).
  const declaredSlugs = new Set(
    extractVariables(state.nodes).map((v) => v.name)
  );

  // 2. Campos textuais a varrer por node-type. Inclui paths simples e arrays.
  const TEXT_FIELDS: Record<string, string[]> = {
    'bubble-bot': ['text'],
    'bubble-user': ['text'],
    'menu': ['header', 'footer'],
    'btn-short': ['label'],
    'btn-long': ['label'],
    'link': ['linkTitle', 'description'],
    'condicional': ['condition'],
    'integracao-api': ['title', 'description'],
    'iag-entrada': ['prompt'],
    'iag-saida': ['title'],
  };

  for (const n of state.nodes) {
    if (!n.type || !TEXT_FIELDS[n.type]) continue;
    const fields = TEXT_FIELDS[n.type];
    const reported = new Set<string>();
    const data = (n.data ?? {}) as Record<string, unknown>;
    const allTexts: string[] = [];
    for (const f of fields) {
      const v = data[f];
      if (typeof v === 'string') allTexts.push(v);
    }
    // Menus têm `options: string[]` — varrer cada uma também
    if (n.type === 'menu' && Array.isArray(data.options)) {
      for (const o of data.options as unknown[]) {
        if (typeof o === 'string') allTexts.push(o);
      }
    }

    for (const text of allTexts) {
      let m: RegExpExecArray | null;
      VAR_REGEX.lastIndex = 0;
      while ((m = VAR_REGEX.exec(text)) !== null) {
        const raw = m[1];
        const slug = raw.toLowerCase();
        if (declaredSlugs.has(slug)) continue;
        if (reported.has(slug)) continue;
        reported.add(slug);
        push({
          code: 'broken-variable',
          severity: 'warning',
          nodeId: n.id,
          message: `Variável \`{{${raw}}}\` usada mas não declarada no fluxo`,
          hint: 'Crie um tracking input/output, IAG saída, ou bubble-user com esse nome — ou ajuste a referência.',
        });
      }
    }
  }
}

// =============================================================================
// Pré-validação Blip: limites de chars/items que a plataforma impõe
// =============================================================================
// Limites baseados na documentação Blip + UX WhatsApp Business:
//   - btn-short label: até 20 chars (botão lista)
//   - btn-long label:  até 72 chars (texto livre/long)
//   - menu header:     até 60 chars (cabeçalho da lista interativa)
//   - menu option:     até 24 chars (limite do título de cada item de lista)
const BLIP_LIMITS = {
  btnShort: 20,
  btnLong: 72,
  menuHeader: 60,
  menuOption: 24,
};

function checkBlipLimits(state: LintState, push: Pusher): void {
  for (const n of state.nodes) {
    if (n.type === 'btn-short') {
      const label = (n.data?.label as string | undefined)?.trim() ?? '';
      if (label.length > BLIP_LIMITS.btnShort) {
        push({
          code: 'btn-short-too-long',
          severity: 'warning',
          nodeId: n.id,
          message: `Botão curto com ${label.length} chars (limite ${BLIP_LIMITS.btnShort})`,
          hint: 'Encurte o texto ou troque pra "Botão longo" se precisar de mais espaço.',
        });
      }
    } else if (n.type === 'btn-long') {
      const label = (n.data?.label as string | undefined)?.trim() ?? '';
      if (label.length > BLIP_LIMITS.btnLong) {
        push({
          code: 'btn-long-too-long',
          severity: 'warning',
          nodeId: n.id,
          message: `Botão longo com ${label.length} chars (limite ${BLIP_LIMITS.btnLong})`,
          hint: 'WhatsApp trunca textos longos. Reduza pra caber.',
        });
      }
    } else if (n.type === 'menu') {
      const header = (n.data?.header as string | undefined)?.trim() ?? '';
      if (header.length > BLIP_LIMITS.menuHeader) {
        push({
          code: 'menu-header-too-long',
          severity: 'warning',
          nodeId: n.id,
          message: `Header do menu com ${header.length} chars (limite ${BLIP_LIMITS.menuHeader})`,
          hint: 'Mova parte do texto pro bubble-bot anterior, deixe o header como prompt curto.',
        });
      }
      const options = (n.data?.options as string[] | undefined) ?? [];
      for (let i = 0; i < options.length; i++) {
        const opt = options[i]?.trim() ?? '';
        if (opt.length > BLIP_LIMITS.menuOption) {
          push({
            code: 'menu-option-too-long',
            severity: 'warning',
            nodeId: n.id,
            message: `Opção #${i + 1} do menu com ${opt.length} chars (limite ${BLIP_LIMITS.menuOption})`,
            hint: 'WhatsApp lista trunca títulos longos. Encurte o texto da opção.',
          });
        }
      }
    }
  }
}

// =============================================================================
// Loops infinitos: ciclos no grafo onde NENHUM node é bubble-user
// (bubble-user pausa esperando o usuário — quebra naturalmente o loop).
// =============================================================================
function checkInfiniteLoops(state: LintState, push: Pusher): void {
  // Constrói lista de adjacência (saídas).
  const adj = new Map<string, string[]>();
  for (const e of state.edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  // Tarjan SCC — encontra strongly connected components.
  // Componente com size > 1 OU self-loop = ciclo.
  let idx = 0;
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  // Iterativa pra evitar stack overflow em grafos grandes.
  function strongConnect(v0: string) {
    const work: Array<{ v: string; iter: number }> = [{ v: v0, iter: 0 }];
    while (work.length > 0) {
      const top = work[work.length - 1];
      const { v, iter } = top;
      if (iter === 0) {
        index.set(v, idx);
        lowlink.set(v, idx);
        idx++;
        stack.push(v);
        onStack.add(v);
      }
      const neighbors = adj.get(v) ?? [];
      if (iter < neighbors.length) {
        top.iter++;
        const w = neighbors[iter];
        if (!index.has(w)) {
          work.push({ v: w, iter: 0 });
        } else if (onStack.has(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
        }
      } else {
        if (lowlink.get(v) === index.get(v)) {
          const comp: string[] = [];
          let w: string;
          do {
            w = stack.pop()!;
            onStack.delete(w);
            comp.push(w);
          } while (w !== v);
          sccs.push(comp);
        }
        work.pop();
        if (work.length > 0) {
          const parent = work[work.length - 1].v;
          lowlink.set(
            parent,
            Math.min(lowlink.get(parent)!, lowlink.get(v)!)
          );
        }
      }
    }
  }

  for (const n of state.nodes) {
    if (!index.has(n.id) && adj.has(n.id)) {
      strongConnect(n.id);
    }
  }

  // Filtra SCCs que são ciclos genuínos e SEM bubble-user dentro.
  for (const comp of sccs) {
    const isCycle =
      comp.length > 1 ||
      (comp.length === 1 && (adj.get(comp[0]) ?? []).includes(comp[0]));
    if (!isCycle) continue;

    // Se algum node do ciclo é bubble-user, o loop pausa pro user — OK.
    const hasUserPause = comp.some(
      (id) => state.nodeById.get(id)?.type === 'bubble-user'
    );
    if (hasUserPause) continue;

    // Reporta no primeiro node do ciclo (com code se houver).
    const sortedByCode = comp
      .map((id) => state.nodeById.get(id))
      .filter((n): n is FluxoNode => !!n)
      .sort((a, b) => {
        const ca = (a.data?.code as string | undefined) ?? '';
        const cb = (b.data?.code as string | undefined) ?? '';
        return ca.localeCompare(cb);
      });
    const pivot = sortedByCode[0];
    if (!pivot) continue;
    const otherCodes = sortedByCode
      .slice(1)
      .map((n) => (n.data?.code as string | undefined) ?? n.id.slice(0, 6))
      .join(' → ');
    push({
      code: 'infinite-loop',
      severity: 'warning',
      nodeId: pivot.id,
      message: `Loop sem saída envolvendo ${comp.length} bloco(s)${otherCodes ? `: ${otherCodes}` : ''}`,
      hint: 'Adicione um bubble-user (pausa pro usuário) ou um direcionamento que saia do ciclo.',
    });
  }
}

const ALL_CHECKS: Array<(state: LintState, push: Pusher) => void> = [
  checkEmptyText,
  checkMenu,
  checkDirecionamento,
  checkBtnNoTarget,
  checkCodeCollision,
  checkFrameEmpty,
  checkFrameNoEntryPoint,
  checkEntryPointNoTarget,
  checkCondicional,
  checkLink,
  checkBrokenVariables,
  checkBlipLimits,
  checkInfiniteLoops,
  checkUnreachable, // por último — pode ler `state.reachable` se quiser cachear
];

// =============================================================================
// Helpers públicos
// =============================================================================

/**
 * Conta problemas por severity. Útil pra badges/UI sem percorrer 2x.
 */
export function countBySeverity(problems: Problem[]): Record<ProblemSeverity, number> {
  return problems.reduce(
    (acc, p) => {
      acc[p.severity]++;
      return acc;
    },
    { error: 0, warning: 0, info: 0 } as Record<ProblemSeverity, number>
  );
}

/**
 * Agrupa problemas por nodeId — útil pra renderizar badges no canvas.
 * Retorna map node id → array de problemas naquele node.
 */
export function groupByNode(problems: Problem[]): Map<string, Problem[]> {
  const map = new Map<string, Problem[]>();
  for (const p of problems) {
    if (!p.nodeId) continue;
    if (!map.has(p.nodeId)) map.set(p.nodeId, []);
    map.get(p.nodeId)!.push(p);
  }
  return map;
}

/**
 * Determina a "pior" severity de uma lista — usado pra cor do badge no node.
 */
export function worstSeverity(problems: Problem[]): ProblemSeverity | null {
  if (problems.length === 0) return null;
  if (problems.some((p) => p.severity === 'error')) return 'error';
  if (problems.some((p) => p.severity === 'warning')) return 'warning';
  return 'info';
}
