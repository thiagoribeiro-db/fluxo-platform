/**
 * Interpretador do fluxo — usado pelo Test Playground pra simular uma
 * conversa sem precisar exportar pro Blip.
 *
 * Função PURA: recebe um snapshot do fluxo + estado atual + input opcional
 * e retorna o próximo estado + eventos a renderizar.
 *
 * Tipos suportados:
 *   - entry-point   passa direto pro target da edge
 *   - bubble-bot    emite uma BotMessage e segue
 *   - bubble-user   bloqueia esperando UserInput
 *   - menu          emite uma BotMessage com options + bloqueia esperando UserChoice
 *   - btn-short/long ramifica conforme label digitada ou clicada
 *   - direcionamento pula pro frame alvo (welcome do frame ou nó alvo)
 *   - condicional   bloqueia esperando UserChoice (Verdadeiro/Falso) — sem
 *                   avaliar a condição (não temos engine de expressão)
 *   - atendimento-humano FINALIZA com mensagem "atendido"
 *   - midias        emite uma BotMessage com kind apropriado
 *   - link          emite uma BotMessage do tipo link
 *
 * Saída: lista de `RunnerEvent[]` (mensagens a renderizar) + next state.
 */
import type { Edge } from '@xyflow/react';
import type { FluxoNode, FluxoNodeType } from '@/lib/types';

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export type RunnerEvent =
  | { kind: 'bot-text'; nodeId: string; text: string }
  | { kind: 'bot-media'; nodeId: string; mediaKind: 'imagem' | 'documento' | 'video'; caption?: string; filename?: string }
  | { kind: 'bot-link'; nodeId: string; url: string; title?: string; description?: string }
  | { kind: 'bot-menu'; nodeId: string; header: string; options: string[] }
  | { kind: 'bot-conditional'; nodeId: string; condition: string; trueLabel: string; falseLabel: string }
  | {
      kind: 'bot-integration';
      nodeId: string;
      title: string;
      subtype: FluxoNodeType;
      /** Pra `integracao-api` com mock configurado — exibe no Playback. */
      apiMethod?: string;
      apiUrl?: string;
      apiMockStatus?: number;
      apiMockResponse?: string;
    }
  | { kind: 'user-input'; nodeId: string; placeholder?: string }
  | { kind: 'user-buttons'; nodeId: string; buttons: Array<{ label: string; btnNodeId: string }> }
  | { kind: 'system'; text: string }
  | { kind: 'end'; reason: 'handoff' | 'dead-end' | 'completed' };

export type AwaitingInput =
  | { kind: 'none' }
  | { kind: 'text'; nodeId: string }
  | { kind: 'menu'; nodeId: string; options: string[] }
  | { kind: 'buttons'; nodeId: string; buttons: Array<{ label: string; btnNodeId: string }> }
  | { kind: 'conditional'; nodeId: string; trueLabel: string; falseLabel: string };

export interface RunnerState {
  currentNodeId: string | null;
  awaiting: AwaitingInput;
  /** True quando o fluxo terminou (handoff/dead-end). */
  finished: boolean;
}

export interface StepInput {
  /** Resposta digitada (pra bubble-user) ou label escolhida (pra menu/buttons). */
  userInput?: string;
  /** ID do botão clicado (pra desambiguar opções com label igual). */
  btnNodeId?: string;
  /** Choice booleana pra condicional. */
  conditionalChoice?: boolean;
}

