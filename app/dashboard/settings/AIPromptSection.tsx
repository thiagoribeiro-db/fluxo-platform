'use client';

import { useState } from 'react';
import SystemPromptViewerDialog from '@/components/editor/SystemPromptViewerDialog';

/**
 * Seção de configurações que exibe informações sobre o prompt do parser IA
 * e permite visualizar o prompt completo enviado ao Claude.
 */
export default function AIPromptSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            🤖 Parser IA — Prompt do sistema
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Quando você usa <strong>Carregar Template → IA</strong>, o documento é enviado ao
            Claude com um prompt de sistema especializado em interpretar escopos de chatbot
            Blip/Digitalbot.
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm text-gray-700">
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-blip-purple font-bold">Modelo</span>
            <span className="text-gray-500">claude-opus-4-7 · adaptive thinking · max 32 000 tokens</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-blip-purple font-bold">Cache</span>
            <span className="text-gray-500">
              Anthropic Prompt Caching (ephemeral) — o prompt é cacheado por 5 min,
              reduzindo custo e latência em chamadas consecutivas.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-blip-purple font-bold">Composição</span>
            <span className="text-gray-500">
              Framework fixo (TS) + vocabulário de blocos gerado dos component specs (YAML em{' '}
              <code className="text-[11px] bg-white border border-gray-200 px-1 rounded">
                lib/component-specs/builtins/
              </code>
              ).
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-blip-purple font-bold">Seções</span>
            <span className="text-gray-500">
              Intro · ORIENTAÇÃO vs ESTRUTURA · Vocabulário de blocos · Regras de
              fidelidade (11 regras) · Exemplo completo · Casos extremos · Instruções do
              tool
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 text-sm border border-blip-purple text-blip-purple rounded-lg font-medium hover:bg-blip-purple/5 transition-colors"
          >
            👁 Ver prompt completo
          </button>
          <span className="text-xs text-gray-400">
            Somente leitura · use o botão Copiar para exportar
          </span>
        </div>
      </section>

      <SystemPromptViewerDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
