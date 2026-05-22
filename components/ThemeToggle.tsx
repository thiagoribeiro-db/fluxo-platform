'use client';

/**
 * Toggle de tema — botão compacto que alterna entre light/dark.
 *
 * Padrão: ícone de Sol quando em dark mode (clique → vai pra light),
 * ícone de Lua quando em light mode (clique → vai pra dark).
 *
 * Use em qualquer lugar (toolbar, header). Tema persistido em localStorage
 * pelo ThemeProvider.
 */
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  className?: string;
  /** Tamanho do ícone em px. Default 16. */
  iconSize?: number;
}

export function ThemeToggle({ className = '', iconSize = 16 }: ThemeToggleProps) {
  const { resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Mudar pra tema claro' : 'Mudar pra tema escuro'}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 dark:text-gray-400 hover:text-blip-purple dark:hover:text-blip-purple hover:bg-blip-purple/10 dark:hover:bg-blip-purple/20 transition-colors ${className}`}
    >
      {isDark ? <Sun size={iconSize} /> : <Moon size={iconSize} />}
      <span className="sr-only">{isDark ? 'Tema claro' : 'Tema escuro'}</span>
    </button>
  );
}
