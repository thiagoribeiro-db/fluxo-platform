'use server';

/**
 * Server action: análise de Voice/Tone via Claude.
 *
 * Recebe profile (descrição do tom desejado) + lista de mensagens com
 * contexto (frame, code, tipo de campo). Retorna sugestões pontuais:
 * quais mensagens destoam do tom + reescrita preservando significado.
 *
 * Decisões de design:
 *  - Modelo: claude-haiku (rápido + qualidade ótima pra task de classificação/reescrita)
 *  - Output: JSON estruturado validado por Zod
 *  - Hard limit: 80 mensagens por chamada (~ projeto médio) — pra evitar
 *    custos absurdos e timeouts. Se passar, divide-se em batches do client.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type {
  VoiceAnalysisResult,
  VoiceProfile,
  VoiceSeverity,
  VoiceSuggestion,
} from '@/lib/voice-tone/types';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4000;
const MAX_MESSAGES_PER_CALL = 80;

/**
 * Entrada de análise — cada mensagem que vai pro Claude.
 */
export interface AnalyzeVoiceMessage {
  nodeId: string;
  fieldPath: string;
  fieldLabel: string;
  frameLabel: string;
  code: string | null;
  text: string;
}

export interface AnalyzeVoiceRequest {
  profile: VoiceProfile;
  messages: AnalyzeVoiceMessage[];
}

// Schema do output esperado da IA
const SuggestionSchema = z.object({
  nodeId: z.string(),
  fieldPath: z.string(),
  suggested: z.string(),
  reason: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
});
const AnalysisOutputSchema = z.object({
  suggestions: z.array(SuggestionSchema),
});

function buildSystemPrompt(profile: VoiceProfile): string {
  const examples =
    profile.examples && profile.examples.length > 0
      ? `\n\nEXEMPLOS de mensagens NO TOM desejado:\n${profile.examples.map((e, i) => `${i + 1}. "${e}"`).join('\n')}`
      : '';

  return `Você é um revisor especialista em Voice & Tone de chatbots em português brasileiro. Sua tarefa é identificar mensagens que DESTOAM do tom desejado e sugerir reescritas curtas que mantenham o significado original mas alinhem com o tom.

TOM DESEJADO:
${profile.description}${examples}

REGRAS DE ANÁLISE:
1. Compare cada mensagem com o tom acima. Se ela já está no tom, NÃO sugira mudança (ignore).
2. Sugira apenas se a mensagem destoar de forma evidente — placeholders entre chaves (ex: {nome}, {data}) são intocáveis e devem aparecer iguais na sugestão.
3. Reescrita deve manter:
   - Mesmo significado essencial
   - Mesmos placeholders ({...}) intactos
   - Tamanho similar (não estoure de 1.5x o original)
4. severity:
   - "low" = pequenos ajustes (palavra mais formal/informal aqui ou ali)
   - "medium" = mensagem soa fora do tom mas é compreensível
   - "high" = mensagem CHOCA com o tom (ex: super formal num bot casual)
5. reason: 1 frase curta explicando POR QUE destoa (ex: "Usa 'prezado' que é muito formal pro tom casual.")

FORMATO DE SAÍDA (JSON estrito, sem markdown, sem comentários):
{
  "suggestions": [
    { "nodeId": "...", "fieldPath": "...", "suggested": "...", "reason": "...", "severity": "low|medium|high" }
  ]
}

Se nenhuma mensagem destoa, retorne {"suggestions": []}. Não invente nodeId/fieldPath — use EXATAMENTE os fornecidos.`;
}

function buildUserMessage(messages: AnalyzeVoiceMessage[]): string {
  const lines = messages.map((m, i) => {
    return `${i + 1}. nodeId="${m.nodeId}" fieldPath="${m.fieldPath}" (${m.frameLabel}${m.code ? ' · ' + m.code : ''} · ${m.fieldLabel}):
"${m.text}"`;
  });
  return `Analise as ${messages.length} mensagens abaixo e identifique quais destoam do tom (lista as que precisam ajuste em "suggestions"):

${lines.join('\n\n')}`;
}

export async function analyzeVoiceTone(
  req: AnalyzeVoiceRequest
): Promise<VoiceAnalysisResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  // Rate limit (10 análises/min por user)
  const { checkIaRateLimit } = await import('@/lib/utils/rate-limit');
  const limit = checkIaRateLimit(user.id, 'VOICE_TONE');
  if (!limit.allowed) throw new Error(limit.message);

  const { profile, messages } = req;
  if (!messages || messages.length === 0) {
    return { suggestions: [], analyzedCount: 0, model: MODEL };
  }

  // Limita o tamanho do batch — proteção contra custos altos
  const batch = messages.slice(0, MAX_MESSAGES_PER_CALL);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const result = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(profile),
    messages: [{ role: 'user', content: buildUserMessage(batch) }],
  });

  // Extrai texto JSON
  const raw = result.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  // Tenta limpar markdown caso a IA tenha colocado
  let cleaned = raw;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed: z.infer<typeof AnalysisOutputSchema>;
  try {
    const json = JSON.parse(cleaned);
    parsed = AnalysisOutputSchema.parse(json);
  } catch (err) {
    console.error('[voice-tone] Falha ao parsear resposta da IA:', err);
    console.error('[voice-tone] Resposta crua:', raw);
    throw new Error(
      'A IA retornou resposta em formato inesperado. Tente novamente.'
    );
  }

  // Enriquecer cada sugestão com dados que vieram no input (a IA só retorna
  // o que ela gera novo — original/fieldLabel/etc. vem da request)
  const byId = new Map<string, AnalyzeVoiceMessage>();
  for (const m of batch) {
    byId.set(`${m.nodeId}::${m.fieldPath}`, m);
  }

  const suggestions: VoiceSuggestion[] = parsed.suggestions
    .map((s) => {
      const orig = byId.get(`${s.nodeId}::${s.fieldPath}`);
      if (!orig) {
        // IA inventou um nodeId/fieldPath — descarta
        console.warn('[voice-tone] Sugestão pra nodeId/fieldPath inválido:', s);
        return null;
      }
      // Sanity: ignora se "suggested" é vazio ou igual ao original
      const trimmed = s.suggested.trim();
      if (!trimmed || trimmed === orig.text.trim()) return null;
      return {
        nodeId: s.nodeId,
        fieldPath: s.fieldPath,
        fieldLabel: orig.fieldLabel,
        frameLabel: orig.frameLabel,
        code: orig.code,
        original: orig.text,
        suggested: trimmed,
        reason: s.reason,
        severity: s.severity as VoiceSeverity,
      } satisfies VoiceSuggestion;
    })
    .filter((s): s is VoiceSuggestion => s !== null);

  return {
    suggestions,
    analyzedCount: batch.length,
    model: MODEL,
  };
}
