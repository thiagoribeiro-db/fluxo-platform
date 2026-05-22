'use client';

/**
 * QueryClientProvider — habilita TanStack Query no app inteiro.
 *
 * Cliente único, defaults conservadores:
 *  - staleTime: 30s (dados ficam frescos por 30s antes de refetch ao remount)
 *  - refetchOnWindowFocus: true (revalida quando user volta pra aba)
 *  - retry: 1 (1 retry em fail)
 *
 * O QueryClient é criado UMA vez por mount via useState. Em SSR/Next App
 * Router, isso garante que cada request server-side tem seu próprio cache
 * (sem vazamento entre users).
 */
import {
  QueryClient,
  QueryClientProvider as TanstackQueryClientProvider,
} from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <TanstackQueryClientProvider client={client}>
      {children}
    </TanstackQueryClientProvider>
  );
}
