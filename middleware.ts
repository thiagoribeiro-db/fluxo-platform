import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';

/**
 * Middleware Supabase — atualiza o cookie da sessão a cada request server-side
 * e protege as rotas privadas. Roda em TODO request (exceto assets estáticos).
 *
 * Rotas protegidas: /dashboard, /editor/*, /projects/*
 * Rotas públicas: /, /login, /auth/*, /share/* (share link), /api/public/*
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Rotas DEV-ONLY (livre de auth) usadas pra testar export PDF
  // autonomamente. Bloqueadas em produção pelo próprio handler.
  if (
    process.env.NODE_ENV !== 'production' &&
    (request.nextUrl.pathname.startsWith('/dev-preview') ||
      request.nextUrl.pathname.startsWith('/api/dev/'))
  ) {
    return response;
  }

  const { url, key } = getSupabaseEnv();

  // Modo dev sem Supabase configurado: deixa tudo passar (apenas /editor/demo
  // funciona, rotas privadas vão dar erro 500 ao tentar consultar o banco).
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() força o refresh do token se necessário.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rotas que exigem autenticação
  const protectedPaths = ['/dashboard', '/editor', '/projects'];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  // Rotas públicas que NÃO devem ser acessadas se já logado
  const authPaths = ['/login'];
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    // Não autenticado tentando acessar rota privada → manda pra /login
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPage && user) {
    // Já logado tentando acessar /login → manda pro dashboard
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, EXCETO:
     * - _next/static, _next/image (assets do Next)
     * - favicon.ico, *.svg, *.png, *.jpg, *.jpeg, *.gif, *.webp
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
