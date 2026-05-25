import Link from 'next/link';
import { listIaUsageDaily } from '@/lib/actions/ia-usage';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { projectId: string };
  searchParams: { days?: string };
}

const FEATURE_LABELS: Record<string, string> = {
  'parse-flow': '🌱 Importação de escopo',
  'voice-tone-analyze': '✨ Voice & Tone — análise',
  'voice-tone-rewrite': '✨ Voice & Tone — reescrita',
  'ai-chat': '💬 Chat IA',
  'ai-other': '🤖 Outros',
};

function featureLabel(f: string): string {
  return FEATURE_LABELS[f] ?? f;
}

export default async function IaUsagePage({ params, searchParams }: PageProps) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', params.projectId)
    .maybeSingle();

  if (!project) {
    return (
      <main className="p-8 text-center">
        <h1 className="font-bold">Projeto não encontrado</h1>
        <Link href="/dashboard" className="text-blip-purple hover:underline">
          ← Dashboard
        </Link>
      </main>
    );
  }

  const days = Math.max(1, Math.min(365, parseInt(searchParams.days ?? '30', 10) || 30));
  const rows = await listIaUsageDaily(params.projectId, days);

  // Agrega totais
  const totals = rows.reduce(
    (acc, r) => ({
      calls: acc.calls + r.calls,
      input: acc.input + r.input_tokens,
      output: acc.output + r.output_tokens,
      cost: acc.cost + r.cost_usd,
    }),
    { calls: 0, input: 0, output: 0, cost: 0 }
  );

  // Top features (agregado total)
  const byFeature = new Map<string, { calls: number; cost: number }>();
  for (const r of rows) {
    const existing = byFeature.get(r.feature) ?? { calls: 0, cost: 0 };
    existing.calls += r.calls;
    existing.cost += r.cost_usd;
    byFeature.set(r.feature, existing);
  }
  const topFeatures = Array.from(byFeature.entries())
    .map(([f, v]) => ({ feature: f, ...v }))
    .sort((a, b) => b.cost - a.cost);

  // Agrupa por dia pro heatmap
  const byDay = new Map<string, number>();
  for (const r of rows) {
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.cost_usd);
  }
  const allDays = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDayCost = allDays.length > 0 ? Math.max(...allDays.map(([, v]) => v)) : 0;

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard" className="text-xs text-blip-purple hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          🤖 Uso da IA — {project.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Últimos {days} dias.{' '}
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/dashboard/ia-usage/${params.projectId}?days=${d}`}
              className={`ml-2 text-[11px] ${days === d ? 'font-semibold text-blip-purple' : 'text-gray-400 hover:text-gray-700'}`}
            >
              {d}d
            </Link>
          ))}
        </p>
      </div>

      {totals.calls === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
          Sem uso de IA registrado neste período. Importar escopo, analisar
          Voice &amp; Tone ou usar o Chat IA vai aparecer aqui.
        </div>
      ) : (
        <>
          {/* Cards de totais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Chamadas" value={totals.calls.toLocaleString('pt-BR')} />
            <StatCard
              label="Tokens entrada"
              value={(totals.input / 1000).toFixed(1) + 'k'}
            />
            <StatCard
              label="Tokens saída"
              value={(totals.output / 1000).toFixed(1) + 'k'}
            />
            <StatCard
              label="Custo total"
              value={`US$ ${totals.cost.toFixed(2)}`}
              accent
            />
          </div>

          {/* Heatmap diário (barras simples) */}
          <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Custo por dia
            </h2>
            <div className="flex items-end gap-1 h-32">
              {allDays.map(([day, cost]) => {
                const heightPct = maxDayCost > 0 ? (cost / maxDayCost) * 100 : 0;
                return (
                  <div
                    key={day}
                    className="flex-1 flex flex-col items-center gap-1 min-w-0"
                    title={`${day}: US$ ${cost.toFixed(4)}`}
                  >
                    <div
                      className="w-full bg-blip-purple/20 rounded-t hover:bg-blip-purple/40 transition-colors"
                      style={{ height: `${heightPct}%`, minHeight: cost > 0 ? '2px' : '0' }}
                    />
                    <div className="text-[8px] text-gray-400 truncate w-full text-center">
                      {day.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Top features */}
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Custo por feature
            </h2>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-gray-400">
                <tr>
                  <th className="text-left py-1">Feature</th>
                  <th className="text-right py-1">Chamadas</th>
                  <th className="text-right py-1">Custo (US$)</th>
                  <th className="text-right py-1">% do total</th>
                </tr>
              </thead>
              <tbody>
                {topFeatures.map((f) => (
                  <tr key={f.feature} className="border-t border-gray-100">
                    <td className="py-1.5">{featureLabel(f.feature)}</td>
                    <td className="text-right tabular-nums">{f.calls}</td>
                    <td className="text-right tabular-nums">{f.cost.toFixed(4)}</td>
                    <td className="text-right tabular-nums text-gray-500">
                      {totals.cost > 0
                        ? `${((f.cost / totals.cost) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${accent ? 'border-blip-purple bg-blip-purple/5' : 'border-gray-200 bg-white'}`}
    >
      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 ${accent ? 'text-blip-purple' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}
