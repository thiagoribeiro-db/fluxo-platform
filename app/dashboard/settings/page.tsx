import { redirect } from 'next/navigation';
import { getMyProfile } from '@/lib/auth/roles';
import { getVisibleSections } from './_sections';

/**
 * Rota raiz `/dashboard/settings` — redireciona pra primeira seção visível
 * conforme o `platform_role` do user (Admin+ vai pra Acessos; Editor vai
 * direto pra Voice & Tone porque não tem acesso a Acessos).
 *
 * O layout `layout.tsx` injeta o sidebar; cada sub-rota injeta o conteúdo.
 */
export default async function SettingsHomePage() {
  const me = await getMyProfile();
  const role = me?.platform_role ?? 'editor';
  const sections = getVisibleSections(role);
  // Fallback defensivo: se nenhuma seção visível (caso improvável), manda
  // pra voice-tone que é universal.
  const first = sections[0]?.href ?? '/dashboard/settings/voice-tone';
  redirect(first);
}