export interface StepResult {
  events: RunnerEvent[];
  state: RunnerState;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Determina o nó inicial do fluxo.
 *
 * Estratégia: o "frame principal" é o frame mais top-left do canvas
 * (mesma heurística usada no Blip export). Dentro dele, prefere o
 * entry-point se houver, senão pega o primeiro main.
 *
 * Frames secundários (algo-mais, encerramento, etc.) têm entry-points
 * próprios mas NÃO são o início do bot — eles só são alcançados via
 * direcionamento a partir do frame principal.
 */
export function findEntryNodeId(
  nodes: FluxoNode[],
  edges: Edge[]
): string | null {
  const hasOutgoing = (id: string) => edges.some((e) => e.source === id);

  // 1. Acha o frame "principal" (top-left)
  const frames = nodes.filter((n) => n.type === 'frame');
  if (frames.length === 0) {
    const anyEntryWithEdge = nodes.find(
      (n) => n.type === 'entry-point' && hasOutgoing(n.id)
    );
    if (anyEntryWithEdge) return anyEntryWithEdge.id;
    const anyEntry = nodes.find((n) => n.type === 'entry-point');
    if (anyEntry) return anyEntry.id;
    return findFirstMain(nodes);
  }
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

  const insideMain = (n: FluxoNode) => {
    if (n.parentId) return false;
    const cx = n.position.x + 100;
    const cy = n.position.y + 30;
    return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
  };

  // 2. Entry-point DENTRO do frame principal cujo TARGET também está
  //    dentro do frame (= é o início REAL daquele frame). Filtra
  //    entry-points "errantes" que apontam pra outro frame.
  const entriesInside = nodes.filter(
    (n) => n.type === 'entry-point' && insideMain(n)
  );
  const entryGoingInternal = entriesInside.find((ep) => {
    const out = edges.find((e) => e.source === ep.id);
    if (!out) return false;
    const target = nodes.find((n) => n.id === out.target);
    if (!target) return false;
    return insideMain(target);
  });
  if (entryGoingInternal) return entryGoingInternal.id;
  // Fallback: qualquer entry-point dentro do frame com edge outgoing
  const entryWithEdge = entriesInside.find((ep) => hasOutgoing(ep.id));
  if (entryWithEdge) return entryWithEdge.id;

  // 3. Primeiro main do frame principal — fallback útil quando o
  //    entry-point ainda não foi conectado, ou quando o frame não tem
  //    entry-point algum
  const mainsInside = nodes
    .filter((n) => n.type && isMainType(n.type) && insideMain(n))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  return mainsInside[0]?.id ?? null;
}

/**
 * Inicia uma nova sessão de playback.
 */
export function startRun(
  nodes: FluxoNode[],
  edges: Edge[]
): StepResult {
  const entryId = findEntryNodeId(nodes, edges);
  if (!entryId) {
    return {
      events: [{ kind: 'system', text: 'Fluxo vazio — adicione pelo menos um frame com conteúdo.' }],
      state: { currentNodeId: null, awaiting: { kind: 'none' }, finished: true },
    };
  }
  // Advance to first emit-able node
  return advance(nodes, edges, entryId, []);
}

/**
 * Avança o fluxo com input do usuário.
 *
 * Quando `state.awaiting.kind !== 'none'`, esta função processa o input
 * e segue o fluxo até o próximo bloqueio (user-input/menu/buttons/cond)
 * ou final.
 */
export function step(
  nodes: FluxoNode[],
  edges: Edge[],
  state: RunnerState,
  input: StepInput
): StepResult {
  if (state.finished) {
    return { events: [], state };
  }
  if (state.awaiting.kind === 'none') {
    // Estado inconsistente — não deveria chamar step sem awaiting
    return { events: [], state };
  }

  const events: RunnerEvent[] = [];

  // Resolve próximo nodeId conforme o tipo de input.
  // Captura `awaiting` em const local pra preservar o narrowing do TS.
  let nextId: string | null = null;
  const awaiting = state.awaiting;
  switch (awaiting.kind) {
    case 'text': {
      const userText = input.userInput?.trim() ?? '';
      events.push({ kind: 'user-input', nodeId: awaiting.nodeId, placeholder: userText });
      // bubble-user → segue pra próxima edge outgoing
      nextId = findEdgeTarget(edges, awaiting.nodeId);
      break;
    }
    case 'menu': {
      const choice = input.userInput?.trim() ?? '';
      events.push({
        kind: 'user-input',
        nodeId: awaiting.nodeId,
        placeholder: choice,
      });
      // Resolve próximo nó da escolha do menu, em ordem:
      //  1. btn-short/btn-long como children do menu (edge outgoing) com label match
      //  2. Direcionamento NO MESMO FRAME do menu com label match (padrão
      //     Blip: cada opção do menu = 1 direcionamento separado, sem edge
      //     direta — o roteamento é por script/match no Blip)
      //  3. Edge default outgoing do menu (fallback)
      const menuNode = nodes.find((n) => n.id === awaiting.nodeId);
      const btns = findButtonChildren(nodes, edges, awaiting.nodeId);
      const normalize = (s: string) => s.toLowerCase().trim();
      const matchedBtn = btns.find(
        (b) => normalize(b.label ?? '') === normalize(choice)
      );
      if (matchedBtn) {
        const btnNode = nodes.find((n) => n.id === matchedBtn.btnNodeId);
        if (btnNode?.type === 'direcionamento') {
          nextId = matchedBtn.btnNodeId; // advance resolve target
        } else {
          nextId = findEdgeTarget(edges, matchedBtn.btnNodeId);
        }
      } else if (menuNode) {
        // 2. Procura direcionamento do mesmo frame com label match
        const matchedDir = findMenuOptionDirecionamento(
          nodes,
          menuNode,
          choice
        );
        if (matchedDir) {
          nextId = matchedDir.id;
        } else {
          // 3. Fallback: primeira edge outgoing
          nextId = findEdgeTarget(edges, menuNode.id);
        }
      }
      break;
    }
    case 'buttons': {
      const btnNodeId = input.btnNodeId;
      if (btnNodeId) {
        const btn = awaiting.buttons.find((b) => b.btnNodeId === btnNodeId);
        if (btn) {
          events.push({
            kind: 'user-input',
            nodeId: awaiting.nodeId,
            placeholder: btn.label,
          });
          const btnNode = nodes.find((n) => n.id === btnNodeId);
          if (btnNode?.type === 'direcionamento') {
            // Vai PARA o direcionamento — advance() resolve targetFrameId/targetNodeId
            nextId = btnNodeId;
          } else {
            // btn-short/btn-long: pula direto pro seu target via outgoing edge
            nextId = findEdgeTarget(edges, btnNodeId);
          }
        }
      }
      break;
    }
    case 'conditional': {
      const choice = input.conditionalChoice;
      if (typeof choice === 'boolean') {
        const label = choice ? awaiting.trueLabel : awaiting.falseLabel;
        events.push({
          kind: 'user-input',
          nodeId: awaiting.nodeId,
          placeholder: label,
        });
        // Edges de condicional usam sourceHandle "true"/"false" (lowercase)
        // — mas aceita também TRUE/FALSE pra robustez. Tenta lowercase primeiro.
        const wanted = choice ? 'true' : 'false';
        nextId = findEdgeTargetCI(edges, awaiting.nodeId, wanted);
      }
      break;
    }
  }

  if (!nextId) {
    events.push({ kind: 'end', reason: 'dead-end' });
    return {
      events,
      state: {
        currentNodeId: state.currentNodeId,
        awaiting: { kind: 'none' },
        finished: true,
      },
    };
  }

  return advance(nodes, edges, nextId, events);
}

/**
 * Reset — começa uma nova run do início.
 */
export function resetRun(
  nodes: FluxoNode[],
  edges: Edge[]
): StepResult {
  return startRun(nodes, edges);
}

// =============================================================================
// INTERNALS
// =============================================================================

const MAIN_TYPES: ReadonlySet<string> = new Set<FluxoNodeType>([
  'bubble-bot', 'bubble-user', 'menu',
  'midia-imagem-bot', 'midia-imagem-user',
  'midia-documento-bot', 'midia-documento-user',
  'midia-video-bot', 'midia-video-user',
  'link', 'direcionamento', 'condicional', 'atendimento-humano',
  'integracao-api', 'integracao-planilha',
  'iag-entrada', 'iag-reentrada', 'iag-saida',
]);

function isMainType(t: string): boolean {
  return MAIN_TYPES.has(t);
}

/**
 * Acha o "welcome" (primeiro main) do frame identificado por `frameId`
 * humano (slug ou título). Usado pelos direcionamentos quando não há
 * targetNodeId específico.
 */
function resolveFrameWelcome(
  nodes: FluxoNode[],
  frameId: string
): string | null {
  const frameNode = nodes.find(
    (n) =>
      n.type === 'frame' &&
      (n.data?.frameId === frameId || n.data?.title === frameId)
  );
  if (!frameNode) return null;
  const fx = frameNode.position.x;
  const fy = frameNode.position.y;
  const fw = (frameNode.data?.width as number | undefined) ?? 656;
  const fh = (frameNode.data?.height as number | undefined) ?? 400;
  const targetMains = nodes
    .filter((n) => {
      if (!n.type || !isMainType(n.type)) return false;
      if (n.parentId) return false;
      const cx = n.position.x + 100;
      const cy = n.position.y + 30;
      return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
    })
    .sort((a, b) => a.position.y - b.position.y);
  return targetMains[0]?.id ?? null;
}

function findFirstMain(nodes: FluxoNode[]): string | null {
  const mains = nodes
    .filter((n) => n.type && isMainType(n.type) && !n.parentId)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  return mains[0]?.id ?? null;
}

function findEdgeTarget(
  edges: Edge[],
  source: string,
  sourceHandle?: string
): string | null {
  const matches = edges.filter(
    (e) =>
      e.source === source &&
      (sourceHandle ? e.sourceHandle === sourceHandle : true)
  );
  return matches[0]?.target ?? null;
}

/** Variante case-insensitive do `findEdgeTarget` — pra condicionais cujo
 * sourceHandle pode estar "true"/"false" ou "TRUE"/"FALSE". */
function findEdgeTargetCI(
  edges: Edge[],
  source: string,
  sourceHandle: string
): string | null {
  const wanted = sourceHandle.toLowerCase();
  const match = edges.find(
    (e) =>
      e.source === source &&
      (e.sourceHandle ?? '').toLowerCase() === wanted
  );
  return match?.target ?? null;
}

/**
 * Acha um direcionamento dentro do mesmo frame do menu cuja label dá
 * match com a opção escolhida. Padrão Blip — no nosso editor, opções de
 * menu não têm edges diretas pros direcionamentos; o vínculo é por
 * MATCH textual (label da opção == label do direcionamento).
 *
 * Match: tira prefixo "→ " do direcionamento e compara case-insensitive,
 * trim. Aceita também substring para casos com prefixo extra (ex: "→ 1.
 * Ofertas" vs "Ofertas").
 */
function findMenuOptionDirecionamento(
  nodes: FluxoNode[],
  menuNode: FluxoNode,
  choice: string
): FluxoNode | null {
  // Bbox aproximado: usa o frame que contém o menu
  // (heurística simples: frame top-left que contém o menu)
  const frames = nodes.filter((n) => n.type === 'frame');
  const containerFrame = frames.find((f) => {
    const fx = f.position.x;
    const fy = f.position.y;
    const fw = (f.data?.width as number | undefined) ?? 656;
    const fh = (f.data?.height as number | undefined) ?? 400;
    const cx = menuNode.position.x + 100;
    const cy = menuNode.position.y + 30;
    return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
  });
  if (!containerFrame) return null;

  const fx = containerFrame.position.x;
  const fy = containerFrame.position.y;
  const fw = (containerFrame.data?.width as number | undefined) ?? 656;
  const fh = (containerFrame.data?.height as number | undefined) ?? 400;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/^[→➡▶▸>\s\d.)\-]+/, '') // tira prefixo "→ " ou "1. "
      .trim();
  const targetNorm = normalize(choice);
  if (!targetNorm) return null;

  const candidates = nodes.filter((n) => {
    if (n.type !== 'direcionamento') return false;
    if (n.parentId) return false;
    const cx = n.position.x + 100;
    const cy = n.position.y + 30;
    return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
  });

  // 1) Match exato
  for (const c of candidates) {
    const rawLabel = (c.data?.label as string | undefined) ?? '';
    if (normalize(rawLabel) === targetNorm) return c;
  }
  // 2) Match parcial (substring) — pra labels com texto extra
  for (const c of candidates) {
    const rawLabel = normalize((c.data?.label as string | undefined) ?? '');
    if (rawLabel && (rawLabel.includes(targetNorm) || targetNorm.includes(rawLabel))) {
      return c;
    }
  }
  return null;
}

