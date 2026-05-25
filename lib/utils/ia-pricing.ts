/**
 * Tabela de preços + helper de cálculo de custo das chamadas Anthropic.
 *
 * Separado do `lib/actions/ia-usage.ts` porque arquivos com `'use server'`
 * só podem exportar funções async — esta é função pura sync. Mantemos
 * aqui pra ficar acessível tanto em server actions quanto em painéis e
 * testes.
 *
 * Referência: https://www.anthropic.com/pricing
 */

export interface AnthropicUsageBlock {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

const PRICING: Record<
  string,
  {
    inputPer1M: number;
    outputPer1M: number;
    cacheWritePer1M: number;
    cacheReadPer1M: number;
  }
> = {
  // Claude Opus 4.7 (preços hipotéticos baseados em opus 4)
  'claude-opus-4-1': {
    inputPer1M: 15,
    outputPer1M: 75,
    cacheWritePer1M: 18.75,
    cacheReadPer1M: 1.5,
  },
  'claude-opus-4-7': {
    inputPer1M: 15,
    outputPer1M: 75,
    cacheWritePer1M: 18.75,
    cacheReadPer1M: 1.5,
  },
  // Sonnet 4
  'claude-sonnet-4-5': {
    inputPer1M: 3,
    outputPer1M: 15,
    cacheWritePer1M: 3.75,
    cacheReadPer1M: 0.3,
  },
  // Fallback genérico — assume preço de sonnet (subestima opus de propósito
  // pra não estourar relatórios; corrigir adicionando entrada certa).
  default: {
    inputPer1M: 3,
    outputPer1M: 15,
    cacheWritePer1M: 3.75,
    cacheReadPer1M: 0.3,
  },
};

/**
 * Calcula custo em USD baseado nos tokens e modelo. Usa cache hit/write
 * separadamente porque têm preços diferentes.
 */
export function calculateCostUsd(model: string, usage: AnthropicUsageBlock): number {
  const p = PRICING[model] ?? PRICING.default;
  const inputCost = (usage.input_tokens / 1_000_000) * p.inputPer1M;
  const outputCost = (usage.output_tokens / 1_000_000) * p.outputPer1M;
  const cacheWriteCost =
    ((usage.cache_creation_input_tokens ?? 0) / 1_000_000) * p.cacheWritePer1M;
  const cacheReadCost =
    ((usage.cache_read_input_tokens ?? 0) / 1_000_000) * p.cacheReadPer1M;
  return (
    Math.round((inputCost + outputCost + cacheWriteCost + cacheReadCost) * 1_000_000) /
    1_000_000
  );
}
