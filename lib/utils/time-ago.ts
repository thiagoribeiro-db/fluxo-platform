/**
 * Utilitário pra formatar timestamps relativos em pt-BR.
 *
 * Usado em badges de "atualizado há X" no canvas (WhatsAppFlowNode e outros
 * futuros). Reativo via componentes que re-renderizam — sem cron interno.
 *
 *   formatTimeAgo('2026-05-25T10:00:00Z', now: 2026-05-25T10:00:30Z)
 *   → 'agora mesmo'
 *
 *   formatTimeAgo('2026-05-25T09:55:00Z', now: 2026-05-25T10:00:00Z)
 *   → 'há 5 min'
 */

export interface TimeAgoOpts {
  /** Tempo de referência (default: Date.now()). Útil pra testes determinísticos. */
  now?: number;
  /** Se true, retorna ISO completo no caso de timestamps muito antigos (>30 dias). */
  fallbackToIso?: boolean;
}

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

export function formatTimeAgo(
  iso: string | undefined | null,
  opts: TimeAgoOpts = {}
): string {
  if (!iso) return '';
  const past = Date.parse(iso);
  if (Number.isNaN(past)) return '';
  const now = opts.now ?? Date.now();
  const delta = now - past;

  if (delta < 0) return 'no futuro'; // edge case (clocks dessincronizados)
  if (delta < 30 * SEC) return 'agora mesmo';
  if (delta < MIN) return 'há poucos segundos';
  if (delta < HOUR) {
    const m = Math.floor(delta / MIN);
    return `há ${m} min`;
  }
  if (delta < DAY) {
    const h = Math.floor(delta / HOUR);
    return `há ${h} h`;
  }
  if (delta < WEEK) {
    const d = Math.floor(delta / DAY);
    return d === 1 ? 'ontem' : `há ${d} dias`;
  }
  if (delta < MONTH) {
    const w = Math.floor(delta / WEEK);
    return w === 1 ? 'há 1 semana' : `há ${w} semanas`;
  }
  if (opts.fallbackToIso) return iso.slice(0, 10);
  const mo = Math.floor(delta / MONTH);
  return mo === 1 ? 'há 1 mês' : `há ${mo} meses`;
}

/**
 * Retorna true se o timestamp está dentro da janela "recente" (default: 5 min).
 * Usado pra decidir se renderiza pulse/highlight visual.
 */
export function isRecent(
  iso: string | undefined | null,
  opts: { withinMs?: number; now?: number } = {}
): boolean {
  if (!iso) return false;
  const past = Date.parse(iso);
  if (Number.isNaN(past)) return false;
  const within = opts.withinMs ?? 5 * MIN;
  const now = opts.now ?? Date.now();
  return now - past < within;
}
