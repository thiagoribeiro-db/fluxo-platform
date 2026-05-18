'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard', label: 'Projetos', icon: '📋' },
  { href: '/dashboard/components', label: 'Componentes', icon: '🧩' },
] as const;

/**
 * Nav horizontal de abas exibido abaixo do topbar. Visualmente parece com
 * abas de pasta — borda inferior contínua, aba ativa "elevada" com cor
 * blip-purple.
 */
export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 -mb-px">
      {TABS.map((tab) => {
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
