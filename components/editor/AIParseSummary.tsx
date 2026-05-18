'use client';

import { useEffect, useState } from 'react';

interface AIParseMeta {
  framesCount: number;
  blocksCount: number;
  notes: string[];
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
}

/**
 * Banner que aparece após a IA processar um escopo, mostrando:
 *  - Quantos frames/blocos foram criados
 *  - Tempo total de processamento
 *  - Tokens consumidos (input/output)
 *  - Observações que a IA detectou no documento (orientações que NÃO viraram nodes)
 *
 * Lê o meta de `sessionStorage` (key: `fluxo:lastAIParse`) — limpado após
 * a primeira leitura. Assim, o banner só aparece UMA vez por parse.
 *
 * O usuário pode dispensar manualmente clicando no ✕.
 *
 * Foi pensado pra dar transparência sobre o que a IA fez, especialmente
 * importante pra usuário validar fidelidade ao escopo original.
 */
export default function AIParseSummary() {
  const [meta, setMeta] = useState<AIParseMeta | null>(null);

  useEffect(() => {
    // Lê e limpa imediatamente — banner só aparece uma vez
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem('fluxo:lastAIParse');
      if (raw) {
        const parsed = JSON.parse(raw) as AIParseMeta;
        setMeta(parsed);
        window.sessionStorage.removeItem('fluxo:lastAIParse');
      }
    } catch {
      // Ignora se JSON tiver corrompido
    }
  }, []);

  if (!meta) return null;

  const seconds = (meta.durationMs / 1000).toFixed(1);

  return (
    <div className="absolute top-3 left-3 right-3 z-40 max-w-xl mx-auto bg-white border-2 border-blip-purple/30 rounded-xl shadow-lg p-4 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <span className="text-base">🤖</span>
            IA processou o escopo com sucesso
          </h3>

          {/* Stats compactos */}
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Frames" value={String(meta.framesCount)} />
            <Stat label="Blocos" value={String(meta.blocksCount)} />
            <Stat label="Tempo" value={`${seconds}s`} />
            <Stat
              label="Tokens"
              value={
                meta.inputTokens || meta.outputTokens
                  ? `${(meta.inputTokens ?? 0).toLocaleString('pt-BR')}↓ ${(
                      meta.outputTokens ?? 0
                    ).toLocaleString('pt-BR')}↑`
                  : '—'
              }
            />
          </div>

          {/* Cache hit indicator (economia de custo) */}
          {meta.cacheReadTokens && meta.cacheReadTokens > 0 && (
            <p className="mt-2 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 inline-block">
              💰 Cache hit: {meta.cacheReadTokens.toLocaleString('pt-BR')} tokens lidos do cache
            </p>
          )}

          {/* Observações da IA */}
          {meta.notes && meta.notes.length > 0 && (
            <details className="mt-3 group">
              <summary className="text-xs font-medium text-gray-700 cursor-pointer hover:text-gray-900 select-none">
                📝 {meta.notes.length} observaç{meta.notes.length === 1 ? 'ão' : 'ões'} detectada
                {meta.notes.length === 1 ? '' : 's'} no documento (não viraram nodes)
                <span className="text-gray-400 ml-1 group-open:hidden">→</span>
                <span className="text-gray-400 ml-1 hidden group-open:inline">↓</span>
              </summary>
              <ul className="mt-2 space-y-1 ml-4 list-disc text-xs text-gray-700">
                {meta.notes.map((note, idx) => (
                  <li key={idx} className="leading-snug">
                    {note}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="mt-3 text-xs text-gray-500 italic">
            Confira se a estrutura está fiel ao escopo. Você pode ajustar
            qualquer node clicando nele.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMeta(null)}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0"
          aria-label="Dispensar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-md px-2 py-1.5 border border-gray-100">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">
        {label}
      </div>
      <div className="text-sm font-bold text-gray-900 truncate">{value}</div>
    </div>
  );
}
