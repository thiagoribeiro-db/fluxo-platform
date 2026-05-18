import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from './env';

export { isSupabaseConfigured } from './env';

/**
 * Cria um Supabase client server-side, usando cookies para manter sessão.
 *
 * Lança se as env vars não estiverem definidas — use isSupabaseConfigured()
 * antes em rotas opcionais (ex.: home page).
 */
export function createClient() {
  const { url, key } = getSupabaseEnv();

  if (!url || !key) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em .env.local'
    );
  }

  const cookieStore = cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // server component — pode ignorar (middleware fará refresh)
        }
      },
    },
  });
}
