/**
 * Builder determinístico: AIParseResult → ProjectState.
 *
 * A IA produz uma estrutura semântica de alto nível (frames com blocos).
 * Esse arquivo TRADUZ essa estrutura em nodes/edges concretos do React Flow,
 * aplicando:
 *  - Layout em grid (FW × FH com gaps)
 *  - IDs estáveis (uid)
 *  - Códigos por frame (S001, S002, OF001, ...)
 *  - Trackings automáticos (bubble-bot → 1 tracking, menu → 3, user → tracking_input no anterior)
 *  - Exceções automáticas (bubble-user → exceção child)
 *  - Edges sequenciais animados
 *  - Direcionamentos com targetFrameId clicável
 *
 * Pure function — sem side-effects, sem rede, sem DB. Testável isoladamente.
 */
import type { Edge } from '@xyflow/react';
import type { FluxoNode, ProjectState, FluxoNodeType } from '@/lib/types';
import {
  extractTrackingName,
  EXCECAO_REL_X,
  EXCECAO_REL_Y,
  EXCECAO_GAP_X,
  EXCECAO_APPROX_WIDTH,
} from '@/lib/components/nodes/helpers';
import type { AIBlock, AIFrame, AIParseResult } from './ai-schema';

// =============================================================================
// CONSTANTES DE LAYOUT
// =============================================================================
//
// Valores CALIBRADOS a partir do output ideal do usuário (snapshot de 2026-05).
// Frames default são MAIS ESTREITOS (656px) e bubbles ficam MAIS PRÓXIMAS
// verticalmente (deltas ~60px em vez dos antigos 160px).
//
// Frames que têm `buttons` (2-3 botões side-by-side) usam largura maior (800px)
// porque o usuário coloca mídias paralelas embaixo dos botões nesses casos.
//
// Altura do frame é calculada DINAMICAMENTE depois de processar todos os
// blocos (`computeFrameHeight()`) — não mais fixa.

const FW_NARROW = 656; // frame default (fluxo linear: bot, menu, mídia, dir)
const FW_WIDE = 800; // frame com buttons row ou conteúdo paralelo
const FH_BASE = 300; // altura mínima do frame (overrided por compute dinâmico)
const COL_GAP = 100;
const ROW_GAP = 200;
const COLS = 4;

// Paddings internos do frame
const FRAME_PADDING_TOP = 50;
const FRAME_PADDING_BOTTOM = 50;

// X dos blocos relativos ao frame
const BOT_COL_X = 280; // bot bubble offset da esquerda do frame
// User fica a ESQUERDA do que ficaria sem exceção, pra que a DUPLA
// [bubble-user][gap][exceção] termine alinhada com a borda direita do frame.
// Reserva = EXCECAO_APPROX_WIDTH + EXCECAO_GAP_X. O `organize` recalcula com
// largura medida depois — esse valor inicial é só pra render pré-organize.
const USER_OFFSET_FROM_RIGHT = 300 + EXCECAO_APPROX_WIDTH + EXCECAO_GAP_X;
const TRACKING_OFFSET_X = -256; // tracking fica à esquerda do parent (relativo)

// Alturas que cada bloco ADICIONA ao cursor Y (não é a altura visual real do
// componente, é o quanto avança até o PRÓXIMO bloco — observado nos dados).
const BOT_BUBBLE_H = 65; // bot → próximo: ~60-70px
const USER_BUBBLE_H = 55; // user → próximo: ~52-58px
const MENU_BASE_H = 80; // menu base
const MENU_OPT_H = 50; // cada opção do menu adiciona 50px
const BUTTONS_ROW_H = 100; // bot → buttons → próximo: ~95-105px
const BTN_LONG_H = 60;
const MEDIA_H = 180; // mídia → próximo: 178-194px
const DIR_H = 70; // direcionamento final (solo, ~centro)
const DIR_H_GRID = 47; // direcionamento em grid pós-menu (compacto)
const LINK_H = 110; // link card é mais alto que bubble simples
const CONDICIONAL_H = 90; // varal horizontal: ~60px de altura + gap
const ATENDIMENTO_HUMANO_H = 56; // pílula compacta: ~36px + gap
const INTEGRACAO_H = 150;
const IAG_H = 150;

// Grid de direcionamentos pós-menu
const DIR_W = 145; // largura efetiva pra cálculo de quantos cabem por row
const DIR_GAP_X = 12;
const DIR_GAP_Y = 8;
const DIR_GRID_MARGIN = 20;

