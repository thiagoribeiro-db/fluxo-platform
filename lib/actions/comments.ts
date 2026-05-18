'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface Comment {
  id: string;
  project_id: string;
  node_id: string | null;
  position_x: number | null;
  position_y: number | null;
  parent_id: string | null;
  body: string;
  author_id: string;
  author_email: string | null;
  author_display_name: string | null;
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('comments')
    .insert({
      project_id: input.projectId,
      body: input.body,
      node_id: input.nodeId ?? null,
      position_x: input.positionX ?? null,
      position_y: input.positionY ?? null,
      parent_id: input.parentId ?? null,
      author_id: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar comentário: ${error?.message}`);
  }

  revalidatePath(`/editor/${input.projectId}`);
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
