'use client';

import { useEffect, useState } from 'react';
import { getAISystemPrompt } from '@/lib/actions/get-system-prompt';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal read-only que exibe o system prompt enviado ao Claude durante o
 * parse IA de escopos. Inclui botão de cópia e contador de caracteres.
 */
export default function SystemPromptViewerDialog({ open, onClose }: Props) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Carrega o prompt na primeira abertura
  useEffect(() => {
    if (!open || prompt !== null) return;
    setLoading(true);
    getAISystemPrompt()
      .then(({ prompt: p, charCount: c }) => {
        setPrompt(p);
        setCharCount(c);
      })
      .finally(() => setLoading(false));
  }, [open, prompt]);

  function handleCopy() {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div
        className="bg-white rounded-xl w-full max-w-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              🤖 Prompt do Parser IA
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-lg">
              Instruções enviadas ao Claude para interpretar escopos de chatbot.
              Construído de forma composicional: framework fixo +
              vocabulário de blocos gerado dos component specs (YAML).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-4 shrink-0"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-40 text-sm text-gray-500 gap-2">
              <div className="w-4 h-4 border-2 border-gray-200 border-t-blip-purple rounded-full animate-spin" />
              Carregando prompt…
            </div>
          )}

          {!loading && prompt && (
            <>
              {/* Info strips */}
              <div className="px-5 py-2 bg-blip-purple/5 border-b border-blip-purple/10 flex flex-wrap gap-4 text-xs text-gray-600">
                <span>
                  <strong>Modelo:</strong> claude-opus-4-7 (adaptive thinking)
                </span>
                <span>
                  <strong>Tamanho:</strong> {charCount.toLocaleString('pt-BR')} caracteres
                </span>
                <span>
                  <strong>Cache:</strong> ephemeral (Anthropic Prompt Caching)
                </span>
                <span>
                  <strong>Seções:</strong> Intro · ORIENTAÇÃO vs ESTRUTURA · Vocabulário ·
                  Regras de Fidelidade · Exemplo Completo · Casos Extremos · Tool
                </span>
              </div>

              {/* Prompt text */}
              <pre className="p-5 text-xs font-mono whitespace-pre-wrap text-gray-800 leading-relaxed">
                {prompt}
              </pre>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-400">
            {charCount > 0
              ? `${charCount.toLocaleString('pt-BR')} chars · read-only`
              : ''}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!prompt}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              {copied ? '✅ Copiado!' : '📋 Copiar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-blip-purple text-white rounded-lg hover:bg-blip-purple-dark"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
