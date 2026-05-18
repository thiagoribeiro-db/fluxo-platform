/**
 * Helper centralizado para ler as env vars do Supabase.
 *
 * O Supabase migrou recentemente o nome da chave pública:
 *   - antigo: NEXT_PUBLIC_SUPABASE_ANON_KEY (JWT eyJ...)
 *   - novo:   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...)
 *
 * Aceitamos os dois (publishable tem prioridade quando ambos existem).
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseEnv();
  return !!(url && key);
}
