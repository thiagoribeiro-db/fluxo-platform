import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Callback do magic link / OAuth.
 *
 * Supabase redireciona o usuário aqui com `?code=...&next=...`.
 * Trocamos o code pela session (setando o cookie httpOnly) e redirecionamos
 * para `next` (ou /dashboard como fallback).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Link inválido ou expirado')}`
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
