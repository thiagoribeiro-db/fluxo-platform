/**
 * Next.js 14 instrumentation — registra o Sentry server/edge no startup.
 *
 * Roda UMA vez quando o server inicia (Node OU Edge runtime). É o
 * substituto do antigo `sentry.server.config.ts` carregado via
 * `withSentryConfig`. Recomendado pela própria docs do Sentry pra
 * Next 14+.
 *
 * Os arquivos `sentry.server.config.ts` e `sentry.edge.config.ts`
 * continuam existindo — este register só importa eles condicionalmente
 * conforme o runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
