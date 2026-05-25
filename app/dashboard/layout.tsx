import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/actions/auth';
import DashboardTabs from './DashboardTabs';
import HelpHotkey from './HelpHotkey';

/**
 * Layout compartilhado entre /dashboard (projetos) e /dashboard/components.
 *
 * Topbar + Nav de abas ficam aqui — só o conteúdo central muda por rota.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-blip-purple">
            🚀 Fluxo Platform
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/help"
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-blip-purple hover:bg-blip-purple/5 px-2 py-1 rounded-md transition-colors"
              title="Documentação das funcionalidades"
            >
              <HelpCircle size={16} />
              <span className="hidden sm:inline">Ajuda</span>
            </Link>
            <span className="text-sm text-gray-600">{user?.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-gray-600 hover:text-blip-purple"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        {/* Nav de abas — destaca a rota atual */}
        <div className="max-w-6xl mx-auto px-6">
          <DashboardTabs />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>

      {/* Atalho global: tecla `?` → /help */}
      <HelpHotkey />
    </main>
  );
}
