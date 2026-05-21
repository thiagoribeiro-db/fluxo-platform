'use client';

/**
 * Error boundary global do Next.js — captura erros não-tratados em qualquer
 * page/component dentro de `app/`. Mostra fallback UI + permite retry.
 *
 * Erros em server components ou client components que escaparam de try/catch
 * caem aqui. Reset retorna ao estado anterior.
 */
import { useEffect } from 'react';
import { devError } from '@/lib/utils/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    devError('[app/error] uncaught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">⚠️</span>
          <h1 className="text-xl font-bold text-gray-800">Algo deu errado</h1>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          A página encontrou um erro inesperado. Tente novamente ou volte ao
          início.
        </p>
        {process.env.NODE_ENV !== 'production' && (
          <details className="mb-4 text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-800">
              Detalhes técnicos
            </summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto whitespace-pre-wrap text-[11px] text-gray-700">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-blip-purple text-white rounded hover:opacity-90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}
