'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Envia um magic link para o e-mail informado e redireciona para
 * /login?sent=1 (sucesso) ou /login?error=... (erro).
 */
export async function sendMagicLink(email: string, next?: string) {
  const supabase = createClient();

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectTo = `${baseUrl}/auth/callback${
    next ? `?next=${encodeURIComponent(next)}` : ''
  }`;

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
