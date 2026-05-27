'use server';

import { createClient } from '@/lib/supabase/server';
import {
  calculateCostUsd,
  type AnthropicUsageBlock,
} from '@/lib/utils/ia-pricing';

/**
 * Features que registram uso de IA. Use os slugs aqui pra alimentar a tabela
 * de heatmap por feature.
 */
export type IaFeature =
  | 'parse-flow'
  | 'voice-tone-analyze'
  | 'voice-tone-rewrite'
  | 'ai-chat'
  | 'ai-other';

interface LogIaUsageInput {
  projectId: string;
  feature: IaFeature;
  model: string;
  usage: AnthropicUsageBlock | null;
  latencyMs?: number;
  errorMessage?: string;
}

/**
 * Registra chamada à IA na tabela `ia_usage`. Best-effort — não falha o
 * caller se o INSERT der erro (loga warning).
 *
 * Aceita usage null quando a chamada falhou — neste caso registra zero
 * tokens mas mantém o erro pra trend.
 */
export async function logIaUsage(input: LogIaUsageInput): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const usage = input.usage ?? {
      input_tokens: 0,
      output_tokens: 0,
    };
    const cost = calculateCostUsd(input.model, usage);

    const { error } = await supabase.from('ia_usage').insert({
      project_id: input.projectId,
      user_id: user?.id ?? null,
      feature: input.feature,
      model: input.model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cost_usd: cost,
      latency_ms: input.latencyMs ?? null,
      error_message: input.errorMessage ?? null,
    });
    if (error) {
      console.warn('[ia-usage] insert failed:', input.feature, error.message);
    }
  } catch (err) {
    console.warn('[ia-usage] unexpected:', input.feature, err);
  }
}

export interface IaUsageSummary {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

/**
 * Totais acumulados de uso de IA para um projeto específico (all-time).
 * Usado no rodapé da Palette pra dar visibilidade de consumo pro usuário.
 */
export async function getProjectIaUsageSummary(
  projectId: string
): Promise<IaUsageSummary> {
  const empty: IaUsageSummary = {
    callCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  };
  if (!projectId) return empty;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ia_usage')
      .select('input_tokens, output_tokens, cost_usd')
      .eq('project_id', projectId);

    if (error || !data) return empty;

    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    for (const r of data as Array<{
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
    }>) {
      inputTokens += r.input_tokens ?? 0;
      outputTokens += r.output_tokens ?? 0;
      costUsd += Number(r.cost_usd ?? 0);
    }
    return {
      callCount: data.length,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
    };
  } catch {
    return empty;
  }
}

export interface IaUsageDailyRow {
  day: string; // YYYY-MM-DD
  feature: IaFeature | string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

/**
 * Agrega uso de IA por dia + feature pros últimos N dias.
 * Default: últimos 30 dias.
 */
export async function listIaUsageDaily(
  projectId: string,
  days = 30
): Promise<IaUsageDailyRow[]> {
  const supabase = createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('ia_usage')
    .select('feature, input_tokens, output_tokens, cost_usd, created_at')
    .eq('project_id', projectId)
    .gte('created_at', since);

  if (error) {
    console.error('listIaUsageDaily error:', error);
    return [];
  }

  // Agrega em JS — mais simples que fazer view no DB com group by ::date
  const map = new Map<string, IaUsageDailyRow>();
  for (const r of (data ?? []) as Array<{
    feature: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    created_at: string;
  }>) {
    const day = r.created_at.slice(0, 10);
    const key = `${day}::${r.feature}`;
    const existing = map.get(key);
    if (existing) {
      existing.calls += 1;
      existing.input_tokens += r.input_tokens;
      existing.output_tokens += r.output_tokens;
      existing.cost_usd += Number(r.cost_usd);
    } else {
      map.set(key, {
        day,
        feature: r.feature,
        calls: 1,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        cost_usd: Number(r.cost_usd),
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.day.localeCompare(a.day) || b.cost_usd - a.cost_usd
  );
}
