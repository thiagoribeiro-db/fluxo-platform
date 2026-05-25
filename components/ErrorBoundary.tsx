'use client';

/**
 * ErrorBoundary — wrapper React pra isolar crash de componente.
 *
 * Sem isso, um erro em um node-type derruba a TELA INTEIRA (página em
 * branco). Com isso, mostramos fallback amigável + botão de reload e
 * Sentry captura o erro pra investigação.
 *
 * Uso:
 *   <ErrorBoundary fallbackTitle="Editor falhou">
 *     <FlowEditor ... />
 *   </ErrorBoundary>
 *
 * Posicionar em camadas — quanto mais "embrulhado", menor o blast radius
 * de um crash. App root + features pesadas (editor, dialogs grandes).
 */

import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Título do card de erro (curto, ex: "Editor falhou"). */
  fallbackTitle?: string;
  /** Texto auxiliar (ex: "Tentamos recarregar automaticamente"). */
  fallbackHint?: string;
  /** Callback opcional pra log local extra. Sentry já é chamado. */
  onError?: (error: Error, info: { componentStack: string | null }) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: { componentStack: string | null }) {
    // Envia pro Sentry com contexto extra (componentStack ajuda a localizar)
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: info.componentStack ?? '(none)',
        },
      },
    });
    this.props.onError?.(error, info);
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary] caught:', error, info);
    }
  }

  reset = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.fallbackTitle ?? 'Algo deu errado';
    const hint =
      this.props.fallbackHint ??
      'Tente recarregar a página. Se persistir, o erro foi reportado.';

    return (
      <div
        role="alert"
        className="m-4 rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
      >
        <h2 className="text-base font-bold">⚠ {title}</h2>
        <p className="mt-1 text-sm">{hint}</p>
        {this.state.errorMessage && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-red-700 dark:text-red-300">
              Detalhes técnicos
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-red-100 p-2 text-[10px] dark:bg-red-900/30">
              {this.state.errorMessage}
            </pre>
          </details>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900"
          >
            Tentar de novo
          </button>
          <button
            type="button"
            onClick={this.reload}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}
