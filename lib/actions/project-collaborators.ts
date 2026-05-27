'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ProjectCollaborator {
  id: string;
  project_id: string;
  user_id: string;
  invited_by: string;
  permission: 'view' | 'edit';
  created_at: string;
  profile: {
    email: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

/**
 * Lista os colaboradores de um projeto.
 */
export async function listProjectCollaborators(
  projectId: string
): Promise<ProjectCollaborator[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('project_collaborators')
    .select(`
      id, project_id, user_id, invited_by, permission, created_at,
      profile:profiles!project_collaborators_user_id_fkey(email, display_name, avatar_url)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('listProjectCollaborators error:', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    ...row,
    profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
  })) as ProjectCollaborator[];
}

/**
 * Busca um usuário pelo e-mail (para o lookup de compartilhamento).
 * Retorna null se o usuário não estiver cadastrado na plataforma.
 */
export async function findUserByEmail(
  email: string
): Promise<{ id: string; display_name: string | null; avatar_url: string | null } | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  return data ?? null;
}

/**
 * Adiciona um colaborador a um projeto pelo e-mail.
 * Retorna erro se o usuário não for encontrado na plataforma.
 */
export async function addProjectCollaborator(
  projectId: string,
  email: string,
  permission: 'view' | 'edit' = 'edit'
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();

  // Verifica se o usuário existe
  const user = await findUserByEmail(email);
  if (!user) {
    return {
      ok: false,
      error: `Usuário com e-mail "${email}" não encontrado na plataforma. Peça que ele acesse a plataforma primeiro para criar sua conta.`,
    };
  }

  // Pega o usuário autenticado
  const {
    data: { user: me },
  } = await supabase.auth.getUser();
  if (!me) return { ok: false, error: 'Não autenticado.' };

  // Não pode compartilhar consigo mesmo
  if (user.id === me.id) {
    return { ok: false, error: 'Você não pode compartilhar o projeto com você mesmo.' };
  }

  const { error } = await supabase.from('project_collaborators').insert({
    project_id: projectId,
    user_id: user.id,
    invited_by: me.id,
    permission,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Este usuário já tem acesso a este projeto.' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard');
  return { ok: true };
}

/**
 * Remove um colaborador de um projeto.
 */
export async function removeProjectCollaborator(
  collaboratorId: string,
  projectId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('project_collaborators')
    .delete()
    .eq('id', collaboratorId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard');
  return { ok: true };
}
