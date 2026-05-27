'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { PlatformRole } from '@/lib/auth/roles';
import { getMyProfile } from '@/lib/auth/roles';

export interface PlatformUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  platform_role: PlatformRole;
  created_at: string;
}

/**
 * Lista todos os usuários cadastrados na plataforma.
 * Requer role admin ou superAdmin.
 */
export async function listPlatformUsers(): Promise<PlatformUser[]> {
  const supabase = createClient();

  const me = await getMyProfile();
  if (!me || (me.platform_role !== 'admin' && me.platform_role !== 'superAdmin')) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, platform_role, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('listPlatformUsers error:', error);
    return [];
  }

  return (data ?? []) as PlatformUser[];
}

/**
 * Atualiza o platform_role de um usuário.
 * Apenas superAdmins podem promover/regredir outros usuários.
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: PlatformRole
): Promise<{ ok: boolean; error?: string }> {
  const me = await getMyProfile();
  if (!me || me.platform_role !== 'superAdmin') {
    return { ok: false, error: 'Apenas Super Admins podem alterar perfis.' };
  }

  if (targetUserId === me.id) {
    return { ok: false, error: 'Você não pode alterar seu próprio perfil aqui.' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ platform_role: newRole })
    .eq('id', targetUserId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/settings');
  return { ok: true };
}
