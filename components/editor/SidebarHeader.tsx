'use client';

/**
 * Header da sidebar esquerda do editor — substitui o antigo `<Panel top-left>`
 * que era sobreposto pela toolbar central. Aqui fica:
 *
 *  - Link "voltar pro dashboard" (esconde em share read-only)
 *  - Nome do projeto
 *  - Status (Autosave ativo / Visualização / Demo)
 *
 * Quando a sidebar está colapsada (48px), mostra apenas o ícone seta.
 */

import { memo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface SidebarHeaderProps {
  collapsed: boolean;
  isShared: boolean;
  projectName?: string;
  statusLabel: string;
}

/**
 * Memoizado — props são primitivos simples (booleans + strings curtas).
 * Não precisa re-renderizar a cada mudança do canvas.
 */
function SidebarHeaderImpl({
  collapsed,
  isShared,
  projectName,
  statusLabel,
}: SidebarHeaderProps) {
  // Modo colapsado — só o ícone de voltar + theme toggle, bem compacto
  if (collapsed) {
    if (isShared) {
      return (
        <div className="flex flex-col items-center pt-2 gap-1 shrink-0">
          <ThemeToggle iconSize={14} />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center pt-2 gap-1 shrink-0">
        <Link
          href="/dashboard"
          className="w-7 h-7 flex items-center justify-center text-blip-purple hover:bg-blip-purple/10 rounded-md transition-colors"
          title="Voltar pro dashboard"
        >
          <ArrowLeft size={14} />
        </Link>
        <ThemeToggle iconSize={14} />
      </div>
    );
  }

  // Modo expandido — header destacado em roxo Blip, com link "voltar" integrado
  if (isShared) {
    return (
      <header className="bg-blip-purple text-white px-3 py-2.5 shrink-0">
        <div className="text-sm font-semibold truncate" title={projectName}>
          {projectName ?? 'Fluxo Platform'}
        </div>
        <div className="text-[11px] text-white/70 mt-0.5 truncate">
          {statusLabel}
        </div>
      </header>
    );
  }

  return (
    <Link
      href="/dashboard"
      data-tour="sidebar-header"
      className="group bg-blip-purple hover:bg-blip-purple-dark active:bg-blip-purple-dark text-white px-3 py-2.5 flex items-start gap-2 shrink-0 transition-colors"
      title="Voltar pro dashboard"
    >
      <ArrowLeft
        size={16}
        className="shrink-0 mt-0.5 transition-transform group-hover:-translate-x-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">
          {projectName ?? 'Fluxo Platform'}
        </div>
        <div className="text-[11px] text-white/70 mt-0.5 truncate">
          {statusLabel}
        </div>
      </div>
      {/* ThemeToggle dentro do header roxo — não navega no click */}
      <div
        className="shrink-0"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <ThemeToggle
          iconSize={14}
          className="text-white/80 hover:text-white hover:bg-white/10"
        />
      </div>
    </Link>
  );
}

const SidebarHeader = memo(SidebarHeaderImpl);
export default SidebarHeader;