// =============================================================================
// UID
// =============================================================================
let _counter = 0;
function uid(prefix: string): string {
  _counter += 1;
  return `${prefix}-${_counter.toString(36)}`;
}

// =============================================================================
// CONTEXTO DE BUILD (1 por frame)
// =============================================================================
interface BuildContext {
  nodes: FluxoNode[];
  edges: Edge[];
  prefix: string;
  seq: number;
  lastFlowId: string | null;
  framePos: { x: number; y: number };
  frameW: number; // largura do frame (656 ou 800)
  bx: number; // X base pra bot bubbles (= framePos.x + BOT_COL_X)
  y: number; // cursor Y atual
}

function nextCode(ctx: BuildContext): string {
  return `${ctx.prefix}${String(ctx.seq++).padStart(3, '0')}`;
}

// =============================================================================
// HELPERS PRA CADA TIPO DE BLOCO
// =============================================================================

function emitBot(ctx: BuildContext, text: string, connectFromLast = true): string {
  const id = uid('bot');
  ctx.nodes.push({
    id,
    type: 'bubble-bot',
    position: { x: ctx.bx, y: ctx.y },
    data: { code: nextCode(ctx), text, time: '9.41 AM' },
  });
  // Tracking auto: _exibicao
  ctx.nodes.push({
    id: uid('trk'),
    type: 'tracking',
    parentId: id,
    position: { x: TRACKING_OFFSET_X, y: 0 },
    data: { label: `${extractTrackingName(text)} exibicao` },
  });
  if (connectFromLast && ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  ctx.lastFlowId = id;
  ctx.y += BOT_BUBBLE_H;
  return id;
}

function emitUser(ctx: BuildContext, text: string): string {
  const id = uid('user');
  // User bubble: posicionado relativo à DIREITA do frame (não relativo ao bot),
  // espelhando o alinhamento direito do WhatsApp.
  const userX = ctx.framePos.x + ctx.frameW - USER_OFFSET_FROM_RIGHT;
  // Bubble user NÃO recebe `code` — é resposta/input, não unidade emissora.
  ctx.nodes.push({
    id,
    type: 'bubble-user',
    position: { x: userX, y: ctx.y },
    data: { text, time: '9.41 AM' },
  });
  // Tracking_input no anterior (se for bot ou menu)
  const prev = ctx.lastFlowId ? ctx.nodes.find((n) => n.id === ctx.lastFlowId) : null;
  if (prev && (prev.type === 'bubble-bot' || prev.type === 'menu')) {
    const prevText =
      (prev.data?.text as string | undefined) ??
      (prev.data?.header as string | undefined) ??
      '';
    const existingChildren = ctx.nodes.filter(
      (n) => n.type === 'tracking' && n.parentId === prev.id
    );
    ctx.nodes.push({
      id: uid('trk'),
      type: 'tracking',
      parentId: prev.id,
      position: { x: TRACKING_OFFSET_X, y: existingChildren.length * 52 },
      data: { label: `${extractTrackingName(prevText)} input` },
    });
  }
  // Exceção como child do user (à DIREITA, mesmo Y — dupla horizontal)
  ctx.nodes.push({
    id: uid('exc'),
    type: 'excecao',
    parentId: id,
    position: { x: EXCECAO_REL_X, y: EXCECAO_REL_Y },
    data: { label: 'Exceção / Fallback' },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  ctx.lastFlowId = id;
  ctx.y += USER_BUBBLE_H;
  return id;
}

function emitMenu(
  ctx: BuildContext,
  header: string,
  options: string[],
  footer = 'Enviar'
): string {
  const id = uid('menu');
  ctx.nodes.push({
    id,
    type: 'menu',
    position: { x: ctx.bx, y: ctx.y },
    data: { code: nextCode(ctx), header, options, footer },
  });
  const name = extractTrackingName(header);
  ['exibicao', 'selecao', 'inesperado'].forEach((kind, idx) => {
    ctx.nodes.push({
      id: uid('trk'),
      type: 'tracking',
      parentId: id,
      position: { x: TRACKING_OFFSET_X, y: idx * 52 },
      data: { label: `${name} ${kind}` },
    });
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  ctx.lastFlowId = id;
  ctx.y += MENU_BASE_H + options.length * MENU_OPT_H;
  return id;
}

function emitButtonsRow(
  ctx: BuildContext,
  options: string[],
  sourceId: string | null
): string[] {
  const BTN_W = 130;
  const GAP_X = 12;
  const totalW = options.length * BTN_W + (options.length - 1) * GAP_X;
  const startX = ctx.framePos.x + (ctx.frameW - totalW) / 2;

  // Tracking_selecao no source (bot/menu) se houver
  if (sourceId) {
    const src = ctx.nodes.find((n) => n.id === sourceId);
    if (src && (src.type === 'bubble-bot' || src.type === 'menu')) {
      const srcText =
        (src.data?.text as string | undefined) ??
        (src.data?.header as string | undefined) ??
        '';
      const existing = ctx.nodes.filter(
        (n) => n.type === 'tracking' && n.parentId === sourceId
      );
      ctx.nodes.push({
        id: uid('trk'),
        type: 'tracking',
        parentId: sourceId,
        position: { x: TRACKING_OFFSET_X, y: existing.length * 52 },
        data: { label: `${extractTrackingName(srcText)} selecao` },
      });
    }
  }

  const ids: string[] = [];
  options.forEach((label, idx) => {
    const id = uid('btn');
    const x = startX + idx * (BTN_W + GAP_X);
    // Botões NÃO recebem `code` — são ações do bloco anterior, não unidades.
    ctx.nodes.push({
      id,
      type: 'btn-short',
      position: { x, y: ctx.y },
      data: { label },
    });
    if (sourceId) {
      ctx.edges.push({
        id: uid('e'),
        source: sourceId,
        target: id,
        animated: true,
      });
    }
    ids.push(id);
  });

  // Buttons NÃO atualizam lastFlowId (branches paralelos)
  ctx.y += BUTTONS_ROW_H;
  return ids;
}

function emitBtnLong(ctx: BuildContext, label: string): string {
  const id = uid('btn');
  // Botão longo NÃO recebe `code` — é ação/CTA, não unidade.
  ctx.nodes.push({
    id,
    type: 'btn-long',
    position: { x: ctx.bx, y: ctx.y },
    data: { label },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  ctx.lastFlowId = id;
  ctx.y += BTN_LONG_H;
  return id;
}

function emitMedia(
  ctx: BuildContext,
  mediaKind: 'imagem' | 'documento' | 'video',
  sender: 'bot' | 'user',
  caption: string
): string {
  const id = uid('midia');
  const type = `midia-${mediaKind}-${sender}` as FluxoNodeType;
  // Mídias NÃO recebem `code` — são conteúdo da bubble do sender, não unidade.
  ctx.nodes.push({
    id,
    type,
    position: { x: ctx.bx, y: ctx.y },
    data: {
      sender,
      mediaKind,
      caption,
      time: '9.41 AM',
    },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  ctx.lastFlowId = id;
  ctx.y += MEDIA_H;
  return id;
}

function emitLink(
  ctx: BuildContext,
  url: string,
  linkTitle: string,
  linkDescription: string | undefined,
  sender: 'bot' | 'user'
): string {
  const id = uid('link');
  // Link NÃO recebe code — segue padrão das mídias (conteúdo do sender).
  ctx.nodes.push({
    id,
    type: 'link',
    position: { x: ctx.bx, y: ctx.y },
    data: {
      sender,
      url,
      linkTitle,
      linkDescription,
    },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  ctx.lastFlowId = id;
  ctx.y += LINK_H;
  return id;
}

function emitAtendimentoHumano(ctx: BuildContext, label: string): string {
  const id = uid('hum');
  // Pílula compacta laranja — centralizada no frame, sem code.
  // Terminal do fluxo automatizado.
  const padW = 200;
  ctx.nodes.push({
    id,
    type: 'atendimento-humano',
    position: {
      x: ctx.framePos.x + (ctx.frameW - padW) / 2,
      y: ctx.y,
    },
    data: { label },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  ctx.lastFlowId = id;
  ctx.y += ATENDIMENTO_HUMANO_H;
  return id;
}

function emitCondicional(
  ctx: BuildContext,
  condition: string,
  trueLabel: string,
  falseLabel: string,
  options: { connectFromLast?: boolean } = {}
): string {
  const id = uid('cond');
  const condW = 320; // largura default do varal (resizable pelo usuário)
  const condH = 44;
  // Condicional RECEBE code — é unidade endereçável (referenciada pelas
  // mensagens-de-corte da cascata, ex: FA001/FA003/FA005/FA007).
  // Centralizado horizontalmente no frame.
  ctx.nodes.push({
    id,
    type: 'condicional',
    position: {
      x: ctx.framePos.x + (ctx.frameW - condW) / 2,
      y: ctx.y,
    },
    data: {
      code: nextCode(ctx),
      condition,
      trueLabel,
      falseLabel,
      width: condW,
      height: condH,
    },
  });
  // Por padrão NÃO cria edge de entrada — o caller (cascata ou case do
  // emitBlock) controla a conexão pra poder usar sourceHandle quando
  // vier de outro condicional (saída FALSE).
  if (options.connectFromLast && ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  // Condicional NÃO atualiza lastFlowId — tem 2 saídas distintas, a cascata
  // decide qual conectar
  ctx.y += CONDICIONAL_H;
  return id;
}

function emitDirecionamento(
  ctx: BuildContext,
  label: string,
  targetFrameId: string | undefined
): string {
  const id = uid('dir');
  const dirW = 230;
  // Direcionamento TEM código — é unidade endereçável (alvo de outros saltos).
  ctx.nodes.push({
    id,
    type: 'direcionamento',
    position: {
      x: ctx.framePos.x + (ctx.frameW - dirW) / 2,
      y: ctx.y,
    },
    data: {
      code: nextCode(ctx),
      label,
      targetFrameId: targetFrameId ?? '',
      clickable: !!targetFrameId,
    },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  // Direcionamento normalmente é "folha" — NÃO atualiza lastFlowId, porque
  // múltiplos direcionamentos em sequência (saída de menu) são paralelos.
  ctx.y += DIR_H;
  return id;
}

/**
 * Distribui N direcionamentos em GRID horizontal compacto.
 *
 * Padrão observado no output do usuário: após um menu com N opções, ele
 * coloca as N direcionamentos em grid de 4 por linha, com espaçamento
 * compacto (~50px entre rows, ~12px entre cols). Em frame de 776px de
 * largura, com DIR_W=145 → 4 direcionamentos cabem por linha.
 *
 * Diferente do `emitDirecionamento` solo (centralizado, ocupa 70px Y),
 * o grid usa DIR_H_GRID (47px) por linha, MUITO mais denso.
 */
function emitDirecionamentoGrid(ctx: BuildContext, group: AIBlock[]): void {
  const innerW = ctx.frameW - 2 * DIR_GRID_MARGIN;
  const perRow = Math.max(1, Math.floor((innerW + DIR_GAP_X) / (DIR_W + DIR_GAP_X)));
  const cols = Math.min(perRow, group.length);
  const totalW = cols * DIR_W + (cols - 1) * DIR_GAP_X;
  const startX = ctx.framePos.x + (ctx.frameW - totalW) / 2;
  const startY = ctx.y;

  let lastRow = 0;
  group.forEach((block, idx) => {
    const col = idx % perRow;
    const row = Math.floor(idx / perRow);
    lastRow = row;

    const label = block.label?.trim();
    if (!label) {
      console.warn('[ai-builder] direcionamento sem label no grid');
      return;
    }

    const id = uid('dir');
    ctx.nodes.push({
      id,
      type: 'direcionamento',
      position: {
        x: startX + col * (DIR_W + DIR_GAP_X),
        y: startY + row * (DIR_H_GRID + DIR_GAP_Y),
      },
      data: {
        code: nextCode(ctx),
        label,
        targetFrameId: block.target_frame_id?.trim() ?? '',
        clickable: !!block.target_frame_id,
      },
    });
    // Conecta do lastFlowId (geralmente o menu) — TODOS os direcionamentos
    // do grid recebem edge do mesmo source (ramificação paralela)
    if (ctx.lastFlowId) {
      ctx.edges.push({
        id: uid('e'),
        source: ctx.lastFlowId,
        target: id,
        animated: true,
      });
    }
  });

  // Atualiza Y pra próxima linha logo abaixo do grid
  ctx.y = startY + (lastRow + 1) * (DIR_H_GRID + DIR_GAP_Y);
}

function emitIntegracao(
  ctx: BuildContext,
  type: 'api' | 'planilha',
  title: string,
  fields: Array<{ label: string; key: string; value: string }>
): string {
  const id = uid('intg');
  const ntype = `integracao-${type}` as FluxoNodeType;
  ctx.nodes.push({
    id,
    type: ntype,
    position: { x: ctx.bx, y: ctx.y },
    data: {
      code: nextCode(ctx),
      title,
      fields,
      headerColor: type === 'api' ? '#3B82F6' : '#10B981',
      headerIcon: type === 'api' ? '🔌' : '📊',
    },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  ctx.lastFlowId = id;
  ctx.y += INTEGRACAO_H;
  return id;
}

function emitIag(
  ctx: BuildContext,
  type: 'entrada' | 'reentrada' | 'saida',
  title: string,
  fields: Array<{ label: string; key: string; value: string }>
): string {
  const id = uid('iag');
  const ntype = `iag-${type}` as FluxoNodeType;
  ctx.nodes.push({
    id,
    type: ntype,
    position: { x: ctx.bx, y: ctx.y },
    data: {
      code: nextCode(ctx),
      title,
      fields,
      headerColor: '#8B5CF6',
      headerIcon: '🤖',
    },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  ctx.lastFlowId = id;
  ctx.y += IAG_H;
  return id;
}

// =============================================================================
// BUILDER PRINCIPAL
// =============================================================================

/**
 * Constrói um ProjectState a partir do resultado da IA.
 *
 * IDs internos do React Flow são gerados aqui (uid). As referências entre
 * frames via `target_frame_id` (slug humano) ficam preservadas em
 * `data.targetFrameId` — o sistema de navegação clicável já sabe resolver
 * isso (busca o frame pelo `data.frameId`).
 */
export function buildStateFromAIResult(result: AIParseResult): ProjectState {
  _counter = 0;
  const allNodes: FluxoNode[] = [];
  const allEdges: Edge[] = [];

  // Resolve colisões de prefix ANTES de processar os frames.
  // Ex: "Onboarding" e "Ofertas" ambos vindos como "O" — primeiro mantém "O",
  // segundo vira "OF" (2ª letra consonantal do título).
  const dedupedFrames = dedupeFramePrefixes(result.frames);

  // Pré-processamento: pra cada frame, decide largura (656 ou 800) baseado
  // em se há `buttons` ou conteúdo paralelo. Calcula tudo antes pra ter o
  // grid layout correto considerando alturas variáveis.
  const frameLayouts = dedupedFrames.map((aiFrame, idx) => {
    const hasParallel = aiFrame.blocks.some(
      (b) =>
        b.kind === 'buttons' ||
        // Mídias consecutivas (duas em sequência) viram paralelas no layout
        false
    );
    const width = hasParallel ? FW_WIDE : FW_NARROW;
    return { aiFrame, idx, width };
  });

  // Grid positions: 4 colunas, com gap entre rows considerando altura máx
  // estimada. ROW_HEIGHT_RESERVE = "altura máxima esperada" pra cada linha.
  //
  // 1500px cobre o caso pior (frame com 5+ bots + menu + 9 direcionamentos),
  // garantindo que a próxima linha não sobreponha. Frames menores deixam
  // espaço em branco abaixo — usuário re-arranja se quiser.
  const ROW_HEIGHT_RESERVE = 1500;

  frameLayouts.forEach(({ aiFrame, idx, width }) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const framePos = {
      x: col * (FW_WIDE + COL_GAP),
      y: row * (ROW_HEIGHT_RESERVE + ROW_GAP),
    };

    // Cria o frame com altura PROVISÓRIA — será ajustada no final
    // (depois de processar os blocos).
    const frameNodeId = uid('frame');
    const frameNode: FluxoNode = {
      id: frameNodeId,
      type: 'frame',
      position: framePos,
      zIndex: 0,
      data: {
        title: aiFrame.title,
        prefix: aiFrame.prefix,
        frameId: aiFrame.frame_id,
        code: aiFrame.prefix,
        width,
        height: FH_BASE, // placeholder
      },
    };
    allNodes.push(frameNode);

    // Contexto de build pra esse frame
    const ctx: BuildContext = {
      nodes: [],
      edges: [],
      prefix: aiFrame.prefix,
      seq: 1,
      lastFlowId: null,
      framePos,
      frameW: width,
      bx: framePos.x + BOT_COL_X,
      y: framePos.y + FRAME_PADDING_TOP,
    };

    // Walk blocks com agrupamento de direcionamentos consecutivos em grid.
    // Padrão observado: após um menu, vêm N direcionamentos (1 por opção).
    // Se 2+, distribuímos em grid horizontal compacto (4 por row) — economiza
    // muito espaço vertical em frames como "Saudação" (9 direcionamentos).
    let i = 0;
    while (i < aiFrame.blocks.length) {
      const block = aiFrame.blocks[i];

      if (block.kind === 'direcionamento') {
        // Acumula direcionamentos consecutivos
        const group: AIBlock[] = [];
        while (
          i < aiFrame.blocks.length &&
          aiFrame.blocks[i].kind === 'direcionamento'
        ) {
          group.push(aiFrame.blocks[i]);
          i++;
        }

        try {
          if (group.length === 1) {
            emitBlock(ctx, group[0]);
          } else {
            emitDirecionamentoGrid(ctx, group);
          }
        } catch (err) {
          console.warn(
            `[ai-builder] Falha emitindo grupo de direcionamentos em "${aiFrame.title}":`,
            err
          );
        }
        continue;
      }

      // Heurística cascata: ao encontrar um `condicional`, processa toda
      // a cadeia de cond→mensagem-de-corte→cond→...→atendimento-humano
      // criando edges com sourceHandle='true'/'false' apropriadamente.
      if (block.kind === 'condicional') {
        try {
          const consumed = processCondicionalCascade(
            ctx,
            aiFrame.blocks,
            i
          );
          i += Math.max(1, consumed); // protege contra loop infinito
        } catch (err) {
          console.warn(
            `[ai-builder] Falha emitindo cascata em "${aiFrame.title}":`,
            err
          );
          i++;
        }
        continue;
      }

      try {
        emitBlock(ctx, block);
      } catch (err) {
        console.warn(
          `[ai-builder] Bloco ignorado em frame "${aiFrame.title}":`,
          block,
          err
        );
      }
      i++;
    }

    // CALCULA ALTURA REAL DO FRAME baseado em quanto Y avançou
    const contentHeight = ctx.y - framePos.y; // altura usada pelos blocos
    const finalHeight = Math.max(
      FH_BASE,
      contentHeight + FRAME_PADDING_BOTTOM
    );
    frameNode.data!.height = finalHeight;

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  });

  return {
    nodes: allNodes,
    edges: allEdges,
    viewport: { x: 0, y: 0, zoom: 0.3 },
  };
}

/**
 * Resolve colisões de prefix entre frames.
 *
 * Estratégia: percorre os frames em ORDEM (primeiro a aparecer "ganha"
 * o prefix original). Os subsequentes que colidirem recebem alternativa:
 *
 * 1. Tenta primeira letra + cada consoante do título (ex: "Ofertas" → "OF",
 *    "Onibus" → "ON", "Onibus2" → "OB" pulando o "N" já usado).
 * 2. Se ainda colidir, tenta primeira letra + número (O2, O3...).
 * 3. Em último caso, força "X1", "X2", etc.
 *
 * Garante unicidade do prefix dentro do documento, mantendo legibilidade.
 */
function dedupeFramePrefixes(frames: AIFrame[]): AIFrame[] {
  const used = new Set<string>();

  return frames.map((frame) => {
    const original = (frame.prefix || '').toUpperCase().trim() || 'X';

    if (!used.has(original)) {
      used.add(original);
      return frame;
    }

    // Tenta gerar alternativa baseada no título
    const initial = original[0] || 'X';
    const title = (frame.title || '').toUpperCase();
    // Consoantes restantes do título (remove vogais, espaços e a primeira letra)
    const consonants = title
      .slice(1)
      .replace(/[AEIOUÁÀÂÃÉÊÍÓÔÕÚÇ\s\-_]/g, '')
      .split('')
      .filter((c) => /[A-Z0-9]/.test(c));

    let newPrefix: string | null = null;

    // Tenta 2 letras: initial + cada consoante
    for (const c of consonants) {
      const candidate = `${initial}${c}`;
      if (!used.has(candidate)) {
        newPrefix = candidate;
        break;
      }
    }

    // Se ainda nenhuma deu, tenta initial + número
    if (!newPrefix) {
      for (let n = 2; n <= 9; n++) {
        const candidate = `${initial}${n}`;
        if (!used.has(candidate)) {
          newPrefix = candidate;
          break;
        }
      }
    }

    // Último recurso: X + número
    if (!newPrefix) {
      let n = 1;
      while (used.has(`X${n}`)) n++;
      newPrefix = `X${n}`;
    }

    used.add(newPrefix);
    console.log(
      `[ai-builder] Colisão de prefix: "${frame.title}" tinha "${original}" (já usado) → "${newPrefix}"`
    );
    return { ...frame, prefix: newPrefix };
  });
}

/**
 * Processa uma sequência de condicionais formando uma CASCATA — padrão
 * típico do frame "Falar com atendente" (FA):
 *
 *   cond1 (É feriado?)
 *     TRUE  → bot "mensagem de feriado" (lateral, terminal)
 *     FALSE → cond2 (É fim de semana?)
 *               TRUE  → bot "mensagem de fds"
 *               FALSE → cond3 (Fora do horário?)
 *                         TRUE  → bot "mensagem de horário"
 *                         FALSE → cond4 (Atendente disponível?)
 *                                   FALSE → bot "aguarde"
 *                                   TRUE  → atendimento-humano
 *
 * Heurística: cada condicional é seguido por UM bloco "mensagem-de-corte"
 * (qualquer kind exceto `condicional`/`atendimento-humano`). Esse bloco vira
 * a saída TRUE da cond, com `sourceHandle='true'`. A próxima cond da
 * sequência é a saída FALSE da cond atual, com `sourceHandle='false'`.
 *
 * Caso especial — última cond: se o bloco seguinte for `atendimento-humano`
 * (transbordo efetivo), ele é conectado como saída TRUE; a mensagem
 * "aguarde" que apareceu como mensagem-de-corte representa o FALSE
 * (= sem atendente).
 *
 * Retorna quantos blocos foram consumidos a partir de `startIdx`.
 */
function processCondicionalCascade(
  ctx: BuildContext,
  blocks: AIBlock[],
  startIdx: number
): number {
  const entryLastFlowId = ctx.lastFlowId;
  let i = startIdx;
  let prevCondId: string | null = null;
  let consumed = 0;

  const isCondOrAtend = (kind: AIBlock['kind']): boolean =>
    kind === 'condicional' || kind === 'atendimento-humano';

  while (i < blocks.length && blocks[i].kind === 'condicional') {
    const block = blocks[i];
    const condition = block.condition?.trim();
    if (!condition) {
      console.warn('[ai-builder] condicional sem condition');
      i++;
      consumed++;
      continue;
    }

    const condId = emitCondicional(
      ctx,
      condition,
      block.true_label?.trim() || 'Verdadeiro',
      block.false_label?.trim() || 'Falso'
    );

    // Edge de entrada na cond:
    //   - primeira: do predecessor da cascata, sem sourceHandle especial
    //   - subsequentes: do prevCond, com sourceHandle='false' (cadeia FALSE)
    if (prevCondId) {
      ctx.edges.push({
        id: uid('e'),
        source: prevCondId,
        target: condId,
        sourceHandle: 'false',
        animated: true,
      });
    } else if (entryLastFlowId) {
      ctx.edges.push({
        id: uid('e'),
        source: entryLastFlowId,
        target: condId,
        animated: true,
      });
    }

    i++;
    consumed++;

    // Próximo bloco: se for mensagem-de-corte (= não-cond, não-atend),
    // emite e liga à cond com sourceHandle TRUE ou FALSE conforme o
    // contexto da cascata.
    if (i < blocks.length && !isCondOrAtend(blocks[i].kind)) {
      // Inversão da ÚLTIMA cond: numa cascata cuja última cond é seguida
      // de `atendimento-humano` (ex: "Atendente disponível?"), o sentido
      // da exceção inverte — a mensagem-de-corte aqui representa a saída
      // FALSE (ex: "sem atendente → aguarde"), e o transbordo o TRUE.
      // Detectamos pelo bloco que vem DEPOIS da mensagem-de-corte: se
      // for `atendimento-humano`, esta é a última cond.
      const afterCutoff = i + 1 < blocks.length ? blocks[i + 1] : null;
      const isLastCond = afterCutoff?.kind === 'atendimento-humano';
      const cutoffHandle: 'true' | 'false' = isLastCond ? 'false' : 'true';

      const savedLast = ctx.lastFlowId;
      ctx.lastFlowId = null; // desliga auto-edge do emit*
      const cutoffId = emitBlock(ctx, blocks[i]);
      ctx.lastFlowId = savedLast;
      if (cutoffId) {
        ctx.edges.push({
          id: uid('e'),
          source: condId,
          target: cutoffId,
          sourceHandle: cutoffHandle,
          animated: true,
        });
      }
      i++;
      consumed++;
    }

    prevCondId = condId;
  }

  // Próximo bloco depois da última cond: se for atendimento-humano,
  // representa o transbordo efetivo (TRUE da última cond). A mensagem
  // "aguarde" que veio antes (como mensagem-de-corte da última cond) é
  // o FALSE.
  if (
    prevCondId &&
    i < blocks.length &&
    blocks[i].kind === 'atendimento-humano'
  ) {
    const savedLast = ctx.lastFlowId;
    ctx.lastFlowId = null;
    const atendId = emitBlock(ctx, blocks[i]);
    ctx.lastFlowId = savedLast;
    if (atendId) {
      ctx.edges.push({
        id: uid('e'),
        source: prevCondId,
        target: atendId,
        sourceHandle: 'true',
        animated: true,
      });
      // O atendimento-humano pode ter blocos depois (raro, mas pode);
      // se houver, conectarão a partir dele.
      ctx.lastFlowId = atendId;
    }
    i++;
    consumed++;
  } else if (prevCondId) {
    // Cascata termina sem transbordo: lastFlowId fica na última cond
    // (saída FALSE em aberto pra blocos seguintes encadeados).
    ctx.lastFlowId = prevCondId;
  }

  return consumed;
}

function emitBlock(ctx: BuildContext, block: AIBlock): string | undefined {
  switch (block.kind) {
    case 'bot': {
      const text = block.text?.trim();
      if (!text) {
        console.warn('[ai-builder] bloco bot sem text');
        return undefined;
      }
      return emitBot(ctx, text);
    }
    case 'user': {
      const text = block.text?.trim() || '{resposta do usuário}';
      return emitUser(ctx, text);
    }
    case 'menu': {
      const header = block.header?.trim() || 'Selecione uma opção';
      const options = (block.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (options.length === 0) {
        console.warn('[ai-builder] menu sem options');
        return undefined;
      }
      return emitMenu(ctx, header, options, block.footer?.trim() || 'Enviar');
    }
    case 'buttons': {
      const options = (block.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (options.length === 0) {
        console.warn('[ai-builder] buttons sem options');
        return undefined;
      }
      if (block.question?.trim()) {
        emitBot(ctx, block.question.trim());
      }
      emitButtonsRow(ctx, options, ctx.lastFlowId);
      return undefined; // row de botões: sem id "principal"
    }
    case 'btn-long': {
      const label = block.label?.trim();
      if (!label) {
        console.warn('[ai-builder] btn-long sem label');
        return undefined;
      }
      return emitBtnLong(ctx, label);
    }
    case 'media': {
      const mediaKind = block.media_kind;
      const sender = block.sender ?? 'bot';
      const caption = block.caption?.trim() || '';
      if (!mediaKind) {
        console.warn('[ai-builder] media sem media_kind');
        return undefined;
      }
      return emitMedia(ctx, mediaKind, sender, caption);
    }
    case 'link': {
      const url = block.url?.trim();
      if (!url) {
        console.warn('[ai-builder] link sem url');
        return undefined;
      }
      return emitLink(
        ctx,
        url,
        block.link_title?.trim() || 'Acessar link',
        block.link_description?.trim() || undefined,
        block.sender ?? 'bot'
      );
    }
    case 'direcionamento': {
      const label = block.label?.trim();
      if (!label) {
        console.warn('[ai-builder] direcionamento sem label');
        return undefined;
      }
      return emitDirecionamento(ctx, label, block.target_frame_id?.trim() || undefined);
    }
    case 'condicional': {
      const condition = block.condition?.trim();
      if (!condition) {
        console.warn('[ai-builder] condicional sem condition');
        return undefined;
      }
      // Cond solta (não parte de cascata) — usa connectFromLast=true pra
      // manter a edge de entrada do predecessor.
      return emitCondicional(
        ctx,
        condition,
        block.true_label?.trim() || 'Verdadeiro',
        block.false_label?.trim() || 'Falso',
        { connectFromLast: true }
      );
    }
    case 'atendimento-humano': {
      return emitAtendimentoHumano(
        ctx,
        block.label?.trim() || 'Atendimento humano'
      );
    }
    case 'integracao': {
      const type = block.integracao_type ?? 'api';
      const title = block.title?.trim() || 'Integração';
      const fields = block.fields ?? [];
      return emitIntegracao(ctx, type, title, fields);
    }
    case 'iag': {
      const type = block.iag_type ?? 'entrada';
      const title = block.title?.trim() || 'IA Generativa';
      const fields = block.fields ?? [];
      return emitIag(ctx, type, title, fields);
    }
    default: {
      console.warn(`[ai-builder] kind desconhecido: ${(block as AIBlock).kind}`);
      return undefined;
    }
  }
}
