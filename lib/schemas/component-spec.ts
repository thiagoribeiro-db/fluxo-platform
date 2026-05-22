/**
 * Schema Zod do ComponentSpec.
 *
 * Substitui `isValidSpec` (validação manual ad-hoc) em
 * `lib/component-specs/spec-schema.ts` por validação declarativa.
 *
 * USO:
 *   import { ComponentSpecSchema, validateSpec } from '@/lib/schemas/component-spec';
 *   const spec = validateSpec(rawYaml); // throw se inválido
 *   const safe = ComponentSpecSchema.safeParse(raw); // sem throw
 */
import { z } from 'zod';

const CATEGORIES = [
  'messaging',
  'navigation',
  'media',
  'integration',
  'ai',
  'structure',
  'auto',
] as const;

const FLOW_CONTROLS = ['linear', 'parallel', 'leaf', 'none'] as const;

const FIELD_TYPES = ['string', 'number', 'boolean', 'array', 'object'] as const;

const ComponentFieldSchema: z.ZodType<unknown> = z.lazy(() =>
  z
    .object({
      type: z.enum(FIELD_TYPES),
      itemType: z.enum(['string', 'number', 'object']).optional(),
      required: z.boolean().optional(),
      description: z.string(),
      aiHint: z.string().optional(),
      default: z.unknown().optional(),
      visible: z.boolean().optional(),
      enum: z.array(z.string()).optional(),
      fields: z.record(z.string(), ComponentFieldSchema).optional(),
    })
    .passthrough()
);

const AutoChildSchema = z.object({
  nodeType: z.string(),
  labelTemplate: z.string(),
  relativePosition: z
    .object({ x: z.number(), y: z.number() })
    .optional(),
  description: z.string().optional(),
});

const BuilderRulesSchema = z.object({
  autoChildren: z.array(AutoChildSchema).optional(),
  edgeFromPrevious: z.boolean().optional(),
  updatesLastFlowId: z.boolean().optional(),
  sideEffectOnPrevious: z
    .object({
      whenPreviousIsKind: z.array(z.string()),
      addChild: AutoChildSchema,
    })
    .optional(),
});

const ComponentExampleSchema = z.object({
  description: z.string(),
  input: z.string(),
  output: z.unknown(),
  note: z.string().optional(),
});

/**
 * `nodeType` é union: string OU array de strings (alguns kinds mapeiam pra
 * múltiplos node types, ex: media → midia-imagem-bot, midia-documento-bot, etc).
 */
const NodeTypeSchema = z.union([z.string(), z.array(z.string())]);

export const ComponentSpecSchema = z
  .object({
    id: z.string().min(1, 'id vazio'),
    displayName: z.string().min(1, 'displayName vazio'),
    icon: z.string().min(1, 'icon vazio'),
    category: z.enum(CATEGORIES),
    nodeType: NodeTypeSchema,
    flowControl: z.enum(FLOW_CONTROLS),
    description: z.string().min(1, 'description vazia'),
    usageRules: z.array(z.string()).optional(),
    detectionCues: z.array(z.string()).optional(),
    commonMistakes: z.array(z.string()).optional(),
    fields: z.record(z.string(), ComponentFieldSchema).optional(),
    builderRules: BuilderRulesSchema.optional(),
    examples: z.array(ComponentExampleSchema).optional(),
    aiInstructions: z.string().optional(),
  })
  .passthrough();

export type ComponentSpecParsed = z.infer<typeof ComponentSpecSchema>;

/**
 * Valida um spec ou lança erro descritivo. Lista até 5 issues.
 */
export function validateSpec(input: unknown): ComponentSpecParsed {
  const result = ComponentSpecSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`)
      .join('; ');
    throw new Error(`ComponentSpec inválido — ${issues}`);
  }
  return result.data;
}
