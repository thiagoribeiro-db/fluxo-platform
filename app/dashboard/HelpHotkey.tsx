'use client';

/**
 * HelpHotkey — listener global que abre `/help` ao apertar `?`.
 *
 * No editor, `?` abre o cheatsheet de atalhos (já implementado lá).
 * Fora do editor (dashboard, settings, etc.), `?` navega pra página
 * de ajuda completa. Comportamento consistente — em qualquer tela,
 * apertar `?` traz ajuda.
 *
 * Ignora quando o foco está em input/textarea ou contenteditable
 * (pra não interferir em campos de texto).
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HelpHotkey() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '?') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (target?.isContentEditable) return;
      e.preventDefault();
      router.push('/help');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return null;
}
