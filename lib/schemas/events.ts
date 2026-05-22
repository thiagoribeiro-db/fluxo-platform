/**
 * Schemas Zod dos payloads de CustomEvents internos.
 *
 * Os eventos são criados/consumidos via `window.dispatchEvent` — TypeScript
 * não consegue checar isso end-to-end (qualquer um pode disparar com
 * payload errado). Estes schemas dão validação runtime defensive em
 * cada handler que escuta.
 *
 * USO no handler:
 *   const result = ToastDetailSchema.safeParse(event.detail);
 *   if (!result.success) { devWarn('toast malformado:', result.error); return; }
 *   const detail = result.data;
 */
import { z } from 'zod';

// =============================================================================
// fluxo:toast
// =============================================================================

export const ToastDetailSchema = z.object({
  level: z.enum(['info', 'success', 'warn', 'error']),
  message: z.string(),
  detail: z.string().optional(),
  duration: z.number().int().min(0).optional(),
});

export type ToastDetailParsed = z.infer<typeof ToastDetailSchema>;

// =============================================================================
// fluxo:dialog (request) + fluxo:dialog-resolve (response)
// =============================================================================

const ConfirmOptsSchema = z.object({
  title: z.string().optional(),
  message: z.string(),
  confirmText: z.string().optional(),
  cancelText: z.string().optional(),
  variant: z.enum(['default', 'danger', 'success']).optional(),
});

const PromptOptsSchema = z.object({
  title: z.string().optional(),
  message: z.string(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  confirmText: z.string().optional(),
  cancelText: z.string().optional(),
  required: z.boolean().optional(),
});

export const DialogRequestSchema = z.object({
  id: z.number(),
  kind: z.enum(['confirm', 'prompt']),
  opts: z.union([ConfirmOptsSchema, PromptOptsSchema]),
});

export const DialogResolvePayloadSchema = z.object({
  id: z.number(),
  /** boolean pra confirm; string pra prompt OK; null pra prompt cancel */
  result: z.union([z.boolean(), z.string(), z.null()]),
});

// =============================================================================
// fluxo:jump-to-frame
// =============================================================================

export const JumpToFrameDetailSchema = z
  .object({
    targetNodeId: z.string().optional(),
    targetFrameId: z.string().optional(),
  })
  .refine(
    (d) => Boolean(d.targetNodeId || d.targetFrameId),
    'targetNodeId ou targetFrameId é obrigatório'
  );

export type JumpToFrameDetailParsed = z.infer<typeof JumpToFrameDetailSchema>;
