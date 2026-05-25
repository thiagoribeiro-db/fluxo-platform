/**
 * Schemas Zod pra validar OUTPUTS da IA — protege contra:
 *  1. Modelo retornar JSON malformado (raro mas acontece)
 *  2. Mudança na API Anthropic que quebra o shape
 *  3. Output truncado por max_tokens cortado no meio
 *
 * Quando falha, retornamos erro estruturado em vez de propagar object torto
 * pro frontend (que pode renderizar `undefined` em produção).
 */

import { z } from 'zod';

// =============================================================================
// VOICE & TONE
// =============================================================================

export const VoiceSeveritySchema = z.enum(['high', 'medium', 'low']);

export const VoiceSuggestionSchema = z.object({
  nodeId: z.string(),
  fieldPath: z.string(),
  fieldLabel: z.string(),
  frameLabel: z.string(),
  code: z.string().nullable(),
  original: z.string(),
  suggested: z.string(),
  reason: z.string(),
  severity: VoiceSeveritySchema,
});

export const VoiceAnalysisResultSchema = z.object({
  suggestions: z.array(VoiceSuggestionSchema),
  analyzedCount: z.number().int().nonnegative(),
  model: z.string().optional(),
});

// =============================================================================
// AI CHAT
// =============================================================================

export const ChatResponseSchema = z.object({
  answer: z.string().min(1, 'Resposta vazia da IA'),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    })
    .optional(),
});

export type ChatResponseValidated = z.infer<typeof ChatResponseSchema>;
