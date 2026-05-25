'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  CreateCommentInput as CreateCommentSchema,
  formatZodError,
} from '@/lib/schemas/actions';

export interface Comment {
  id: string;
  project_id: string;
  node_id: string | null;
  position_x: number | null;
  position_y: number | null;
  parent_id: string | null;
  body: string;
  /** NULL quando o comment foi criado por um usuário EXTERNO (via share link). */
  author_id: string | null;
  author_email: string | null;
  author_display_name: string | null;
  /** Nome preenchido pelo cliente no form da página /share/[token]. */
  external_author_name: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Lista TODOS os comentários do projeto, com nome do autor (via RPC).
 * Retorna lista plana ordenada por created_at — agrupar em threads no client.
 */
export async function listComments(projectId: string): Promise<Comment[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('list_project_comments', {
    p_project_id: projectId,
  });
  if (error) {
    console.error('listComments error:', error);
    return [];
  }
  return (data ?? []) as Comment[];
}

interface CreateCommentInput {
  projectId: string;
  body: string;
  nodeId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  parentId?: string | null;
}

/**
 * Cria um comentário novo.
 *  - Ancorado em nó: passar `nodeId`
 *  - Flutuante: passar `positionX/Y`
 *  - Reply: passar `parentId`
 *
 * Retorna o ID criado (o client refaz listComments).
 */
export async function createComment(input: CreateCommentInput): Promise<string> {
  // Validação Zod — falha em input malformado ANTES de tocar no Supabase.
  // Mantém a assinatura antiga (throw) pra compat com callers existentes;
  // migração pro padrão Result fica em fase futura.
  const parsed = CreateCommentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Input inválido: ${formatZodError(parsed.error).message}`);
  }
  const validated = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('comments')
    .insert({
      project_id: validated.projectId,
      body: validated.body,
      node_id: validated.nodeId ?? null,
      position_x: validated.positionX ?? null,
      position_y: validated.positionY ?? null,
      parent_id: validated.parentId ?? null,
      author_id: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar comentário: ${error?.message}`);
  }

  revalidatePath(`/editor/${validated.projectId}`);
  return data.id as string;
}

export async function updateComment(
  id: string,
  projectId: string,
  body: string
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('comments')
    .update({ body })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(`Falha ao atualizar: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      'Nada foi atualizado. Verifique se a migration 005 está aplicada.'
    );
  }
  revalidatePath(`/editor/${projectId}`);
}

export async function deleteComment(id: string, projectId: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw new Error(`Falha ao deletar: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      'Nada foi deletado. Verifique se a migration 005 está aplicada.'
    );
  }
  revalidatePath(`/editor/${projectId}`);
}

// =============================================================================
// EXTERNAL — usuário acessando via /share/[token] sem login
// =============================================================================

/**
 * Lista comentários do projeto via share token. Usada na página pública
 * `/share/[token]`. A RPC valida o token e ignora membership na org.
 */
export async function listShareComments(token: string): Promise<Comment[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('list_share_comments', {
    p_token: token,
  });
  if (error) {
    console.error('listShareComments error:', error);
    return [];
  }
  return (data ?? []) as Comment[];
}

interface CreateShareCommentInput {
  token: string;
  authorName: string;
  body: string;
  nodeId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  parentId?: string | null;
}

/**
 * Cria comentário via share token. Não exige login. Valida no DB que
 * o token tem `permission ∈ ('comment', 'edit')`.
 */
export async function createShareComment(
  input: CreateShareCommentInput
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_share_comment', {
    p_token: input.token,
    p_author_name: input.authorName,
    p_body: input.body,
    p_node_id: input.nodeId ?? null,
    p_position_x: input.positionX ?? null,
    p_position_y: input.positionY ?? null,
    p_parent_id: input.parentId ?? null,
  });
  if (error) {
    throw new Error(`Falha ao criar comentário: ${error.message}`);
  }
  return data as string;
}

/**
 * Marca/desmarca uma thread como resolvida.
 */
export async function setCommentResolved(
  id: string,
  projectId: string,
  resolved: boolean
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('comments')
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? user.id : null,
    })
    .eq('id', id)
    .select('id, resolved_at');

  if (error) {
    throw new Error(`Falha ao resolver: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error(
      'Nada foi atualizado. Verifique se a migration 005 (policies UPDATE/DELETE) está aplicada no Supabase.'
    );
  }
  revalidatePath(`/editor/${projectId}`);
}