function findButtonChildren(
  nodes: FluxoNode[],
  edges: Edge[],
  parentNodeId: string
): Array<{ label: string; btnNodeId: string }> {
  // Edges outgoing do parent — coleta btn-short/btn-long sempre, e
  // direcionamentos quando há >= 2 saídas (= bifurcação que exige escolha).
  const outgoing = edges.filter((e) => e.source === parentNodeId);

  // 1. btn-short / btn-long sempre são botões interativos
  const btns: Array<{ label: string; btnNodeId: string }> = [];
  for (const e of outgoing) {
    const target = nodes.find((n) => n.id === e.target);
    if (!target) continue;
    if (target.type === 'btn-short' || target.type === 'btn-long') {
      const label =
        (target.data?.label as string | undefined) ??
        (target.data?.buttonText as string | undefined) ??
        '';
      btns.push({ label, btnNodeId: target.id });
    }
  }
  if (btns.length > 0) return btns;

  // 2. Múltiplos direcionamentos viram botões pro user escolher o caminho.
  //    Se houver só 1 direcionamento → não é bifurcação, segue automático.
  const directs: Array<{ label: string; btnNodeId: string }> = [];
  for (const e of outgoing) {
    const target = nodes.find((n) => n.id === e.target);
    if (!target) continue;
    if (target.type === 'direcionamento') {
      const rawLabel =
        (target.data?.label as string | undefined) ??
        (target.data?.destinationLabel as string | undefined) ??
        'Ir';
      // Limpa prefixo "→ " comum nos direcionamentos
      const label = rawLabel.replace(/^[→➡▶▸>\s]+/, '').trim() || rawLabel;
      directs.push({ label, btnNodeId: target.id });
    }
  }
  if (directs.length >= 2) return directs;

  return [];
}

