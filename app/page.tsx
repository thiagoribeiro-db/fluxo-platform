import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let user = null;
  let supabaseReady = false;

  if (isSupabaseConfigured()) {
    supabaseReady = true;
    try {
      const supabase = createClient();
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      user = u;
    } catch {
      // ignora — se falhar, tratamos como deslogado
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blip-purple to-blip-purple-dark text-white p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">🚀 Fluxo Platform</h1>
        <p className="text-xl opacity-90">
          Editor visual de fluxos conversacionais para chatbots Blip/Digitalbot.
        </p>

        {!supabaseReady && (
          <div className="bg-yellow-400/20 border border-yellow-300/40 rounded-lg p-4 text-sm">
            ⚠️ Supabase ainda não configurado. Configure <code>.env.local</code> (veja README) — por enquanto só o <strong>/editor/demo</strong> funciona.
          </div>
        )}

        <div className="flex flex-wrap gap-4 justify-center pt-6">
          {supabaseReady && user ? (
            <Link
              href="/dashboard"
              className="bg-white text-blip-purple px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition"
            >
              Ir para meus projetos →
            </Link>
          ) : supabaseReady ? (
            <Link
              href="/login"
              className="bg-white text-blip-purple px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition"
            >
              Entrar →
            </Link>
          ) : null}
          <Link
            href="/editor/demo"
            className={`${
              supabaseReady
                ? 'border-2 border-white text-white hover:bg-white/10'
                : 'bg-white text-blip-purple hover:bg-gray-100'
            } px-8 py-3 rounded-full font-semibold transition`}
          >
            Ver demo
          </Link>
        </div>

        <div className="text-sm opacity-70 pt-8 space-y-1">
          <p>Stack: Next.js 14 · React Flow · Supabase · Tailwind</p>
          <p>Build: Fase 2 — Auth + CRUD de projetos</p>
        </div>
      </div>
    </main>
  );
}
