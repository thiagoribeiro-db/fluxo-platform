/**
 * Template "Varejo (exemplo)" — chatbot genérico de varejo no WhatsApp.
 *
 * Estrutura demonstrativa: Saudação + 9 cenários + Algo Mais (reutilizável)
 * + Encerramento. Pensada pra servir de starter de um novo projeto.
 *
 * Princípios:
 *  - IDs por frame (prefixo + sequencial)
 *  - Trackings children dos bubbles BOT e dos menus
 *  - Exceções children dos USER inputs
 *  - Auto-edges sequenciais entre bubbles/menus
 *  - Cada cenário termina com 1 direcionamento clickable → "Algo Mais"
 *  - "Algo Mais" centraliza a pergunta "Posso te ajudar com algo mais?"
 *    e direciona pra Saudação / Falar com atendente / Encerramento
 *  - Direcionamentos pós-menu são dispostos em GRID HORIZONTAL
 *  - 2-3 opções → btn-short; 4+ → menu
 *
 * Os textos contêm placeholders genéricos ({nome da marca}, {link site}, etc.)
 * pra serem substituídos pelo usuário ao adaptar para um cliente específico.
 *
 * Coordenadas iniciais são aproximadas — auto-organize após apply ajusta tudo.
 */
import type { Edge } from '@xyflow/react';
import type { FluxoNode, ProjectState } from '@/lib/types';
import { extractTrackingName } from '@/lib/components/nodes/helpers';

// --------------------------------------------------------------------------
// Builder helpers
// --------------------------------------------------------------------------
let _counter = 0;
function uid(prefix: string): string {
  _counter += 1;
  return `${prefix}-${_counter.toString(36)}`;
}

interface FrameContext {
  nodes: FluxoNode[];
  edges: Edge[];
  prefix: string;
  seq: number;
  lastFlowId: string | null;
}

function newFrame(opts: {
  title: string;
  prefix: string;
  frameId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}): { frame: FluxoNode; ctx: FrameContext } {
  const frame: FluxoNode = {
    id: uid('frame'),
    type: 'frame',
    position: { x: opts.x, y: opts.y },
    data: {
      title: opts.title,
      frameId: opts.frameId,
      prefix: opts.prefix,
      code: opts.prefix,
      width: opts.width ?? 800,
      height: opts.height ?? 1200,
    },
  };
  return {
    frame,
    ctx: {
      nodes: [frame],
      edges: [],
      prefix: opts.prefix,
      seq: 1,
      lastFlowId: null,
    },
  };
}

function nextCode(ctx: FrameContext): string {
  return `${ctx.prefix}${String(ctx.seq++).padStart(3, '0')}`;
}

