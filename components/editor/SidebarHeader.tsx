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

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface SidebarHeaderProps {
  collapsed: boolean;
  isShared: boolean;
  projectName?: string;
  statusLabel: string;
}

export default function SidebarHeader({
  collapsed,
  isShared,
  projectName,
  statusLabel,
}: SidebarHeaderProps) {
  // Modo colapsado — só o ícone de voltar, bem compacto pra caber na barra fina
  if (collapsed) {
    if (isShared) {
      return null;
    }
    return (
      <div className="flex items-center justify-center pt-2 shrink-0">
        <Link
          href="/dashboard"
          className="w-7 h-7 flex items-center justify-center text-blip-purple hover:bg-blip-purple/10 rounded-md transition-colors"
          title="Voltar pro dashboard"
        >
          <ArrowLeft size={14} />
        </Link>
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
    </Link>
  );
}
