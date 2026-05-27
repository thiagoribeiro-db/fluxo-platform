import Link from 'next/link';
import Image from 'next/image';
import { HelpCircle } from 'lucide-react';
import { signOut } from '@/lib/actions/auth';
import { getMyProfile } from '@/lib/auth/roles';
import DashboardTabs from './DashboardTabs';
import HelpHotkey from './HelpHotkey';

/**
 * Layout compartilhado entre /dashboard (projetos) e /dashboard/components.
 *
 * Topbar + Nav de abas ficam aqui — só o conteúdo central muda por rota.
 * A nav filtra as abas de acordo com o platform_role do usuário.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getMyProfile();
  const role = profile?.platform_role ?? 'editor';
  const avatarUrl = profile?.avatar_url ?? null;
  const displayName = profile?.display_name ?? profile?.email ?? '';

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

            {/* Avatar + nome */}
            <div className="flex items-center gap-2">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={28}
                  height={28}
                  className="rounded-full border border-gray-200"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blip-purple/10 flex items-center justify-center text-xs font-semibold text-blip-purple">
                  {(displayName[0] ?? '?').toUpperCase()}
                </div>
              )}
              <span className="text-sm text-gray-600 hidden sm:block max-w-[160px] truncate">
                {displayName}
              </span>
            </div>

            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-blip-purple transition-colors"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        {/* Nav de abas — filtra por role */}
        <div className="max-w-6xl mx-auto px-6">
          <DashboardTabs role={role} />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>

      {/* Atalho global: tecla `?` → /help */}
      <HelpHotkey />
    </main>
  );
}
