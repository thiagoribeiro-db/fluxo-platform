'use server';

import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import type { ProjectState, SharePermission } from '@/lib/types';
import { logAuditEvent } from './audit';

export interface Share {
  id: string;
  project_id: string;
  share_token: string;
  permission: SharePermission;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export interface SharedProjectView {
  id: string;
  name: string;
  description: string | null;
  state: ProjectState;
  permission: SharePermission;
  expires_at: string | null;
  updated_at: string;
  /** ID da página ativa do projeto (pra save em modo edit). */
  active_page_id: string | null;
}

/**
 * Lista os shares de um projeto (apenas owner enxerga via RLS).
 */
export async function listShares(projectId: string): Promise<Share[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shares')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listShares error:', error);
    return [];
  }
  return (data ?? []) as Share[];
}

/**
 * Cria um share novo para o projeto.
 */
export async function createShare(
  projectId: string,
  permission: SharePermission = 'view',
  expiresInDays?: number
): Promise<Share> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const token = nanoid(16);
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400_000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('shares')
    .insert({
      project_id: projectId,
      share_token: token,
      permission,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar share: ${error?.message}`);
  }

  await logAuditEvent(projectId, 'share.created', {
    shareId: data.id,
    permission,
    expiresAt,
  });

  revalidatePath(`/editor/${projectId}`);
  return data as Share;
}

/**
 * Revoga (deleta) um share.
 */
export async function revokeShare(shareId: string, projectId: string) {
  const supabase = createClient();
  const { error } = await supabase.from('shares').delete().eq('id', shareId);
  if (error) throw new Error(`Falha ao revogar: ${error.message}`);
  await logAuditEvent(projectId, 'share.revoked', { shareId });
  revalidatePath(`/editor/${projectId}`);
}

/**
 * Salva o state de uma página via share token (modo edit).
 *
 * Funciona pra usuários anônimos — usa RPC SECURITY DEFINER que valida o
 * token, confirma permission='edit' e que a page pertence ao projeto.
 *
 * Lança erro se o token for inválido, expirado ou sem permissão de edição.
 */
export async function saveSharedPageState(
  token: string,
  pageId: string,
  state: ProjectState
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('save_shared_page_state', {
    p_token: token,
    p_page_id: pageId,
    p_state: state,
  });
  if (error) {
    console.error('[saveSharedPageState] error:', error);
    throw new Error(error.message || 'Falha ao salvar via share');
  }
}

/**
 * Salva o state do projeto legado (sem páginas) via share token.
 */
export async function saveSharedProjectState(
  token: string,
  state: ProjectState
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('save_shared_project_state', {
    p_token: token,
    p_state: state,
  });
  if (error) {
    console.error('[saveSharedProjectState] error:', error);
    throw new Error(error.message || 'Falha ao salvar via share');
  }
}

/**
 * Busca o projeto pelo share token. Funciona sem login (RPC SECURITY DEFINER).
 * Retorna null se token inválido ou expirado.
 */
export async function getSharedProject(
  token: string
): Promise<SharedProjectView | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_shared_project', { token })
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('getSharedProject error:', error);
    return null;
  }

  const row = data as {
    id: string;
    name: string;
    description: string | null;
    state: ProjectState;
    permission: SharePermission;
    expires_at: string | null;
    updated_at: string;
    active_page_id: string | null;
  };

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    state: row.state,
    permission: row.permission,
    expires_at: row.expires_at,
    updated_at: row.updated_at,
    active_page_id: row.active_page_id,
  };
}
