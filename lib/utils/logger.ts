/**
 * Logger DEV-ONLY — substituto seguro pra `console.*` em código de domínio.
 *
 * Em produção, `devLog` e `devWarn` viram NO-OP (não pollui o console do
 * usuário final). `devError` SEMPRE registra (erros são informação útil
 * mesmo em produção). Para erros que precisam de feedback ao usuário,
 * use o handleError (ainda a criar) que dispara toast.
 *
 * USO:
 *   import { devLog, devWarn, devError } from '@/lib/utils/logger';
 *   devLog('[organize] frame=%s mains=%d', frame.prefix, list.length);
 *   devWarn('[ai-builder] condicional sem condition', block);
 *   devError('[export] falha gerando PDF', err);
 *
 * Convenção: começar a mensagem com `[modulo]` em colchetes pra facilitar
 * o filtro no DevTools.
 */

const isDev =
  typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';

export function devLog(...args: unknown[]): void {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.warn(...args);
}

/**
 * Erros SEMPRE são logados (mesmo em prod) — são sinal útil pro Sentry/etc.
 * Para mostrar ao usuário, use o handleError separadamente.
 */
export function devError(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error(...args);
}
