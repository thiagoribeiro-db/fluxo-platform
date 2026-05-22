/**
 * Tratamento central de erros — substituto pros `.catch(() => {})`
 * silenciados e `console.error(...)` que não dão feedback ao usuário.
 *
 * USO:
 *   import { handleError } from '@/lib/utils/errors';
 *
 *   try { await action() }
 *   catch (err) { handleError(err, { context: 'organize-layout' }) }
 *
 * Internamente:
 *   - Loga no console.error com contexto estruturado
 *   - Dispara CustomEvent('fluxo:toast') que o `<Toast />` global escuta
 *
 * Pra producao, é fácil acoplar um Sentry/Datadog aqui.
 */
import { devError } from './logger';

export const FLUXO_TOAST_EVENT = 'fluxo:toast';

export type ToastLevel = 'info' | 'success' | 'warn' | 'error';

export interface ToastDetail {
  level: ToastLevel;
  message: string;
  /** Detalhe técnico opcional — mostrado em fonte menor abaixo. */
  detail?: string;
  /** Duração em ms (default 5000). Use 0 pra persistente. */
  duration?: number;
}

export interface HandleErrorOpts {
  /** Identificador curto pra rastreio (ex: 'export-pdf', 'organize'). */
  context: string;
  /** Mensagem amigável pro usuário. Default: mensagem genérica + context. */
  userMessage?: string;
  /** Se false, não dispara toast (só loga). Útil pra erros recuperáveis silenciosos. */
  toast?: boolean;
  /** Duração do toast em ms. */
  duration?: number;
}

/**
 * Trata um erro: loga estruturado + (opcionalmente) emite toast + reporta
 * pro Sentry em produção.
 *
 * Sempre retorna `undefined` pra ser encadeável em `.catch(handleError)`
 * sem alterar o resultado da Promise.
 */
export function handleError(
  err: unknown,
  opts: HandleErrorOpts
): undefined {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Erro desconhecido';
  devError(`[${opts.context}]`, err);

  // Reporta pro Sentry em produção (só se DSN configurado — capture é no-op
  // sem init). Tag context pra facilitar busca no dashboard.
  if (typeof window !== 'undefined') {
    void import('@sentry/nextjs').then((Sentry) => {
      try {
        Sentry.withScope((scope) => {
          scope.setTag('context', opts.context);
          if (err instanceof Error) {
            Sentry.captureException(err);
          } else {
            Sentry.captureMessage(message, 'error');
          }
        });
      } catch {
        /* Sentry pode não ter sido init — silenciar */
      }
    });
  }

  if (opts.toast !== false && typeof window !== 'undefined') {
    const detail: ToastDetail = {
      level: 'error',
      message: opts.userMessage ?? `Falha em ${opts.context}: ${message}`,
      detail: opts.userMessage ? message : undefined,
      duration: opts.duration,
    };
    window.dispatchEvent(
      new CustomEvent<ToastDetail>(FLUXO_TOAST_EVENT, { detail })
    );
  }
  return undefined;
}

/**
 * Emite um toast manualmente (sem erro associado).
 *
 *   toast({ level: 'success', message: 'Projeto salvo' })
 */
export function toast(detail: ToastDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(FLUXO_TOAST_EVENT, { detail })
  );
}
