/**
 * Funções server-only de autenticação e role.
 * NÃO importe este arquivo em Client Components — use role-constants.ts.
 */
import { createClient } from '@/lib/supabase/server';

export type { PlatformRole } from './role-constants';
export { ROLE_LABELS, ROLE_TABS, hasMinRole } from './role-constants';

/**
 * Retorna o profile completo do usuário autenticado.
 * Deve ser chamado apenas em Server Components / Server Actions.
 */
export async function getMyProfile(): Promise<{
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  platform_role: import('./role-constants').PlatformRole;
} | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, platform_role')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    platform_role: (data.platform_role ?? 'editor') as import('./role-constants').PlatformRole,
  };
}

/**
 * Retorna o platform_role do usuário autenticado atual.
 */
export async function getMyPlatformRole(): Promise<import('./role-constants').PlatformRole> {
  const supabase = createClient();
  const { data } = await supabase.rpc('get_my_platform_role');
  if (data && ['editor', 'admin', 'superAdmin'].includes(data)) {
    return data as import('./role-constants').PlatformRole;
  }
  return 'editor';
}