/**
 * Loop principal: avança nodes "passantes" (bot, midia, link, direcionamento,
 * entry-point) emitindo eventos até bater num "bloqueante" (user, menu,
 * conditional, buttons) ou terminal (handoff, dead-end).
 */
function advance(
  nodes: FluxoNode[],
  edges: Edge[],
  startNodeId: string,
  accEvents: RunnerEvent[]
): StepResult {
  const events: RunnerEvent[] = [...accEvents];
  const visited = new Set<string>();
  let currentId: string | null = startNodeId;

  // Loop limitado pra evitar infinite loop em ciclos
  const MAX_STEPS = 200;
  let steps = 0;

  while (currentId && steps < MAX_STEPS) {
    if (visited.has(currentId)) {
      events.push({ kind: 'system', text: '⚠️ Loop detectado — interrompendo simulação.' });
      return {
        events,
        state: { currentNodeId: currentId, awaiting: { kind: 'none' }, finished: true },
      };
    }
    visited.add(currentId);
    steps++;

    const node = nodes.find((n) => n.id === currentId);
    if (!node) {
      events.push({ kind: 'end', reason: 'dead-end' });
      return {
        events,
        state: { currentNodeId: null, awaiting: { kind: 'none' }, finished: true },
      };
    }

    const type = node.type;
    switch (type) {
      case 'entry-point': {
        currentId = findEdgeTarget(edges, node.id);
        break;
      }
      case 'bubble-bot': {
        const text = (node.data?.text as string | undefined) ?? '';
        if (text) events.push({ kind: 'bot-text', nodeId: node.id, text });
        // Se tem btn-short/btn-long como filhos diretos (via outgoing edge),
        // BLOQUEIA esperando user clicar. Padrão: bot pergunta → 2+ botões.
        const buttons = findButtonChildren(nodes, edges, node.id);
        if (buttons.length > 0) {
          events.push({ kind: 'user-buttons', nodeId: node.id, buttons });
          return {
            events,
            state: {
              currentNodeId: node.id,
              awaiting: { kind: 'buttons', nodeId: node.id, buttons },
              finished: false,
            },
          };
        }
        currentId = findEdgeTarget(edges, node.id);
        break;
      }
      case 'bubble-user': {
        // Bloqueia esperando input
        return {
          events,
          state: {
            currentNodeId: node.id,
            awaiting: { kind: 'text', nodeId: node.id },
            finished: false,
          },
        };
      }
      case 'menu': {
        const header = (node.data?.header as string | undefined) ?? 'Selecione uma opção';
        const options = ((node.data?.options as string[] | undefined) ?? []).filter(
          (o) => o?.trim()
        );
        events.push({ kind: 'bot-menu', nodeId: node.id, header, options });
        return {
          events,
          state: {
            currentNodeId: node.id,
            awaiting: { kind: 'menu', nodeId: node.id, options },
            finished: false,
          },
        };
      }
      case 'btn-short':
      case 'btn-long': {
        // Não deveria chegar aqui sozinho (btns são alcançados via menu).
        // Mas se chegar, segue a outgoing.
        currentId = findEdgeTarget(edges, node.id);
        break;
      }
      case 'direcionamento': {
        const tNodeId = node.data?.targetNodeId as string | undefined;
        const tFrameId = node.data?.targetFrameId as string | undefined;
        const label = (node.data?.label as string | undefined) ?? '?';
        // Resolve alvo
        if (tNodeId && nodes.some((n) => n.id === tNodeId)) {
          // Prioridade 1: bloco específico configurado
          currentId = tNodeId;
        } else if (tNodeId && tFrameId) {
          // targetNodeId aponta pra node inexistente — link quebrado, avisa
          events.push({
            kind: 'system',
            text: `⚠️ "${label}" tem bloco específico inválido — indo pro início do frame ${tFrameId}.`,
          });
          // Cai no fluxo de tFrameId abaixo
          currentId = resolveFrameWelcome(nodes, tFrameId);
        } else if (tFrameId) {
          currentId = resolveFrameWelcome(nodes, tFrameId);
        } else {
          currentId = findEdgeTarget(edges, node.id);
        }
        break;
      }
      case 'condicional': {
        const condition = (node.data?.condition as string | undefined) ?? 'Condição?';
        const trueLabel = (node.data?.trueLabel as string | undefined) ?? 'Verdadeiro';
        const falseLabel = (node.data?.falseLabel as string | undefined) ?? 'Falso';
        events.push({
          kind: 'bot-conditional',
          nodeId: node.id,
          condition,
          trueLabel,
          falseLabel,
        });
        return {
          events,
          state: {
            currentNodeId: node.id,
            awaiting: { kind: 'conditional', nodeId: node.id, trueLabel, falseLabel },
            finished: false,
          },
        };
      }
      case 'atendimento-humano': {
        events.push({ kind: 'system', text: '🧑 Transbordo pro atendimento humano.' });
        events.push({ kind: 'end', reason: 'handoff' });
        return {
          events,
          state: { currentNodeId: node.id, awaiting: { kind: 'none' }, finished: true },
        };
      }
      case 'link': {
        const url = (node.data?.url as string | undefined) ?? '';
        const title = (node.data?.linkTitle as string | undefined) ?? 'Link';
        const description = node.data?.linkDescription as string | undefined;
        events.push({ kind: 'bot-link', nodeId: node.id, url, title, description });
        currentId = findEdgeTarget(edges, node.id);
        break;
      }
      case 'midia-imagem-bot':
      case 'midia-documento-bot':
      case 'midia-video-bot': {
        const mediaKind = type.replace('midia-', '').replace('-bot', '') as
          | 'imagem' | 'documento' | 'video';
        events.push({
          kind: 'bot-media',
          nodeId: node.id,
          mediaKind,
          caption: node.data?.caption as string | undefined,
          filename: node.data?.filename as string | undefined,
        });
        currentId = findEdgeTarget(edges, node.id);
        break;
      }
      case 'midia-imagem-user':
      case 'midia-documento-user':
      case 'midia-video-user': {
        // User envia mídia → bloqueia (representa esperar upload)
        return {
          events,
          state: {
            currentNodeId: node.id,
            awaiting: { kind: 'text', nodeId: node.id },
            finished: false,
          },
        };
      }
      case 'integracao-api':
      case 'integracao-planilha':
      case 'iag-entrada':
      case 'iag-reentrada':
      case 'iag-saida': {
        const title = (node.data?.title as string | undefined) ?? 'Integração';
        // Pra integracao-api, propaga os campos do mock pro evento — o
        // PlaybackPanel exibe method/URL/response no UI sem precisar
        // refazer query no node.
        const isApi = type === 'integracao-api';
        events.push({
          kind: 'bot-integration',
          nodeId: node.id,
          title,
          subtype: type,
          ...(isApi
            ? {
                apiMethod: node.data?.apiMethod as string | undefined,
                apiUrl: node.data?.apiUrl as string | undefined,
                apiMockStatus: node.data?.apiMockStatus as number | undefined,
                apiMockResponse: node.data?.apiMockResponse as string | undefined,
              }
            : {}),
        });
        currentId = findEdgeTarget(edges, node.id);
        break;
      }
      default: {
        // Tipo não esperado (frame, tracking, excecao, sep, etc.) — pula
        currentId = findEdgeTarget(edges, node.id);
        break;
      }
    }
  }

  // Saiu do loop sem return: fim do fluxo
  if (steps >= MAX_STEPS) {
    events.push({ kind: 'system', text: '⚠️ Limite de passos atingido.' });
  } else {
    events.push({ kind: 'end', reason: 'completed' });
  }
  return {
    events,
    state: { currentNodeId: null, awaiting: { kind: 'none' }, finished: true },
  };
}
