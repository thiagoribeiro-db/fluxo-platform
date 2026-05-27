'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROLE_TABS, type PlatformRole } from '@/lib/auth/role-constants';

interface DashboardTabsProps {
  role: PlatformRole;
}

/**
 * Nav horizontal de abas exibido abaixo do topbar.
 * As abas visíveis dependem do platform_role do usuário:
 *   editor     → só "Projetos"
 *   admin      → Projetos + Componentes + Configurações
 *   superAdmin → igual a admin
 */
export default function DashboardTabs({ role }: DashboardTabsProps) {
  const pathname = usePathname();
  const tabs = ROLE_TABS[role];

  return (
    <nav className="flex items-center gap-1 -mb-px">
      {tabs.map((tab) => {
        const isActive =
          tab.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              isActive
                ? 'border-blip-purple text-blip-purple bg-blip-purple/5'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