function bot(
  ctx: FrameContext,
  text: string,
  pos: { x: number; y: number },
  connectFromLast = true
): string {
  const id = uid('bot');
  const code = nextCode(ctx);
  ctx.nodes.push({
    id,
    type: 'bubble-bot',
    position: pos,
    data: { code, text, time: '9.41 AM' },
  });
  ctx.nodes.push({
    id: uid('trk'),
    type: 'tracking',
    parentId: id,
    position: { x: -256, y: 0 },
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
  return id;
}

function user(ctx: FrameContext, text: string, pos: { x: number; y: number }): string {
  const id = uid('user');
  const code = nextCode(ctx);
  ctx.nodes.push({
    id,
    type: 'bubble-user',
    position: pos,
    data: { code, text, time: '9.41 AM' },
  });
  const prev = ctx.lastFlowId ? ctx.nodes.find((n) => n.id === ctx.lastFlowId) : null;
  if (prev && (prev.type === 'bubble-bot' || prev.type === 'menu')) {
    const prevText =
      (prev.data?.text as string | undefined) ??
      (prev.data?.header as string | undefined) ??
      '';
    const name = extractTrackingName(prevText);
    const existing = ctx.nodes.filter(
      (n) => n.type === 'tracking' && n.parentId === prev.id
    );
    ctx.nodes.push({
      id: uid('trk'),
      type: 'tracking',
      parentId: prev.id,
      position: { x: -256, y: existing.length * 52 },
      data: { label: `${name} input` },
    });
  }
  // Exceção como child do USER, posicionada ABAIXO (não à direita)
  // pra não extrapolar a borda do frame após organize.
  ctx.nodes.push({
    id: uid('exc'),
    type: 'excecao',
    parentId: id,
    position: { x: 0, y: 140 },
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
  return id;
}

function menu(
  ctx: FrameContext,
  header: string,
  options: string[],
  pos: { x: number; y: number },
  footer = 'Enviar'
): string {
  const id = uid('menu');
  const code = nextCode(ctx);
  ctx.nodes.push({
    id,
    type: 'menu',
    position: pos,
    data: { code, header, options, footer },
  });
  const name = extractTrackingName(header);
  ['exibicao', 'selecao', 'inesperado'].forEach((kind, idx) => {
    ctx.nodes.push({
      id: uid('trk'),
      type: 'tracking',
      parentId: id,
      position: { x: -256, y: idx * 52 },
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
  return id;
}

function direcionamento(
  ctx: FrameContext,
  label: string,
  targetFrameId: string,
  pos: { x: number; y: number },
  connectFromLast = true
): string {
  const id = uid('dir');
  ctx.nodes.push({
    id,
    type: 'direcionamento',
    position: pos,
    data: { label, targetFrameId, clickable: true },
  });
  if (connectFromLast && ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  return id;
}

/**
 * Cria um condicional (decisão if/else, 2 saídas TRUE/FALSE).
 * Por padrão conecta auto a partir do último node — útil pra cascata.
 */
function condicional(
  ctx: FrameContext,
  condition: string,
  pos: { x: number; y: number },
  trueLabel = 'Sim',
  falseLabel = 'Não',
  connectFromLast = true
): string {
  const id = uid('cond');
  const code = nextCode(ctx);
  ctx.nodes.push({
    id,
    type: 'condicional',
    position: pos,
    data: { code, condition, trueLabel, falseLabel },
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
  return id;
}

/**
 * Cria um atendimento-humano (transbordo terminal — caixa laranja).
 * Geralmente só usado no fim do frame "Falar com atendente" depois das
 * validações; cenários normais devem direcionar pra "atendente" em vez
 * de usar esse componente.
 */
function atendimentoHumano(
  ctx: FrameContext,
  pos: { x: number; y: number },
  connectFromLast = true,
  label = 'Início do atendimento humanizado'
): string {
  const id = uid('hum');
  ctx.nodes.push({
    id,
    type: 'atendimento-humano',
    position: pos,
    data: { label },
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
  return id;
}

/**
 * Cria um botão curto (btn-short) — usado pra 2-3 opções.
 * Não emite auto-edge (a edge vem do menu/bot anterior se quiser).
 */
function btnShort(
  ctx: FrameContext,
  label: string,
  pos: { x: number; y: number },
  connectFromLast = false
): string {
  const id = uid('btn');
  const code = nextCode(ctx);
  ctx.nodes.push({
    id,
    type: 'btn-short',
    position: pos,
    data: { code, label },
  });
  if (connectFromLast && ctx.lastFlowId) {
    ctx.edges.push({
      id: uid('e'),
      source: ctx.lastFlowId,
      target: id,
      animated: true,
    });
  }
  return id;
}

/**
 * Cria um botão longo (btn-long) — usado quando há 1 única opção.
 */
function btnLong(
  ctx: FrameContext,
  label: string,
  pos: { x: number; y: number },
  connectFromLast = true
): string {
  const id = uid('btn');
  const code = nextCode(ctx);
  ctx.nodes.push({
    id,
    type: 'btn-long',
    position: pos,
    data: { code, label },
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
  return id;
}

/**
 * Cria N botões curtos lado a lado (linha horizontal centrada).
 * Cada botão recebe edge a partir do `sourceId` (geralmente o bubble anterior
 * que faz a pergunta). Retorna os IDs criados.
 *
 * Não atualiza ctx.lastFlowId (porque agora há N branches paralelos).
 */
function buttonsRow(
  ctx: FrameContext,
  sourceId: string | null,
  labels: string[],
  framePos: { x: number; y: number },
  frameW: number,
  startY: number
): string[] {
  const BTN_W = 130;
  const GAP_X = 12;
  const totalW = labels.length * BTN_W + (labels.length - 1) * GAP_X;
  const startX = framePos.x + (frameW - totalW) / 2;

  // Adiciona tracking _selecao no source (bot/menu) — quando há botões abaixo,
  // o usuário VAI selecionar uma opção, então o bot pai ganha _selecao além do _exibicao
  if (sourceId) {
    const source = ctx.nodes.find((n) => n.id === sourceId);
    if (source && (source.type === 'bubble-bot' || source.type === 'menu')) {
      const sourceText =
        (source.data?.text as string | undefined) ??
        (source.data?.header as string | undefined) ??
        '';
      const existing = ctx.nodes.filter(
        (n) => n.type === 'tracking' && n.parentId === sourceId
      );
      ctx.nodes.push({
        id: uid('trk'),
        type: 'tracking',
        parentId: sourceId,
        position: { x: -256, y: existing.length * 52 },
        data: { label: `${extractTrackingName(sourceText)} selecao` },
      });
    }
  }

  const ids: string[] = [];
  labels.forEach((label, idx) => {
    const id = uid('btn');
    const code = nextCode(ctx);
    const x = startX + idx * (BTN_W + GAP_X);
    ctx.nodes.push({
      id,
      type: 'btn-short',
      position: { x, y: startY },
      data: { code, label },
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

  return ids;
}

function midiaBot(
  ctx: FrameContext,
  kind: 'imagem' | 'documento' | 'video',
  caption: string,
  pos: { x: number; y: number }
): string {
  const id = uid('midia');
  const code = nextCode(ctx);
  const type = `midia-${kind}-bot` as const;
  ctx.nodes.push({
    id,
    type,
    position: pos,
    data: { code, sender: 'bot', mediaKind: kind, caption, time: '9.41 AM' },
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
  return id;
}

/**
 * Dispõe N direcionamentos em GRID HORIZONTAL abaixo do menu.
 * Retorna a coordenada Y final (após o grid) pra o próximo node seguir.
 *
 * @param framePos posição do frame (x, y)
 * @param frameW   width do frame
 * @param startY   Y onde começa o grid (logo abaixo do menu)
 * @param dirs     lista de { label, targetFrameId }
 */
function gridDirecionamentos(
  ctx: FrameContext,
  framePos: { x: number; y: number },
  frameW: number,
  startY: number,
  dirs: Array<{ label: string; targetFrameId: string }>
): number {
  const DIR_W = 230;
  const DIR_H = 50;
  const GAP_X = 12;
  const GAP_Y = 8;
  const MARGIN = 20;

  const innerW = frameW - 2 * MARGIN;
  const perRow = Math.max(1, Math.floor((innerW + GAP_X) / (DIR_W + GAP_X)));
  const rows = Math.ceil(dirs.length / perRow);

  // Total width usado (centraliza horizontalmente dentro do frame)
  const totalW = perRow * DIR_W + (perRow - 1) * GAP_X;
  const startX = framePos.x + (frameW - totalW) / 2;

  dirs.forEach((d, idx) => {
    const col = idx % perRow;
    const row = Math.floor(idx / perRow);
    const x = startX + col * (DIR_W + GAP_X);
    const y = startY + row * (DIR_H + GAP_Y);
    // Não criamos edge automática (eles são "botões pós-menu")
    direcionamento(ctx, d.label, d.targetFrameId, { x, y }, false);
  });

  return startY + rows * (DIR_H + GAP_Y);
}

// --------------------------------------------------------------------------
// Builder principal
// --------------------------------------------------------------------------
export function buildVarejoExemploTemplate(): ProjectState {
  _counter = 0;

  const allNodes: FluxoNode[] = [];
  const allEdges: Edge[] = [];

  // Tamanhos
  const FW = 900;
  const FH = 1400;
  const COL_GAP = 100;
  const ROW_GAP = 200;

  // Grid 4 × 3
  const positions = {
    saudacao:        { x: 0,                   y: 0 },
    ofertas:         { x: FW + COL_GAP,        y: 0 },
    lojas:           { x: 2 * (FW + COL_GAP),  y: 0 },
    cartao:          { x: 3 * (FW + COL_GAP),  y: 0 },
    comprarSite:     { x: 0,                   y: FH + ROW_GAP },
    comprarAtacado:  { x: FW + COL_GAP,        y: FH + ROW_GAP },
    devolucao:       { x: 2 * (FW + COL_GAP),  y: FH + ROW_GAP },
    sac:             { x: 3 * (FW + COL_GAP),  y: FH + ROW_GAP },
    etica:           { x: 0,                   y: 2 * (FH + ROW_GAP) },
    atendente:       { x: FW + COL_GAP,        y: 2 * (FH + ROW_GAP) },
    algoMais:        { x: 2 * (FW + COL_GAP),  y: 2 * (FH + ROW_GAP) },
    encerramento:    { x: 3 * (FW + COL_GAP),  y: 2 * (FH + ROW_GAP) },
  };

  // Helper: termina o cenário com um direcionamento → frame Algo Mais
  function endWithAlgoMais(
    ctx: FrameContext,
    framePos: { x: number; y: number },
    frameW: number,
    startY: number
  ) {
    // Centraliza o direcionamento horizontalmente
    const dirW = 230;
    direcionamento(
      ctx,
      'Algo Mais',
      'algo-mais',
      { x: framePos.x + (frameW - dirW) / 2, y: startY },
      true // conecta do último flow node
    );
  }

  // ========================================================================
  // FRAME: Saudação (S)
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Saudação',
      prefix: 'S',
      frameId: 'saudacao',
      ...positions.saudacao,
      width: FW,
      height: FH,
    });
    const bx = positions.saudacao.x + 400;
    let y = positions.saudacao.y + 80;

    bot(ctx, 'Oi! Sou o(a) assistente virtual da {nome da marca}, e vou te ajudar no seu atendimento.', { x: bx, y });
    y += 160;
    bot(ctx, 'Por favor, digite o seu nome.', { x: bx, y });
    y += 130;
    user(ctx, '{nome do cliente}', { x: bx + 60, y });
    y += 160;
    bot(ctx, 'Escolha uma opção abaixo:', { x: bx, y });
    y += 130;
    menu(ctx, 'Menu Principal', [
      'Ofertas',
      'Lojas',
      'Cartão de crédito',
      'Comprar no site ou app',
      'Comprar em atacado',
      'Devolução',
      'SAC',
      'Canal de ética e conduta',
      'Falar com atendente',
    ], { x: bx, y });
    y += 600;

    // Direcionamentos em grid horizontal
    y = gridDirecionamentos(ctx, positions.saudacao, FW, y, [
      { label: 'Ofertas', targetFrameId: 'ofertas' },
      { label: 'Lojas', targetFrameId: 'lojas' },
      { label: 'Cartão de crédito', targetFrameId: 'cartao' },
      { label: 'Comprar site/app', targetFrameId: 'comprar-site' },
      { label: 'Comprar atacado', targetFrameId: 'comprar-atacado' },
      { label: 'Devolução', targetFrameId: 'devolucao' },
      { label: 'SAC', targetFrameId: 'sac' },
      { label: 'Ética e conduta', targetFrameId: 'etica' },
      { label: 'Falar com atendente', targetFrameId: 'atendente' },
    ]);

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: Ofertas (OF) — 2 estados = btn-short (não menu)
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Ofertas',
      prefix: 'OF',
      frameId: 'ofertas',
      ...positions.ofertas,
      width: FW,
      height: FH + 200,
    });
    const bx = positions.ofertas.x + 400;
    let y = positions.ofertas.y + 80;

    const askEstado = bot(ctx, 'Temos ofertas novas toda semana. Informe o seu estado.', { x: bx, y });
    y += 160;

    // 2 botões curtos lado a lado (cada um leva a uma mídia diferente)
    const [btnPE, btnPB] = buttonsRow(
      ctx,
      askEstado,
      ['Pernambuco', 'Paraíba'],
      positions.ofertas,
      FW,
      y
    );
    y += 80;

    // Cada botão direciona pra uma mídia (encarte) diferente
    const midiaPE = uid('midia');
    const midiaPB = uid('midia');
    ctx.nodes.push({
      id: midiaPE,
      type: 'midia-documento-bot',
      position: { x: bx - 250, y: y },
      data: {
        code: nextCode(ctx),
        sender: 'bot',
        mediaKind: 'documento',
        caption: 'Encarte Pernambuco',
        time: '9.41 AM',
      },
    });
    ctx.nodes.push({
      id: midiaPB,
      type: 'midia-documento-bot',
      position: { x: bx + 50, y: y },
      data: {
        code: nextCode(ctx),
        sender: 'bot',
        mediaKind: 'documento',
        caption: 'Encarte Paraíba',
        time: '9.41 AM',
      },
    });
    ctx.edges.push({ id: uid('e'), source: btnPE, target: midiaPE, animated: true });
    ctx.edges.push({ id: uid('e'), source: btnPB, target: midiaPB, animated: true });
    y += 240;

    // Reconverge no próximo bubble — pergunta sobre periodicidade
    // (connectFromLast=false pra NÃO criar edge fantasma askEstado→askPeriodic)
    const askPeriodic = bot(
      ctx,
      'Você deseja receber essas ofertas periodicamente?',
      { x: bx, y },
      false
    );
    // Edges convergentes das 2 mídias → askPeriodic
    ctx.edges.push({ id: uid('e'), source: midiaPE, target: askPeriodic, animated: true });
    ctx.edges.push({ id: uid('e'), source: midiaPB, target: askPeriodic, animated: true });
    y += 160;

    // Sim ou Não — 2 botões curtos
    const [btnSim, btnNao] = buttonsRow(
      ctx,
      askPeriodic,
      ['Sim', 'Não'],
      positions.ofertas,
      FW,
      y
    );
    y += 80;

    // Bot de confirmação após "Sim" (caminho principal) — sem auto-edge
    const okBot = bot(
      ctx,
      'Perfeito! Vou registrar seu interesse para que você receba automaticamente as próximas ofertas.',
      { x: bx, y },
      false
    );
    ctx.edges.push({ id: uid('e'), source: btnSim, target: okBot, animated: true });
    y += 180;

    // Direcionamento final — vai pra Algo Mais (caminho "Sim" OU "Não" converge aqui)
    const dirW = 230;
    const dirAM = direcionamento(ctx, 'Algo Mais', 'algo-mais', {
      x: positions.ofertas.x + (FW - dirW) / 2,
      y,
    }, true);
    // Edge do "Não" direto pro Algo Mais (sem passar pelo okBot)
    ctx.edges.push({ id: uid('e'), source: btnNao, target: dirAM, animated: true });

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: Lojas (LJ) — 2 localidades + Sim/Não = btn-short
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Lojas',
      prefix: 'LJ',
      frameId: 'lojas',
      ...positions.lojas,
      width: FW,
      height: FH + 100,
    });
    const bx = positions.lojas.x + 400;
    let y = positions.lojas.y + 80;

    const askLoc = bot(ctx, 'Sobre qual localidade você deseja informações?', { x: bx, y });
    y += 160;

    const [btnPE, btnJP] = buttonsRow(
      ctx,
      askLoc,
      ['Pernambuco', 'João Pessoa'],
      positions.lojas,
      FW,
      y
    );
    y += 80;

    // 2 cards de imagem (um pra cada localidade)
    const cardPE = uid('midia');
    const cardJP = uid('midia');
    ctx.nodes.push({
      id: cardPE,
      type: 'midia-imagem-bot',
      position: { x: bx - 250, y },
      data: {
        code: nextCode(ctx),
        sender: 'bot',
        mediaKind: 'imagem',
        caption: 'Lojas Pernambuco',
        time: '9.41 AM',
      },
    });
    ctx.nodes.push({
      id: cardJP,
      type: 'midia-imagem-bot',
      position: { x: bx + 50, y },
      data: {
        code: nextCode(ctx),
        sender: 'bot',
        mediaKind: 'imagem',
        caption: 'Lojas João Pessoa',
        time: '9.41 AM',
      },
    });
    ctx.edges.push({ id: uid('e'), source: btnPE, target: cardPE, animated: true });
    ctx.edges.push({ id: uid('e'), source: btnJP, target: cardJP, animated: true });
    y += 240;

    // Reconverge no bot pergunta sobre avisos (sem auto-edge fantasma)
    const askAvisos = bot(
      ctx,
      'Você deseja receber avisos quando houver alteração de horário em feriados, datas especiais ou novidades relacionadas às lojas?',
      { x: bx, y },
      false
    );
    ctx.edges.push({ id: uid('e'), source: cardPE, target: askAvisos, animated: true });
    ctx.edges.push({ id: uid('e'), source: cardJP, target: askAvisos, animated: true });
    y += 180;

    // Sim/Não
    const [btnSim, btnNao] = buttonsRow(
      ctx,
      askAvisos,
      ['Sim', 'Não'],
      positions.lojas,
      FW,
      y
    );
    y += 80;

    const okBot = bot(
      ctx,
      'Perfeito! Vou registrar seu interesse para futuros avisos automáticos relacionados às lojas.',
      { x: bx, y },
      false
    );
    ctx.edges.push({ id: uid('e'), source: btnSim, target: okBot, animated: true });
    y += 180;

    const dirW = 230;
    const dirAM = direcionamento(ctx, 'Algo Mais', 'algo-mais', {
      x: positions.lojas.x + (FW - dirW) / 2,
      y,
    }, true);
    ctx.edges.push({ id: uid('e'), source: btnNao, target: dirAM, animated: true });

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: Cartão de crédito (CC)
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Cartão de crédito',
      prefix: 'CC',
      frameId: 'cartao',
      ...positions.cartao,
      width: FW,
      height: FH,
    });
    const bx = positions.cartao.x + 400;
    let y = positions.cartao.y + 80;

    bot(ctx, 'Nosso cartão é uma forma prática de realizar compras em nossas lojas e canais digitais.', { x: bx, y });
    y += 160;
    bot(ctx, '🔗 {link oficial para solicitação do cartão junto à administradora}', { x: bx, y });
    y += 130;
    midiaBot(ctx, 'imagem', 'Card com os principais benefícios do cartão', { x: bx, y });
    y += 240;

    endWithAlgoMais(ctx, positions.cartao, FW, y);

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: Comprar no site ou app (CS)
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Comprar no site ou app',
      prefix: 'CS',
      frameId: 'comprar-site',
      ...positions.comprarSite,
      width: FW,
      height: FH,
    });
    const bx = positions.comprarSite.x + 400;
    let y = positions.comprarSite.y + 80;

    bot(ctx, 'Pelo nosso site e app, você faz suas compras com praticidade e recebe seus produtos no conforto da sua casa.', { x: bx, y });
    y += 180;
    bot(ctx, 'Baixe o nosso app na loja de aplicativos do seu celular.\n📱 {link iOS / Android}', { x: bx, y });
    y += 160;
    bot(ctx, 'Se preferir, você também pode comprar pelo nosso site.\n🔗 {link do site}', { x: bx, y });
    y += 160;

    endWithAlgoMais(ctx, positions.comprarSite, FW, y);

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: Comprar em atacado (CA) — termina em direcionamento ao atendente
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Comprar em atacado',
      prefix: 'CA',
      frameId: 'comprar-atacado',
      ...positions.comprarAtacado,
      width: FW,
      height: FH,
    });
    const bx = positions.comprarAtacado.x + 400;
    let y = positions.comprarAtacado.y + 80;

    bot(ctx, 'Vamos agilizar seu atendimento de atacado. Primeiro, escolha a loja em que você deseja ser atendido.', { x: bx, y });
    y += 180;
    menu(ctx, 'Loja atacado', ['Loja 1', 'Loja 2', 'Loja 3', 'Loja 4', 'Loja 5'], { x: bx, y });
    y += 540;
    user(ctx, '{loja selecionada}', { x: bx + 60, y });
    y += 160;
    bot(ctx, 'Agora preciso de algumas informações para direcionar seu atendimento.', { x: bx, y });
    y += 160;
    bot(ctx, 'Informe, por favor: nome, CPF/CNPJ, telefone e e-mail.', { x: bx, y });
    y += 160;
    user(ctx, '{dados do cliente}', { x: bx + 60, y });
    y += 160;
    bot(ctx, 'Obrigada! Vou encaminhar seu atendimento para a equipe responsável pela loja selecionada.', { x: bx, y });
    y += 180;

    // Termina com direcionamento → atendente
    const dirW = 230;
    direcionamento(ctx, 'Transbordo (equipe da loja)', 'atendente', {
      x: positions.comprarAtacado.x + (FW - dirW) / 2,
      y,
    });

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: Devolução (DV) — termina direcionando ao atendente
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Devolução',
      prefix: 'DV',
      frameId: 'devolucao',
      ...positions.devolucao,
      width: FW,
      height: 600,
    });
    const bx = positions.devolucao.x + 400;
    let y = positions.devolucao.y + 80;

    bot(ctx, 'Para solicitações de devolução, seu atendimento será direcionado para um atendente.', { x: bx, y });
    y += 180;

    const dirW = 230;
    direcionamento(ctx, 'Falar com atendente', 'atendente', {
      x: positions.devolucao.x + (FW - dirW) / 2,
      y,
    });

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: SAC
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'SAC',
      prefix: 'SAC',
      frameId: 'sac',
      ...positions.sac,
      width: FW,
      height: FH,
    });
    const bx = positions.sac.x + 400;
    let y = positions.sac.y + 80;

    bot(ctx, 'Para assuntos relacionados a produto, qualidade, reclamação de mercadoria ou atendimento do SAC, utilize nossos canais oficiais.', { x: bx, y });
    y += 200;
    bot(ctx, 'Selecione a loja que deseja reclamar.', { x: bx, y });
    y += 130;
    menu(ctx, 'Loja SAC', ['Loja 1', 'Loja 2', 'Loja 3', 'Loja 4', 'Loja 5'], { x: bx, y });
    y += 540;
    user(ctx, '{loja selecionada}', { x: bx + 60, y });
    y += 160;
    bot(ctx, 'Vou direcionar você ao WhatsApp da loja escolhida.', { x: bx, y });
    y += 180;

    endWithAlgoMais(ctx, positions.sac, FW, y);

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: Ética e conduta (ET)
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Ética e conduta',
      prefix: 'ET',
      frameId: 'etica',
      ...positions.etica,
      width: FW,
      height: FH,
    });
    const bx = positions.etica.x + 400;
    let y = positions.etica.y + 80;

    bot(ctx, 'Se você deseja registrar um relato relacionado a conduta, comportamento inadequado, tratamento recebido ou situações envolvendo pessoas e a empresa, utilize o nosso canal oficial de ética e conduta.', { x: bx, y });
    y += 220;
    bot(ctx, '🔗 {link oficial do canal de ética e conduta}', { x: bx, y });
    y += 130;

    endWithAlgoMais(ctx, positions.etica, FW, y);

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: Falar com atendente (FA)
  //
  // Padrão Blip/Digitalbot — cascata de 4 condicionais ANTES do
  // atendimento-humano. Cada condicional tem 2 saídas (TRUE/FALSE) com
  // sourceHandle explícito:
  //
  //   FA001 (cond "feriado?")        TRUE  → FA002 (mensagem feriado)
  //                                  FALSE → FA003 (cond fim de semana?)
  //   FA003 (cond "fim de semana?")  TRUE  → FA004 (mensagem fds)
  //                                  FALSE → FA005 (cond horário?)
  //   FA005 (cond "horário?")        TRUE  → FA006 (mensagem fora horário)
  //                                  FALSE → FA007 (cond disponível?)
  //   FA007 (cond "disponível?")     FALSE → FA008 (mensagem aguarde)
  //                                  TRUE  → atendimento-humano
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Falar com atendente',
      prefix: 'FA',
      frameId: 'atendente',
      ...positions.atendente,
      width: FW,
      height: 1200,
    });
    const bx = positions.atendente.x + 200;
    const sideX = positions.atendente.x + 600; // mensagens-de-corte à direita
    let y = positions.atendente.y + 80;

    // helper local pra criar edge com sourceHandle explícito
    const link = (
      source: string,
      target: string,
      sourceHandle?: 'true' | 'false'
    ) =>
      ctx.edges.push({
        id: uid('e'),
        source,
        target,
        animated: true,
        ...(sourceHandle ? { sourceHandle } : {}),
      });

    // 1. Feriado? (FA001)
    const cond1 = condicional(ctx, 'É feriado?', { x: bx, y }, 'Sim', 'Não', false);
    const botFeriado = bot(
      ctx,
      'Agradecemos seu contato. No momento estamos em feriado e não temos atendimento. Tente novamente em horário comercial.',
      { x: sideX, y: y - 20 },
      false
    );
    link(cond1, botFeriado, 'true');
    y += 200;

    // 2. Final de semana? (FA003) — entrada vem do FALSE da cond1
    const cond2 = condicional(ctx, 'É final de semana?', { x: bx, y }, 'Sim', 'Não', false);
    link(cond1, cond2, 'false');
    const botFds = bot(
      ctx,
      'Agradecemos seu contato. Aos finais de semana não temos atendimento. Tente nos contatar em dias úteis.',
      { x: sideX, y: y - 20 },
      false
    );
    link(cond2, botFds, 'true');
    y += 200;

    // 3. Fora do horário? (FA005)
    const cond3 = condicional(ctx, 'Está fora do horário?', { x: bx, y }, 'Sim', 'Não', false);
    link(cond2, cond3, 'false');
    const botFora = bot(
      ctx,
      'Agradecemos seu contato. No momento estamos fora do nosso horário de atendimento.',
      { x: sideX, y: y - 20 },
      false
    );
    link(cond3, botFora, 'true');
    y += 200;

    // 4. Atendente disponível? (FA007)
    const cond4 = condicional(ctx, 'Atendente disponível?', { x: bx, y }, 'Sim', 'Não', false);
    link(cond3, cond4, 'false');
    const botAguarde = bot(
      ctx,
      'Em alguns instantes um atendente fará seu atendimento. Por favor, aguarde.',
      { x: sideX, y: y - 20 },
      false
    );
    // cond4 FALSE (não tem atendente) → mensagem aguarde
    link(cond4, botAguarde, 'false');
    y += 200;

    // 5. Atendimento humano efetivo — cond4 TRUE (tem atendente)
    const atend = atendimentoHumano(ctx, { x: bx, y }, false);
    link(cond4, atend, 'true');

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: Algo Mais (AM) — reutilizável
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Algo Mais',
      prefix: 'AM',
      frameId: 'algo-mais',
      ...positions.algoMais,
      width: FW,
      height: 1100,
    });
    const bx = positions.algoMais.x + 400;
    let y = positions.algoMais.y + 80;

    bot(ctx, 'Posso te ajudar com algo mais?', { x: bx, y });
    y += 160;
    menu(ctx, 'Continuidade', [
      'Voltar ao menu principal',
      'Falar com atendente',
      'Encerrar atendimento',
    ], { x: bx, y });
    y += 460;

    // 3 direcionamentos em grid horizontal
    y = gridDirecionamentos(ctx, positions.algoMais, FW, y, [
      { label: 'Voltar ao Menu', targetFrameId: 'saudacao' },
      { label: 'Falar com atendente', targetFrameId: 'atendente' },
      { label: 'Encerrar', targetFrameId: 'encerramento' },
    ]);

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ========================================================================
  // FRAME: Encerramento (EN)
  // ========================================================================
  {
    const { ctx } = newFrame({
      title: 'Encerramento',
      prefix: 'EN',
      frameId: 'encerramento',
      ...positions.encerramento,
      width: FW,
      height: 1100,
    });
    const bx = positions.encerramento.x + 400;
    let y = positions.encerramento.y + 80;

    bot(ctx, 'Obrigado(a) pelo seu contato! Antes de encerrar, como você avalia sua experiência com nosso atendimento?', { x: bx, y });
    y += 200;
    menu(ctx, 'Avaliação CSAT', [
      'Muito satisfeito(a)',
      'Satisfeito(a)',
      'Pouco satisfeito(a)',
      'Muito insatisfeito(a)',
    ], { x: bx, y });
    y += 480;
    user(ctx, '{avaliação}', { x: bx + 60, y });
    y += 160;
    bot(ctx, 'Se desejar, você também pode nos contar o que faltou ou o que poderia ter sido diferente no atendimento.', { x: bx, y });
    y += 180;
    user(ctx, '{feedback opcional}', { x: bx + 60, y });

    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  return {
    nodes: allNodes,
    edges: allEdges,
    viewport: { x: 0, y: 0, zoom: 0.3 },
  };
}
