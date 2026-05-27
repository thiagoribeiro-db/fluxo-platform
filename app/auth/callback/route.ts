import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Callback do magic link / OAuth.
 *
 * Supabase redireciona o usuário aqui com `?code=...&next=...`.
 * Trocamos o code pela session (setando o cookie httpOnly) e redirecionamos
 * para `next` (ou /dashboard como fallback).
 *
 * Para Google OAuth: após criar a session, sincroniza display_name e avatar_url
 * do provider Google no profile do usuário.
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
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Sincroniza dados do Google no profile (nome e avatar)
  const user = sessionData?.user;
  if (user) {
    const googleName =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      null;
    const googleAvatar =
      user.user_metadata?.avatar_url ??
      user.user_metadata?.picture ??
      null;

    if (googleName || googleAvatar) {
      await supabase
        .from('profiles')
        .update({
          ...(googleName ? { display_name: googleName } : {}),
          ...(googleAvatar ? { avatar_url: googleAvatar } : {}),
        })
        .eq('id', user.id);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
