/**
 * Schemas Zod pras server actions principais.
 *
 * Por que existem:
 *  1. Validar input antes da query (defensive — nunca confiar no client)
 *  2. Produzir erros estruturados — não `throw new Error('msg')` solto
 *  3. Auto-documentação: schema vira contrato visível
 *
 * Padrão de uso:
 *
 *   import { CreateCommentInput } from '@/lib/schemas/actions';
 *
 *   export async function createComment(raw: unknown) {
 *     const parsed = CreateCommentInput.safeParse(raw);
 *     if (!parsed.success) {
 *       return { ok: false, error: { code: 'invalid_input', issues: parsed.error.issues } };
 *     }
 *     // ... usa parsed.data
 *   }
 */

import { z } from 'zod';

// =============================================================================
// PROJECT
// =============================================================================

export const CreateProjectInput = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(120, 'Nome muito longo'),
  description: z.string().max(2000).nullable().optional(),
  visibility: z.enum(['private', 'org', 'public']).default('private'),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  visibility: z.enum(['private', 'org', 'public']).optional(),
  status: z.enum(['draft', 'review', 'approved', 'archived']).optional(),
  estimated_hours: z.number().nonnegative().max(10000).nullable().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;

// =============================================================================
// COMMENT
// =============================================================================

export const CreateCommentInput = z.object({
  projectId: z.string().uuid('projectId inválido'),
  body: z
    .string()
    .trim()
    .min(1, 'Comentário não pode estar vazio')
    .max(5000, 'Comentário muito longo'),
  nodeId: z.string().nullable().optional(),
  positionX: z.number().nullable().optional(),
  positionY: z.number().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

// =============================================================================
// SHARE
// =============================================================================

export const CreateShareInput = z.object({
  projectId: z.string().uuid(),
  permission: z.enum(['view', 'comment', 'edit']).default('view'),
  expiresInDays: z.number().int().positive().max(365).optional(),
});
export type CreateShareInput = z.infer<typeof CreateShareInput>;

// =============================================================================
// TEMPLATE
// =============================================================================

export const ApplyTemplateInput = z.object({
  projectId: z.string().uuid(),
  templateName: z.enum(['varejo-exemplo', 'saude-clinica']),
  pageId: z.string().uuid().optional(),
});
export type ApplyTemplateInput = z.infer<typeof ApplyTemplateInput>;

// =============================================================================
// Helper de erro estruturado
// =============================================================================

/**
 * Pega um `ZodError` e produz um erro amigável estruturado.
 * Concatena issues em mensagem humana + lista os campos com problema.
 */
export function formatZodError(error: z.ZodError): {
  message: string;
  fields: Record<string, string>;
} {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    fields[path] = issue.message;
  }
  const message = error.issues
    .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
    .join('; ');
  return { message, fields };
}
