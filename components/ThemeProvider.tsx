'use client';

/**
 * Theme Provider — gerencia dark/light mode.
 *
 * Estratégia:
 *  - Lê preferência salva em localStorage (`fluxo-theme`)
 *  - Se nada salvo, usa `prefers-color-scheme` do OS
 *  - Aplica classe `dark` no <html> (Tailwind darkMode: 'class')
 *  - Expõe `useTheme()` hook pra ler/mudar
 *
 * SSR-safe: o useEffect inicial roda só no client (evita hidration mismatch).
 * Pra esconder flash de tema errado, um script inline no <head> pode setar
 * a classe antes da hidration (não fizemos — flash é mínimo com SSR).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  /** Tema configurado pelo user (pode ser 'system'). */
  theme: Theme;
  /** Tema RESOLVIDO em uso (sempre 'light' ou 'dark', nunca 'system'). */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'fluxo-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Init: lê preferência salva
  useEffect(() => {
    const stored = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as Theme | null;
    const initial: Theme = stored ?? 'system';
    setThemeState(initial);
  }, []);

  // Resolve tema efetivo (escuta mudança no OS quando theme='system')
  useEffect(() => {
    const compute = () => {
      const next = theme === 'system' ? getSystemTheme() : theme;
      setResolvedTheme(next);
      applyTheme(next);
    };
    compute();

    if (theme === 'system' && typeof window !== 'undefined') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', compute);
      return () => mql.removeEventListener('change', compute);
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme deve ser usado dentro de <ThemeProvider>');
  }
  return ctx;
}
