'use server';

/**
 * Chat IA contextual — server action que envia o estado do projeto +
 * pergunta do user pro Claude, retorna resposta em markdown.
 *
 * Não é streaming (pra simplificar — pode evoluir pra Streamable depois).
 * Resposta vem completa em um single call.
 *
 * Tipos de pergunta:
 *  - 'explain-frame': explica em PT-BR o que o frame faz (resumo
 *    conversacional)
 *  - 'suggest-next': sugere próximo bloco baseado no contexto
 *  - 'free': pergunta livre do user
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import type { FluxoNode } from '@/lib/types';
import type { Edge } from '@xyflow/react';

const MODEL = 'claude-opus-4-5-20241022'; // ou claude-sonnet-4-5 se preferir
const MAX_TOKENS = 1500;

export type ChatQuestionKind = 'explain-frame' | 'suggest-next' | 'free';

export interface ChatRequest {
  kind: ChatQuestionKind;
  /** Pergunta livre (só pra kind='free'). */
  question?: string;
  /** Frame alvo (pra kind='explain-frame' e 'suggest-next'). */
  frameId?: string;
  /** Snapshot do canvas atual. Client envia (server não tem acesso direto). */
  nodes: FluxoNode[];
  edges: Edge[];
}

export interface ChatResponse {
  answer: string;
  usage?: { inputTokens: number; outputTokens: number };
}

const SYSTEM_PROMPT = `Você é assistente do Fluxo Platform, editor visual de chatbots Blip/Digitalbot.

Quando o user perguntar sobre um FRAME ou BLOCO específico, responda em PT-BR conciso (máx 4 parágrafos curtos), explicando:
- O que o fluxo faz do ponto de vista do usuário final
- Quais decisões/bifurcações existem
- Possíveis pontos de melhoria (se houver)

Quando o user pedir SUGESTÃO de próximo bloco, proponha 2-3 alternativas curtas justificando cada uma (ex: "se quiser confirmar antes de prosseguir, use um buttons com Sim/Não").

Quando for PERGUNTA LIVRE, responda direto, sem florear. Markdown OK (bold, listas, code blocks).

NUNCA invente nodes que não existem no snapshot. Use os codes (S001, OF003, etc.) pra referenciar blocos específicos.`;

function summarizeNodes(nodes: FluxoNode[], edges: Edge[]): string {
  const frames = nodes.filter((n) => n.type === 'frame');
  const mainTypes = new Set([
    'bubble-bot', 'bubble-user', 'menu', 'btn-short', 'btn-long',
    'direcionamento', 'condicional', 'atendimento-humano', 'link',
    'midia-imagem-bot', 'midia-documento-bot', 'midia-video-bot',
    'integracao-api', 'integracao-planilha',
    'iag-entrada', 'iag-reentrada', 'iag-saida',
  ]);
  const main = nodes.filter((n) => n.type && mainTypes.has(n.type));

  // Mapa: frame title → blocos dentro (por bbox)
  const byFrame = frames.map((f) => {
    const fx = f.position.x;
    const fy = f.position.y;
    const fw = (f.data?.width as number | undefined) ?? 656;
    const fh = (f.data?.height as number | undefined) ?? 400;
    const inside = main
      .filter((n) => {
        if (n.parentId) return false;
        const cx = n.position.x + 100;
        const cy = n.position.y + 30;
        return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
      })
      .sort((a, b) => a.position.y - b.position.y);
    return {
      title: (f.data?.title as string) ?? 'sem nome',
      frameId: (f.data?.frameId as string) ?? '',
      blocks: inside.map((n) => ({
        code: (n.data?.code as string) ?? '',
        type: n.type,
        text:
          (n.data?.text as string | undefined) ??
          (n.data?.header as string | undefined) ??
          (n.data?.label as string | undefined) ??
          (n.data?.condition as string | undefined) ??
          (n.data?.title as string | undefined) ??
          '',
      })),
    };
  });

  return JSON.stringify({ frames: byFrame, edgeCount: edges.length }, null, 0);
}

export async function askAI(req: ChatRequest): Promise<ChatResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  // Rate limit (30 msg/min por user)
  const { checkIaRateLimit } = await import('@/lib/utils/rate-limit');
  const limit = checkIaRateLimit(user.id, 'AI_CHAT');
  if (!limit.allowed) throw new Error(limit.message);

  // Monta a pergunta humana
  const flowSnapshot = summarizeNodes(req.nodes, req.edges);
  let userMessage: string;
  if (req.kind === 'explain-frame') {
    userMessage = `Explique de forma conversacional o que o frame "${req.frameId}" faz, do ponto de vista do usuário final do bot.\n\nSnapshot do projeto:\n${flowSnapshot}`;
  } else if (req.kind === 'suggest-next') {
    userMessage = `Estou trabalhando no frame "${req.frameId}". Sugira 2-3 opções de próximo bloco que eu poderia adicionar, justificando cada uma.\n\nSnapshot do projeto:\n${flowSnapshot}`;
  } else {
    userMessage = `${req.question ?? '(sem pergunta)'}\n\nSnapshot do projeto pra contexto:\n${flowSnapshot}`;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const result = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Extrai texto da resposta
  const answer = result.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  // Valida output da IA antes de devolver — modelo às vezes retorna vazio
  // ou estrutura estranha. Zod garante contrato.
  const { ChatResponseSchema } = await import('@/lib/schemas/ai-outputs');
  const payload = {
    answer,
    usage: {
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
    },
  };
  const parsed = ChatResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `IA retornou resposta inválida: ${parsed.error.issues.map((i) => i.message).join('; ')}`
    );
  }

  return parsed.data;
}
