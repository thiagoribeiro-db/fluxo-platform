/**
 * Template "Saúde / Clínica" — chatbot básico de clínica/consultório.
 *
 * Cenários mínimos: Saudação + Agendamento + Confirmar consulta + Cancelar
 * + Convênios + Atendente + Encerramento.
 *
 * Mais enxuto que varejo-exemplo — pensado pra ser starter rápido. Usuário
 * adapta os textos e adiciona o que faltar. Auto-organize rearranja após
 * apply.
 */
import type { Edge } from '@xyflow/react';
import type { FluxoNode, ProjectState } from '@/lib/types';

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
    zIndex: 0,
    data: {
      title: opts.title,
      frameId: opts.frameId,
      prefix: opts.prefix,
      width: opts.width ?? 600,
      height: opts.height ?? 700,
    },
  };
  return {
    frame,
    ctx: {
      nodes: [],
      edges: [],
      prefix: opts.prefix,
      seq: 0,
      lastFlowId: null,
    },
  };
}

function nextCode(ctx: FrameContext): string {
  ctx.seq += 1;
  return `${ctx.prefix}${String(ctx.seq).padStart(3, '0')}`;
}

function bot(ctx: FrameContext, text: string, pos: { x: number; y: number }) {
  const id = uid('bubble-bot');
  ctx.nodes.push({
    id,
    type: 'bubble-bot',
    position: pos,
    data: { text, code: nextCode(ctx) },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({ id: uid('e'), source: ctx.lastFlowId, target: id });
  }
  ctx.lastFlowId = id;
  return id;
}

function user(ctx: FrameContext, text: string, pos: { x: number; y: number }) {
  const id = uid('bubble-user');
  ctx.nodes.push({
    id,
    type: 'bubble-user',
    position: pos,
    data: { text, code: nextCode(ctx) },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({ id: uid('e'), source: ctx.lastFlowId, target: id });
  }
  ctx.lastFlowId = id;
  return id;
}

function menu(
  ctx: FrameContext,
  header: string,
  options: string[],
  pos: { x: number; y: number }
) {
  const id = uid('menu');
  ctx.nodes.push({
    id,
    type: 'menu',
    position: pos,
    data: { header, options, footer: 'Enviar', code: nextCode(ctx) },
  });
  if (ctx.lastFlowId) {
    ctx.edges.push({ id: uid('e'), source: ctx.lastFlowId, target: id });
  }
  ctx.lastFlowId = id;
  return id;
}

function direcionamento(
  ctx: FrameContext,
  label: string,
  targetFrameId: string,
  pos: { x: number; y: number },
  connectFromLast = false
) {
  const id = uid('dir');
  ctx.nodes.push({
    id,
    type: 'direcionamento',
    position: pos,
    data: { label, targetFrameId, code: nextCode(ctx) },
  });
  if (connectFromLast && ctx.lastFlowId) {
    ctx.edges.push({ id: uid('e'), source: ctx.lastFlowId, target: id });
  }
  return id;
}

export function buildSaudeClinicaTemplate(): ProjectState {
  _counter = 0;
  const allNodes: FluxoNode[] = [];
  const allEdges: Edge[] = [];

  const FW = 640;
  const FH = 700;
  const COL_GAP = 80;
  const ROW_GAP = 100;

  const positions = {
    saudacao: { x: 0, y: 0 },
    agendar: { x: FW + COL_GAP, y: 0 },
    confirmar: { x: 2 * (FW + COL_GAP), y: 0 },
    cancelar: { x: 0, y: FH + ROW_GAP },
    convenios: { x: FW + COL_GAP, y: FH + ROW_GAP },
    atendente: { x: 2 * (FW + COL_GAP), y: FH + ROW_GAP },
    algoMais: { x: 0, y: 2 * (FH + ROW_GAP) },
    encerramento: { x: FW + COL_GAP, y: 2 * (FH + ROW_GAP) },
  };

  // ---- 1. SAUDAÇÃO --------------------------------------------------------
  {
    const { frame, ctx } = newFrame({
      title: 'Saudação',
      prefix: 'S',
      frameId: 'saudacao',
      x: positions.saudacao.x,
      y: positions.saudacao.y,
      width: FW,
      height: FH,
    });
    allNodes.push(frame);
    bot(
      ctx,
      'Olá! Sou o assistente da Clínica {nome}. 👋\nComo posso te ajudar hoje?',
      { x: 60, y: 80 }
    );
    menu(
      ctx,
      'Escolha uma opção:',
      [
        '📅 Agendar consulta',
        '✅ Confirmar consulta',
        '❌ Cancelar consulta',
        '💳 Convênios atendidos',
        '🧑‍⚕️ Falar com atendente',
      ],
      { x: 60, y: 260 }
    );
    // Direcionamentos pós-menu
    const dirY = 460;
    direcionamento(ctx, 'Agendar', 'agendamento', { x: 30, y: dirY });
    direcionamento(ctx, 'Confirmar', 'confirmar-consulta', { x: 150, y: dirY });
    direcionamento(ctx, 'Cancelar', 'cancelar-consulta', { x: 270, y: dirY });
    direcionamento(ctx, 'Convênios', 'convenios', { x: 390, y: dirY });
    direcionamento(ctx, 'Atendente', 'atendente', { x: 510, y: dirY });
    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ---- 2. AGENDAMENTO -----------------------------------------------------
  {
    const { frame, ctx } = newFrame({
      title: 'Agendamento',
      prefix: 'AG',
      frameId: 'agendamento',
      x: positions.agendar.x,
      y: positions.agendar.y,
      width: FW,
      height: FH,
    });
    allNodes.push(frame);
    bot(ctx, 'Vamos agendar sua consulta! Qual o nome do paciente?', {
      x: 60,
      y: 80,
    });
    user(ctx, '(nome do paciente)', { x: 60, y: 200 });
    bot(ctx, 'Qual a especialidade ou médico desejado?', { x: 60, y: 320 });
    user(ctx, '(especialidade ou médico)', { x: 60, y: 440 });
    bot(
      ctx,
      'Pedido recebido! Em até 2h úteis um atendente confirma sua consulta. 🙏',
      { x: 60, y: 560 }
    );
    direcionamento(
      ctx,
      'Algo Mais',
      'algo-mais',
      { x: 200, y: 640 },
      true
    );
    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ---- 3. CONFIRMAR CONSULTA ---------------------------------------------
  {
    const { frame, ctx } = newFrame({
      title: 'Confirmar Consulta',
      prefix: 'CF',
      frameId: 'confirmar-consulta',
      x: positions.confirmar.x,
      y: positions.confirmar.y,
      width: FW,
      height: FH,
    });
    allNodes.push(frame);
    bot(ctx, 'Por favor, informe o CPF do paciente pra confirmar.', {
      x: 60,
      y: 80,
    });
    user(ctx, '(CPF)', { x: 60, y: 200 });
    bot(
      ctx,
      'Consulta confirmada com sucesso! ✅\nEnviaremos lembrete 24h antes.',
      { x: 60, y: 320 }
    );
    direcionamento(
      ctx,
      'Algo Mais',
      'algo-mais',
      { x: 200, y: 440 },
      true
    );
    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ---- 4. CANCELAR CONSULTA ----------------------------------------------
  {
    const { frame, ctx } = newFrame({
      title: 'Cancelar Consulta',
      prefix: 'CN',
      frameId: 'cancelar-consulta',
      x: positions.cancelar.x,
      y: positions.cancelar.y,
      width: FW,
      height: FH,
    });
    allNodes.push(frame);
    bot(ctx, 'Sinto muito! Pra cancelar, informe o CPF do paciente:', {
      x: 60,
      y: 80,
    });
    user(ctx, '(CPF)', { x: 60, y: 200 });
    bot(
      ctx,
      'Consulta cancelada. Se quiser reagendar, escolha "Agendar consulta" no menu inicial.',
      { x: 60, y: 320 }
    );
    direcionamento(
      ctx,
      'Algo Mais',
      'algo-mais',
      { x: 200, y: 440 },
      true
    );
    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ---- 5. CONVÊNIOS -------------------------------------------------------
  {
    const { frame, ctx } = newFrame({
      title: 'Convênios',
      prefix: 'CV',
      frameId: 'convenios',
      x: positions.convenios.x,
      y: positions.convenios.y,
      width: FW,
      height: FH,
    });
    allNodes.push(frame);
    bot(
      ctx,
      'Atendemos os seguintes convênios:\n\n• Unimed\n• Amil\n• Bradesco Saúde\n• SulAmérica\n• Particular\n\nPra agendar com seu convênio, escolha "Agendar consulta" no menu inicial.',
      { x: 60, y: 80 }
    );
    direcionamento(
      ctx,
      'Algo Mais',
      'algo-mais',
      { x: 200, y: 320 },
      true
    );
    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ---- 6. ATENDENTE -------------------------------------------------------
  {
    const { frame, ctx } = newFrame({
      title: 'Atendente',
      prefix: 'AT',
      frameId: 'atendente',
      x: positions.atendente.x,
      y: positions.atendente.y,
      width: FW,
      height: FH,
    });
    allNodes.push(frame);
    bot(ctx, 'Vou te transferir pra um atendente. Aguarde um momento… 🧑‍⚕️', {
      x: 60,
      y: 80,
    });
    // Atendimento humano
    const hId = uid('hum');
    ctx.nodes.push({
      id: hId,
      type: 'atendimento-humano',
      position: { x: 60, y: 220 },
      data: { label: 'Transbordo: Atendimento Clínica', code: nextCode(ctx) },
    });
    if (ctx.lastFlowId) {
      ctx.edges.push({ id: uid('e'), source: ctx.lastFlowId, target: hId });
    }
    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ---- 7. ALGO MAIS -------------------------------------------------------
  {
    const { frame, ctx } = newFrame({
      title: 'Algo Mais',
      prefix: 'AM',
      frameId: 'algo-mais',
      x: positions.algoMais.x,
      y: positions.algoMais.y,
      width: FW,
      height: 500,
    });
    allNodes.push(frame);
    bot(ctx, 'Posso te ajudar com algo mais?', { x: 60, y: 80 });
    menu(
      ctx,
      'Escolha:',
      ['Sim, voltar ao menu', 'Não, encerrar', 'Falar com atendente'],
      { x: 60, y: 200 }
    );
    const dirY = 380;
    direcionamento(ctx, 'Voltar', 'saudacao', { x: 60, y: dirY });
    direcionamento(ctx, 'Encerrar', 'encerramento', { x: 240, y: dirY });
    direcionamento(ctx, 'Atendente', 'atendente', { x: 420, y: dirY });
    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  // ---- 8. ENCERRAMENTO ----------------------------------------------------
  {
    const { frame, ctx } = newFrame({
      title: 'Encerramento',
      prefix: 'EN',
      frameId: 'encerramento',
      x: positions.encerramento.x,
      y: positions.encerramento.y,
      width: FW,
      height: 400,
    });
    allNodes.push(frame);
    bot(
      ctx,
      'Obrigado pelo contato! Cuide-se bem. 💚\nNos vemos em breve!',
      { x: 60, y: 80 }
    );
    allNodes.push(...ctx.nodes);
    allEdges.push(...ctx.edges);
  }

  return {
    nodes: allNodes,
    edges: allEdges,
    viewport: { x: 0, y: 0, zoom: 0.4 },
  };
}
