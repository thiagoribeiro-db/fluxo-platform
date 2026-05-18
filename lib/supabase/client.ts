import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './env';

export function createClient() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em .env.local'
    );
  }
  return createBrowserClient(url, key);
}
