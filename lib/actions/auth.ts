'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { devLog, devWarn } from '@/lib/utils/logger';

/**
 * Resolve a URL base para o redirect OAuth.
 * Reutilizado por sendMagicLink e signInWithGoogle.
 */
function resolveBaseUrl(headerList: ReturnType<typeof headers>): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl.replace(/\/$/, '');
  }
  const forwardedHost = headerList.get('x-forwarded-host');
  const forwardedProto = headerList.get('x-forwarded-proto');
  const host = forwardedHost ?? headerList.get('host');
  const proto = forwardedProto ?? (host?.includes('localhost') ? 'http' : 'https');
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

/**
 * Inicia o fluxo de login com Google OAuth.
 * Redireciona o browser para a URL de autorização do Google.
 */
export async function signInWithGoogle(formData?: FormData) {
  const supabase = createClient();
  const headerList = headers();
  const baseUrl = resolveBaseUrl(headerList);
  const next = (formData?.get('next') as string | null) ?? '/dashboard';

  const redirectTo = `${baseUrl}/auth/callback${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`;

  devLog('[signInWithGoogle] redirectTo:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error || !data?.url) {
    redirect(
      `/login?error=${encodeURIComponent(error?.message ?? 'Falha ao iniciar login com Google')}`
    );
  }

  redirect(data.url);
}

/**
 * Envia um magic link para o e-mail informado e redireciona para
 * /login?sent=1 (sucesso) ou /login?error=... (erro).
 *
 * Resolve a URL base na ORDEM:
 *  1. process.env.NEXT_PUBLIC_APP_URL — se setado explicitamente
 *  2. Headers da request (x-forwarded-host + x-forwarded-proto) — quando atrás
 *     de proxy/load balancer (Vercel, etc.)
 *  3. Host header simples + https://
 *  4. Fallback: http://localhost:3000 (dev local sem env var)
 *
 * Isso evita o bug onde `NEXT_PUBLIC_APP_URL` esquecido no Vercel faz o magic
 * link apontar pro localhost.
 */
export async function sendMagicLink(email: string, next?: string) {
  const supabase = createClient();
  const headerList = headers();
  const baseUrl = resolveBaseUrl(headerList);

  const redirectTo = `${baseUrl}/auth/callback${
    next ? `?next=${encodeURIComponent(next)}` : ''
  }`;

  devLog('[sendMagicLink] redirectTo:', redirectTo);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/login?sent=1');
}

/**
 * Encerra a sessão e volta pra home.
 */
export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/');
}
