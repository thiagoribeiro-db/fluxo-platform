/**
 * Builder — converte `ParsedSection[]` em `ProjectState`.
 *
 * Cria nodes + edges respeitando padrões do Fluxo Platform:
 *  - Cada seção vira um frame
 *  - Tracking de exibição em bubble-bot/menu
 *  - Tracking de input em bubble-user/menu (com nome inferido)
 *  - Exceção em bubble-user
 *  - btn-short pra 2-3 opções; menu pra 4+; btn-long pra 1
 *  - Condicionais com branches TRUE/FALSE
 *  - Links viram nó `link`
 *  - IA generativa vira `iag-entrada` ou `iag-saida`
 *  - Integração API vira `integracao-api`
 *  - Atendimento humano vira nó terminal
 *  - Direcionamentos com `targetFrameId` resolvido por fuzzy match
 *
 * Variáveis detectadas em qualquer texto viram trackings INPUT extras
 * no main correspondente (sem duplicar).
 */

import type { Edge } from '@xyflow/react';
import type { FluxoNode, FluxoNodeType, ProjectState } from '@/lib/types';
import { slugify, extractTrackingName } from '@/lib/components/nodes/helpers';
import type { ParsedSection } from './tokenize';
import type { ParsedBlock } from './detect-blocks';
import { extractVariables } from './detect-vars';

let _counter = 0;
function uid(prefix: string): string {
  _counter += 1;
  return `${prefix}-${_counter.toString(36)}`;
}

function makePrefix(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'X';
  return (
    words
      .map((w) => w[0]?.toUpperCase())
      .filter(Boolean)
      .join('')
      .slice(0, 3) || 'X'
  );
}

function makeFrameId(title: string): string {
  return slugify(title, 40) || `frame-${_counter}`;
}

/**
 * Fuzzy match — encontra o frame mais parecido pelo título.
 * Score simples: substring + similaridade de prefixo.
 */
function findTargetFrame(
  hint: string,
  sections: ParsedSection[]
): { frameId: string; title: string } | null {
  const needle = slugify(hint, 40);
  if (!needle) return null;

  // 1. Match exato no slug
  for (const s of sections) {
    if (slugify(s.title, 40) === needle) {
      return { frameId: slugify(s.title, 40), title: s.title };
    }
  }
  // 2. Substring match
  let best: { frameId: string; title: string; score: number } | null = null;
  for (const s of sections) {
    const slug = slugify(s.title, 40);
    let score = 0;
    if (slug.includes(needle) || needle.includes(slug)) {
      score = Math.min(slug.length, needle.length) / Math.max(slug.length, needle.length);
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { frameId: slug, title: s.title, score };
    }
  }
  return best ? { frameId: best.frameId, title: best.title } : null;
}

interface BuildContext {
  framePos: { x: number; y: number };
  frameW: number;
  prefix: string;
  seq: number;
  y: number;
  bx: number;
  lastFlowId: string | null;
  /** Trackings já criados pra um node (evita duplicar a mesma var). */
  trackingsByNodeId: Map<string, Set<string>>;
  /** Vars do escopo já capturadas — alimenta os trackings input automáticos. */
  scopeVars: Set<string>;
}

export function buildProjectState(sections: ParsedSection[]): ProjectState {
  _counter = 0;

  const allNodes: FluxoNode[] = [];
  const allEdges: Edge[] = [];

  const FW = 900;
  const FH = 1400;
  const COL_GAP = 100;
  const ROW_GAP = 200;
  const COLS = 4;

  // Resolução de direcionamentos é feita em segundo passo — guardamos uma
  // lista pendente pra setar targetFrameId/clickable depois que todos os
  // frames foram criados.
  const pendingDirecionamentos: Array<{
    nodeId: string;
    hint: string;
  }> = [];

  sections.forEach((section, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const framePos = {
      x: col * (FW + COL_GAP),
      y: row * (FH + ROW_GAP),
    };
    const prefix = makePrefix(section.title);
    const frameId = makeFrameId(section.title);

    allNodes.push({
      id: uid('frame'),
      type: 'frame',
      position: framePos,
      data: {
        title: section.title,
        prefix,
        frameId,
        code: prefix,
        width: FW,
        height: FH,
      },
    });

    const ctx: BuildContext = {
      framePos,
      frameW: FW,
      prefix,
      seq: 1,
      y: framePos.y + 80,
      bx: framePos.x + 400,
      lastFlowId: null,
      trackingsByNodeId: new Map(),
      scopeVars: new Set(),
    };

    for (const block of section.blocks) {
      processBlock(block, ctx, allNodes, allEdges, pendingDirecionamentos);
    }
  });

  // SEGUNDO PASSO: resolver direcionamentos pelo hint
  for (const pd of pendingDirecionamentos) {
    const node = allNodes.find((n) => n.id === pd.nodeId);
    if (!node) continue;
    const target = findTargetFrame(pd.hint, sections);
    if (target) {
      node.data = {
        ...(node.data ?? {}),
        targetFrameId: target.frameId,
        clickable: true,
        label: node.data?.label ?? `→ ${target.title}`,
      };
    }
  }

  return {
    nodes: allNodes,
    edges: allEdges,
    viewport: { x: 0, y: 0, zoom: 0.3 },
  };
}

