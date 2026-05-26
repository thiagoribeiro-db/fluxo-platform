/**
 * Seen-tracker: rastreia "última vez que o user viu X" em localStorage.
 *
 * Usado pra marcar:
 *  - Flow node: dot indicator quando flowUpdatedAt > lastSeen
 *  - Dashboard de componentes: badge "atualizado" quando spec.updated_at > lastSeen
 *  - Versions panel, etc.
 *
 * Chave do storage: `fluxo:seen:<scope>:<id>`. Valor: ISO timestamp.
 *
 * SSR-safe: noop quando window indefinido.
 */

const PREFIX = 'fluxo:seen';

function key(scope: string, id: string): string {
  return `${PREFIX}:${scope}:${id}`;
}

/** Retorna o ISO da última visita, ou undefined se nunca foi visto. */
export function getLastSeen(scope: string, id: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(key(scope, id)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Marca como visto AGORA. */
export function markSeen(scope: string, id: string, when?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(scope, id), when ?? new Date().toISOString());
  } catch {
    // localStorage cheio ou disabled — best-effort
  }
}

/**
 * Retorna true se o `updatedAt` é mais recente que o lastSeen — ou se nunca foi
 * visto E updatedAt existe (e é parseável).
 */
export function hasUnseenUpdate(
  scope: string,
  id: string,
  updatedAt: string | undefined | null
): boolean {
  if (!updatedAt) return false;
  const updTs = Date.parse(updatedAt);
  if (Number.isNaN(updTs)) return false; // string inválida — trata como sem update
  const last = getLastSeen(scope, id);
  if (!last) return true; // nunca visto + tem update válido = sinaliza
  const lastTs = Date.parse(last);
  if (Number.isNaN(lastTs)) return false;
  return updTs > lastTs;
}
