/**
 * Rate limit em memória — janela deslizante por chave.
 *
 * Por que em memória (não Redis)?
 *  - O app roda em Vercel Serverless: cada instância tem seu Map. Em prod,
 *    o limite efetivo é por instância — não 100% rigoroso, mas suficiente
 *    pra evitar ABUSO óbvio (um user fazendo 50 calls/min de IA).
 *  - Pra estrito multi-instância, trocar por upstash/redis sem mudar API.
 *
 * Uso:
 *   const lim = checkRateLimit('user:abc:parse-flow', { max: 5, windowMs: 60_000 });
 *   if (!lim.allowed) { ... return err('rate_limited', lim.message); }
 *
 * Limpeza: chaves antigas são purgadas no próximo check da mesma chave
 * (lazy). Sem cron — Map cresce só com chaves recentes em uso.
 */

interface Bucket {
  /** Timestamps (epoch ms) das chamadas DENTRO da janela atual. */
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Quantas chamadas no máximo dentro da janela. */
  max: number;
  /** Tamanho da janela em ms. Ex: 60_000 = 1 minuto. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Quantas chamadas o user já fez na janela. */
  current: number;
  /** Quanto falta pra liberar (em ms) — só preenchido quando bloqueado. */
  retryAfterMs?: number;
  /** Mensagem amigável pro user (PT-BR). */
  message: string;
}

/**
 * Verifica + registra uma chamada na janela. Retorna se permite.
 *
 * IMPORTANTE: chamar 1x por request — ele já incrementa o contador quando
 * permitido. Se chamar e ignorar o resultado, vai contar mesmo assim.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - options.windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // Purga chamadas fora da janela
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= options.max) {
    // Bloqueado — calcula quanto falta pro mais antigo sair da janela
    const oldest = bucket.timestamps[0];
    const retryAfterMs = oldest + options.windowMs - now;
    return {
      allowed: false,
      current: bucket.timestamps.length,
      retryAfterMs: Math.max(0, retryAfterMs),
      message: formatLimitMessage(options.max, options.windowMs, retryAfterMs),
    };
  }

  // Permitido — registra e retorna
  bucket.timestamps.push(now);
  return {
    allowed: true,
    current: bucket.timestamps.length,
    message: 'ok',
  };
}

function formatLimitMessage(
  max: number,
  windowMs: number,
  retryAfterMs: number
): string {
  const windowSec = Math.round(windowMs / 1000);
  const windowLabel =
    windowSec >= 60 ? `${Math.round(windowSec / 60)} min` : `${windowSec}s`;
  const retrySec = Math.ceil(retryAfterMs / 1000);
  return `Limite atingido (${max} chamadas a cada ${windowLabel}). Tente em ${retrySec}s.`;
}

/**
 * Limites pré-configurados pra cada feature de IA. Ajustar caso veja abuso.
 */
export const IA_RATE_LIMITS = {
  // 5 parses por minuto por user — é a operação mais cara (pode ser 30s+)
  PARSE_FLOW: { max: 5, windowMs: 60_000 },
  // 10 análises de voice/tone por minuto
  VOICE_TONE: { max: 10, windowMs: 60_000 },
  // 30 msgs/min no chat
  AI_CHAT: { max: 30, windowMs: 60_000 },
} as const;

/**
 * Helper específico pra rate limit por user + feature de IA.
 */
export function checkIaRateLimit(
  userId: string | null | undefined,
  feature: keyof typeof IA_RATE_LIMITS
): RateLimitResult {
  // Sem userId (anônimo) usa o IP no proxy futuro; por agora cai em 'anon'
  const key = `ia:${feature}:${userId ?? 'anon'}`;
  return checkRateLimit(key, IA_RATE_LIMITS[feature]);
}

/**
 * Testes podem chamar isso pra resetar o estado entre cases.
 */
export function resetAllBuckets(): void {
  buckets.clear();
}
