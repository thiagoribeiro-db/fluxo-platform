/**
 * Sentry — client-side error tracking.
 *
 * Inicializa SÓ se NEXT_PUBLIC_SENTRY_DSN estiver setado (caso contrário
 * vira no-op, sem custo). Use isso pra que o projeto rode tanto local
 * (sem DSN) quanto em prod (com DSN no Vercel).
 *
 * Pra desligar em algum ambiente específico, basta não setar a env var.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sample rate de performance: 10% em prod, 100% em dev
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Replay só de sessões com erro (poupa bandwidth)
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    environment: process.env.NODE_ENV,
    // Não envia eventos em dev (testes/local) — comente se quiser ver eventos local
    enabled: process.env.NODE_ENV === 'production',
  });
}