function nextCode(ctx: BuildContext): string {
  return `${ctx.prefix}${String(ctx.seq++).padStart(3, '0')}`;
}

function connectFromLast(ctx: BuildContext, allEdges: Edge[], targetId: string) {
  if (!ctx.lastFlowId) return;
  allEdges.push({
    id: uid('e'),
    source: ctx.lastFlowId,
    target: targetId,
    animated: true,
  });
}

function addTracking(
  parentId: string,
  label: string,
  ctx: BuildContext,
  allNodes: FluxoNode[]
) {
  const existing = ctx.trackingsByNodeId.get(parentId) ?? new Set<string>();
  if (existing.has(label)) return;
  existing.add(label);
  ctx.trackingsByNodeId.set(parentId, existing);
  const index = existing.size - 1;
  allNodes.push({
    id: uid('trk'),
    type: 'tracking',
    parentId,
    position: { x: -256, y: index * 52 },
    data: { label },
  });
}

function processBlock(
  block: ParsedBlock,
  ctx: BuildContext,
  allNodes: FluxoNode[],
  allEdges: Edge[],
  pendingDirecionamentos: Array<{ nodeId: string; hint: string }>
) {
  switch (block.kind) {
    case 'bot': {
      const id = uid('bot');
      allNodes.push({
        id,
        type: 'bubble-bot',
        position: { x: ctx.bx, y: ctx.y },
        data: { code: nextCode(ctx), text: block.text, time: '9.41 AM' },
      });
      addTracking(id, `${extractTrackingName(block.text)} exibicao`, ctx, allNodes);
      // Coleta variáveis do texto pra alimentar trackings input automáticos
      for (const v of extractVariables(block.text)) ctx.scopeVars.add(v.name);
      connectFromLast(ctx, allEdges, id);
      ctx.lastFlowId = id;
      ctx.y += 160;
      break;
    }

    case 'user': {
      const id = uid('user');
      allNodes.push({
        id,
        type: 'bubble-user',
        position: { x: ctx.bx + 60, y: ctx.y },
        data: { code: nextCode(ctx), text: block.text, time: '9.41 AM' },
      });

      // Tracking de input no main anterior (bot/menu) — com nome inferido
      const prev = ctx.lastFlowId
        ? allNodes.find((n) => n.id === ctx.lastFlowId)
        : null;
      if (prev && (prev.type === 'bubble-bot' || prev.type === 'menu')) {
        const prevText =
          (prev.data?.text as string | undefined) ??
          (prev.data?.header as string | undefined) ??
          '';
        const inputName = inferInputName(prevText, block.text);
        addTracking(prev.id, `${inputName} input`, ctx, allNodes);
      }

      // Exceção no user
      allNodes.push({
        id: uid('exc'),
        type: 'excecao',
        parentId: id,
        position: { x: 0, y: 140 },
        data: { label: 'Exceção / Fallback' },
      });

      connectFromLast(ctx, allEdges, id);
      ctx.lastFlowId = id;
      ctx.y += 160;
      break;
    }

    case 'options': {
      const opts = block.items;
      if (opts.length === 1) {
        const id = uid('btn');
        allNodes.push({
          id,
          type: 'btn-long',
          position: { x: ctx.bx, y: ctx.y },
          data: { code: nextCode(ctx), label: opts[0] },
        });
        connectFromLast(ctx, allEdges, id);
        ctx.lastFlowId = id;
        ctx.y += 70;
      } else if (opts.length <= 3 && opts.every((o) => o.length <= 20)) {
        // btn-short paralelos — só se opções curtas
        const BTN_W = 130;
        const GAP_X = 12;
        const totalW = opts.length * BTN_W + (opts.length - 1) * GAP_X;
        const startX = ctx.framePos.x + (ctx.frameW - totalW) / 2;
        const sourceId = ctx.lastFlowId;
        opts.forEach((opt, i) => {
          const id = uid('btn');
          allNodes.push({
            id,
            type: 'btn-short',
            position: { x: startX + i * (BTN_W + GAP_X), y: ctx.y },
            data: { code: nextCode(ctx), label: opt },
          });
          if (sourceId) {
            allEdges.push({
              id: uid('e'),
              source: sourceId,
              target: id,
              animated: true,
            });
          }
        });
        ctx.y += 80;
      } else {
        // menu (4+ opções ou opções longas)
        const id = uid('menu');
        allNodes.push({
          id,
          type: 'menu',
          position: { x: ctx.bx, y: ctx.y },
          data: {
            code: nextCode(ctx),
            header: 'Selecione uma opção',
            options: opts,
            footer: 'Enviar',
          },
        });
        ['exibicao', 'selecao', 'inesperado'].forEach((kind, k) => {
          addTracking(id, `selecione opcao ${kind}`, ctx, allNodes);
          void k;
        });
        connectFromLast(ctx, allEdges, id);
        ctx.lastFlowId = id;
        ctx.y += 80 + opts.length * 50;
      }
      break;
    }

    case 'media': {
      const id = uid('midia');
      const sender = block.sender;
      // 4 tipos suportados (imagem|documento|video|audio) × 2 senders.
      const type = `midia-${block.mediaKind}-${sender}` as FluxoNodeType;
      allNodes.push({
        id,
        type,
        position: { x: ctx.bx, y: ctx.y },
        data: {
          code: nextCode(ctx),
          sender,
          mediaKind: block.mediaKind,
          caption: block.caption,
          time: '9.41 AM',
        },
      });
      connectFromLast(ctx, allEdges, id);
      ctx.lastFlowId = id;
      ctx.y += 240;
      break;
    }

    case 'direcionamento': {
      const id = uid('dir');
      const dirW = 230;
      allNodes.push({
        id,
        type: 'direcionamento',
        position: { x: ctx.framePos.x + (ctx.frameW - dirW) / 2, y: ctx.y },
        data: {
          label: block.label,
          targetFrameId: '',
          clickable: false,
        },
      });
      connectFromLast(ctx, allEdges, id);
      if (block.targetHint) {
        pendingDirecionamentos.push({ nodeId: id, hint: block.targetHint });
      }
      ctx.y += 70;
      break;
    }

    case 'condicional': {
      const id = uid('cond');
      const condW = 280;
      allNodes.push({
        id,
        type: 'condicional',
        position: { x: ctx.framePos.x + (ctx.frameW - condW) / 2, y: ctx.y },
        data: {
          code: nextCode(ctx),
          condition: block.condition,
          trueLabel: 'Sim',
          falseLabel: 'Não',
        },
      });
      connectFromLast(ctx, allEdges, id);
      ctx.lastFlowId = id;
      ctx.y += 120;
      // Branches inline (raro) — vira nota nos comentários do node
      // pra revisão manual; não auto-criamos children porque o user
      // precisa pintar com cuidado.
      void block.thenText;
      void block.elseText;
      break;
    }

    case 'link': {
      const id = uid('link');
      allNodes.push({
        id,
        type: 'link',
        position: { x: ctx.bx, y: ctx.y },
        data: {
          code: nextCode(ctx),
          linkTitle: block.title ?? 'Link externo',
          url: block.url,
          description: '',
        },
      });
      connectFromLast(ctx, allEdges, id);
      ctx.lastFlowId = id;
      ctx.y += 100;
      break;
    }

    case 'iag': {
      const id = uid('iag');
      const type: FluxoNodeType =
        block.direction === 'entrada' ? 'iag-entrada' : 'iag-saida';
      allNodes.push({
        id,
        type,
        position: { x: ctx.bx, y: ctx.y },
        data: {
          code: nextCode(ctx),
          title:
            block.direction === 'entrada' ? 'IA — entrada' : 'IA — resposta',
          prompt: block.prompt,
        },
      });
      connectFromLast(ctx, allEdges, id);
      ctx.lastFlowId = id;
      ctx.y += 140;
      break;
    }

    case 'integracao-api': {
      const id = uid('api');
      allNodes.push({
        id,
        type: 'integracao-api',
        position: { x: ctx.bx, y: ctx.y },
        data: {
          code: nextCode(ctx),
          title: block.title,
          description: '',
          method: block.method ?? 'GET',
          url: block.url ?? '',
        },
      });
      connectFromLast(ctx, allEdges, id);
      ctx.lastFlowId = id;
      ctx.y += 140;
      break;
    }

    case 'atendimento-humano': {
      const id = uid('hum');
      allNodes.push({
        id,
        type: 'atendimento-humano',
        position: { x: ctx.bx, y: ctx.y },
        data: { code: nextCode(ctx), label: block.label },
      });
      connectFromLast(ctx, allEdges, id);
      ctx.lastFlowId = id;
      ctx.y += 100;
      break;
    }

    case 'note':
      // Notes não viram nodes — coletam variáveis pra trackings
      for (const v of extractVariables(block.text)) ctx.scopeVars.add(v.name);
      break;
  }
}

/**
 * Heurística pra nomear o tracking de input. Olha primeiro a PERGUNTA do bot:
 *  - "Qual seu nome?" → "nome"
 *  - "Por favor, informe o CPF" → "cpf"
 *  - Senão, cai no extractTrackingName padrão.
 */
function inferInputName(prevText: string, _userText: string): string {
  const ENTITIES = [
    'nome',
    'cpf',
    'cnpj',
    'email',
    'e-mail',
    'telefone',
    'celular',
    'endereço',
    'endereco',
    'cep',
    'rg',
    'cidade',
    'estado',
    'idade',
    'empresa',
    'cargo',
  ];
  const low = prevText.toLowerCase();
  for (const e of ENTITIES) {
    if (low.includes(e)) return e.replace('-', '');
  }
  return extractTrackingName(prevText);
}
