/**
 * Schemas Zod do output da IA (parse-with-ai).
 *
 * Substitui a validação manual ad-hoc em `lib/parser/ai-schema.ts:
 * validateAIParseResult` por validação declarativa + mensagens de erro
 * legíveis automáticas.
 *
 * USO:
 *   import { AIParseResultSchema } from '@/lib/schemas/ai-output';
 *   const parsed = AIParseResultSchema.parse(toolInput); // throw se inválido
 *   // ou safeParse:
 *   const result = AIParseResultSchema.safeParse(toolInput);
 *   if (!result.success) { ... }
 *
 * Os schemas espelham os tipos TS em `lib/parser/ai-schema.ts`. Quando
 * mudar um, atualize o outro.
 */
import { z } from 'zod';

// =============================================================================
// Block
// =============================================================================

const BLOCK_KINDS = [
  'bot',
  'user',
  'menu',
  'buttons',
  'btn-long',
  'media',
  'link',
  'direcionamento',
  'condicional',
  'atendimento-humano',
  'integracao',
  'iag',
] as const;

const MEDIA_KINDS = ['imagem', 'documento', 'video'] as const;
const SENDERS = ['bot', 'user'] as const;
const INTEGRACAO_TYPES = ['api', 'planilha'] as const;
const IAG_TYPES = ['entrada', 'reentrada', 'saida'] as const;

const AIIntegrationFieldSchema = z.object({
  label: z.string(),
  key: z.string(),
  value: z.string(),
});

/**
 * Schema dos blocos. Não usa discriminated union — a IA frequentemente
 * emite campos opcionais "extras" que são ignorados; ser permissivo
 * aqui evita rejeitar outputs quase corretos.
 */
export const AIBlockSchema = z
  .object({
    kind: z.enum(BLOCK_KINDS),
    text: z.string().optional(),
    header: z.string().optional(),
    options: z.array(z.string()).optional(),
    footer: z.string().optional(),
    question: z.string().optional(),
    label: z.string().optional(),
    media_kind: z.enum(MEDIA_KINDS).optional(),
    sender: z.enum(SENDERS).optional(),
    caption: z.string().optional(),
    condition: z.string().optional(),
    true_label: z.string().optional(),
    false_label: z.string().optional(),
    url: z.string().optional(),
    link_title: z.string().optional(),
    link_description: z.string().optional(),
    target_frame_id: z.string().optional(),
    integracao_type: z.enum(INTEGRACAO_TYPES).optional(),
    iag_type: z.enum(IAG_TYPES).optional(),
    title: z.string().optional(),
    fields: z.array(AIIntegrationFieldSchema).optional(),
  })
  // Aceita campos extras silenciosamente (forward-compat)
  .passthrough();

// =============================================================================
// Frame
// =============================================================================

export const AIFrameSchema = z.object({
  title: z.string().min(1, 'title vazio'),
  prefix: z.string().min(1, 'prefix vazio'),
  frame_id: z.string().min(1, 'frame_id vazio'),
  blocks: z.array(AIBlockSchema),
});

// =============================================================================
// Result
// =============================================================================

export const AIParseResultSchema = z.object({
  frames: z.array(AIFrameSchema).min(1, 'nenhum frame no output da IA'),
  notes: z.array(z.string()).optional().default([]),
});

export type AIBlockParsed = z.infer<typeof AIBlockSchema>;
export type AIFrameParsed = z.infer<typeof AIFrameSchema>;
export type AIParseResultParsed = z.infer<typeof AIParseResultSchema>;
