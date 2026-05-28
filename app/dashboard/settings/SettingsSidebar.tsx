'use client';

/**
 * Sidebar de navegação vertical da página de Configurações.
 *
 * Filtra seções pelo `platform_role` do user (algumas só Admin+).
 * Active state baseado em `usePathname()`.
 *
 * Layout: coluna fixa à esquerda no desktop. Em mobile (lg:hidden) vira
 * uma row horizontal scrollável no topo.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { PlatformRole } from '@/lib/auth/role-constants';
import { getVisibleSections } from './_sections';

export default function SettingsSidebar({ role }: { role: PlatformRole }) {
  const pathname = usePathname();
  const visibleSections = getVisibleSections(role);

  return (
    <>
      {/* Mobile — horizontal scroll */}
      <nav className="lg:hidden -mx-6 px-6 mb-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {visibleSections.map((s) => {
            const active = pathname.startsWith(s.href);
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`shrink-0 flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                  active
                    ? 'border-blip-purple text-blip-purple bg-blip-purple/5'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                <span>{s.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop — vertical sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <nav className="space-y-1 sticky top-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-3 mb-2">
            Áreas
          </h2>
          {visibleSections.map((s) => {
            const active = pathname.startsWith(s.href);
            const Icon = s.icon;
            return (
              <SidebarItem key={s.href} href={s.href} active={active}>
                <div className="flex items-start gap-3">
                  <Icon
                    size={16}
                    className={`mt-0.5 shrink-0 ${
                      active ? 'text-blip-purple' : 'text-gray-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm font-medium ${
                        active ? 'text-blip-purple-dark' : 'text-gray-900'
                      }`}
                    >
                      {s.label}
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 leading-tight ${
                        active ? 'text-blip-purple/70' : 'text-gray-500'
                      }`}
                    >
                      {s.description}
                    </div>
                  </div>
                </div>
              </SidebarItem>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function SidebarItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2.5 rounded-lg transition border ${
        active
          ? 'bg-blip-purple/5 border-blip-purple/30 ring-1 ring-blip-purple/10'
          : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
      }`}
    >
      {children}
    </Link>
  );
}
