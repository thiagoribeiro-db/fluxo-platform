'use client';

import { useState, useTransition } from 'react';
import {
  applyTemplate,
  applyEscopoToProject,
  applyEscopoWithAI,
} from '@/lib/actions/projects';
import { extractTextFromFile } from '@/lib/actions/extract-text';
import { devLog, devWarn } from '@/lib/utils/logger';
import { toast } from '@/lib/utils/errors';
import { confirmDialog } from '@/lib/utils/dialog';

interface TemplateDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  /** Página alvo onde aplicar o template/escopo. Se omitido, usa active_page_id do banco. */
  currentPageId?: string;
}

type Tab = 'upload' | 'paste' | 'exemplo';
type ParseMode = 'ai' | 'regex';

/**
 * Modal "Carregar Template" — 3 formas de carregar:
 *  1. Upload de arquivo (.pdf, .docx, .md, .txt) — interpretado por IA
 *  2. Colar texto direto — interpretado por IA
 *  3. Usar template-exemplo embutido (varejo)
 *
 * Modo legado (regex) disponível como fallback se a IA não estiver configurada.
 */
export default function TemplateDialog({
  projectId,
  open,
  onClose,
  currentPageId,
}: TemplateDialogProps) {
  const [tab, setTab] = useState<Tab>('upload');
  const [fileText, setFileText] = useState('');
  const [fileName, setFileName] = useState('');
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [extracting, setExtracting] = useState(false);
  // Modo de parsing: 'ai' (default, recomendado) ou 'regex' (fallback legado)
  const [parseMode, setParseMode] = useState<ParseMode>('ai');

  if (!open) return null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);

    const ext = file.name.toLowerCase().split('.').pop() ?? '';
    if (!['md', 'markdown', 'txt', 'pdf', 'docx'].includes(ext)) {
      setError(
        'Formato não suportado. Aceitos: .pdf, .docx, .md, .txt.'
      );
      setFileText('');
      return;
    }

    try {
      if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
        // Lê direto no client
        const text = await file.text();
        setFileText(text);
      } else {
        // PDF / DOCX → server action (precisa de libs Node)
        setExtracting(true);
        try {
          const buffer = await file.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          const { text } = await extractTextFromFile({
            fileName: file.name,
            base64,
          });
          setFileText(text);
        } finally {
          setExtracting(false);
        }
      }
    } catch (err) {
      setExtracting(false);
      setError(
        err instanceof Error
          ? `Erro ao ler o arquivo: ${err.message}`
          : 'Não foi possível ler o arquivo.'
      );
    }
  }

  function dispatchLoading(message: string | null, timeoutMs?: number) {
    window.dispatchEvent(
      new CustomEvent('fluxo:loading', { detail: { message, timeoutMs } })
    );
  }

  async function handleApply(textToApply: string, sourceName?: string) {
    if (!textToApply.trim()) {
      setError('Conteúdo vazio.');
      return;
    }

    const isAI = parseMode === 'ai';
    const ok = await confirmDialog({
      title: isAI ? 'Aplicar com IA?' : 'Aplicar escopo (regex)?',
      message: isAI
        ? 'A IA vai analisar o documento e gerar o fluxo.\n\n⏱️ Pode demorar 30s-2min (depende do tamanho do escopo).\n\nO conteúdo atual do projeto será SUBSTITUÍDO.'
        : 'Substituir o conteúdo atual do projeto pelo escopo carregado?\n\nApós o carregamento, o layout será organizado automaticamente.\n\n(Modo regex/legado — pode falhar em PDFs corridos.)',
      confirmText: isAI ? 'Aplicar com IA' : 'Aplicar',
      variant: 'danger',
    });
    if (!ok) return;

    onClose(); // fecha modal imediatamente; loading vai pelo overlay

    if (isAI) {
      // IA: timeout maior (5min) + mensagem informativa
      dispatchLoading('🤖 IA analisando o escopo… (30s-2min)', 300_000);
    } else {
      // Regex: rápido
      dispatchLoading('Aplicando escopo ao projeto…');
    }

    startTransition(async () => {
      try {
        if (isAI) {
          const result = await applyEscopoWithAI(
            projectId,
            textToApply,
            sourceName,
            currentPageId
          );
          // Loga meta no console pra debug
          devLog('[applyEscopoWithAI] resultado:', result);

          // Salva resumo no sessionStorage pra mostrar pro usuário após reload
          // (sumirá após primeira leitura)
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(
              'fluxo:lastAIParse',
              JSON.stringify({
                framesCount: result.framesCount,
                blocksCount: result.blocksCount,
                notes: result.notes,
                durationMs: result.durationMs,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                cacheReadTokens: result.cacheReadTokens,
              })
            );
          }
        } else {
          await applyEscopoToProject(projectId, textToApply, currentPageId);
        }
        // Recarrega editor com autoOrganize ativo
        window.location.href = `/editor/${projectId}?autoOrganize=1`;
      } catch (err) {
        dispatchLoading(null);
        const msg = err instanceof Error ? err.message : 'Erro ao aplicar escopo';
        toast({ level: 'error', message: msg, duration: 10000 });
      }
    });
  }

  async function handleApplyExemplo() {
    const ok = await confirmDialog({
      title: 'Carregar template "Varejo (exemplo)"?',
      message:
        '⚠️ Isso APAGA o conteúdo atual do projeto.\n\nApós o carregamento, o layout será organizado automaticamente.',
      confirmText: 'Carregar',
      variant: 'danger',
    });
    if (!ok) return;
    onClose();
    dispatchLoading('Carregando template…');
    startTransition(async () => {
      try {
        await applyTemplate(projectId, 'varejo-exemplo', currentPageId);
        window.location.href = `/editor/${projectId}?autoOrganize=1`;
      } catch (err) {
        dispatchLoading(null);
        toast({
          level: 'error',
          message: err instanceof Error ? err.message : 'Erro ao aplicar template',
        });
      }
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">🌱 Carregar Template</h2>
            <p className="text-sm text-gray-500 mt-1">
              Subir um escopo, colar um texto, ou começar do template exemplo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {(
            [
              { id: 'upload', label: '📄 Upload de arquivo' },
              { id: 'paste', label: '📝 Colar texto' },
              { id: 'exemplo', label: '🌱 Usar exemplo' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError(null);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                tab === t.id
                  ? 'border-blip-purple text-blip-purple'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Toggle de modo: IA vs Regex — só aparece nas tabs upload/paste */}
        {(tab === 'upload' || tab === 'paste') && (
          <div className="mb-4 bg-gradient-to-r from-blip-purple/5 to-blue-50 border border-blip-purple/20 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  {parseMode === 'ai' ? '🤖' : '⚙️'} Modo de interpretação
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  {parseMode === 'ai'
                    ? 'IA (Claude) interpreta semanticamente o escopo — recomendado para PDFs.'
                    : 'Regex/heurístico — rápido mas falha em textos sem markdown claro.'}
                </p>
              </div>
              <div className="flex bg-white rounded-md p-0.5 border border-gray-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setParseMode('ai')}
                  className={`px-3 py-1.5 text-xs font-medium rounded ${
                    parseMode === 'ai'
                      ? 'bg-blip-purple text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  🤖 IA
                </button>
                <button
                  type="button"
                  onClick={() => setParseMode('regex')}
                  className={`px-3 py-1.5 text-xs font-medium rounded ${
                    parseMode === 'regex'
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  ⚙️ Regex
                </button>
              </div>
            </div>
            {parseMode === 'ai' && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                ⏱️ Demora 30s-2min. Requer <code className="text-[10px]">ANTHROPIC_API_KEY</code>{' '}
                configurada no servidor.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Conteúdo da tab */}
        {tab === 'upload' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecione o arquivo do escopo (.pdf, .docx, .md ou .txt)
              </label>
              <input
                type="file"
                accept=".md,.txt,.markdown,.pdf,.docx"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blip-purple file:text-white file:font-medium file:hover:bg-blip-purple-dark disabled:opacity-50"
                disabled={isPending || extracting}
              />
              {extracting && (
                <div className="mt-3 flex items-center gap-2 bg-blip-purple/10 border border-blip-purple/20 rounded-md px-3 py-2">
                  <div
                    className="w-4 h-4 border-2 border-blip-purple/30 border-t-blip-purple rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-blip-purple font-medium">
                    Extraindo texto do arquivo… (pode levar alguns segundos)
                  </span>
                </div>
              )}
              {!extracting && fileName && (
                <p className="mt-2 text-xs text-gray-500">
                  📎 <strong>{fileName}</strong> — {fileText.length} caracteres extraídos
                </p>
              )}
            </div>

            {fileText && (
              <>
                {/* Aviso só em modo regex — IA dispensa marcadores */}
                {parseMode === 'regex' && !hasParseableMarkers(fileText) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900">
                    ⚠️ <strong>Texto sem marcadores claros pra o regex.</strong>{' '}
                    O modo regex precisa de "Bot:", "Cliente:", "Cenário N:" ou listas.
                    Considere usar o modo <strong>🤖 IA</strong> (acima) que entende texto livre.
                  </div>
                )}
                <details
                  open={parseMode === 'regex' && !hasParseableMarkers(fileText)}
                  className="border border-gray-200 rounded-md"
                >
                  <summary className="px-3 py-2 text-xs text-gray-600 cursor-pointer bg-gray-50 font-medium">
                    Prévia do conteúdo extraído ({fileText.length} chars)
                  </summary>
                  <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto bg-gray-50 border-t border-gray-200">
                    {fileText.slice(0, 2000)}
                    {fileText.length > 2000 && '\n...'}
                  </pre>
                </details>
              </>
            )}

            <p className="text-xs text-gray-500">
              ✅ Aceita: <strong>.pdf</strong>, <strong>.docx</strong>,{' '}
              <strong>.md</strong>, <strong>.txt</strong>
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleApply(fileText, fileName || undefined)}
                disabled={isPending || !fileText.trim()}
                className="bg-blip-purple text-white px-5 py-2 rounded-lg font-semibold hover:bg-blip-purple-dark disabled:opacity-40"
              >
                {isPending
                  ? 'Aplicando…'
                  : parseMode === 'ai'
                    ? '🤖 Interpretar com IA →'
                    : 'Carregar e aplicar →'}
              </button>
            </div>
          </div>
        )}

        {tab === 'paste' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cole o texto do seu escopo aqui
              </label>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={12}
                placeholder={
                  parseMode === 'ai'
                    ? `Cole aqui qualquer texto descrevendo o fluxo conversacional. A IA vai interpretar.

Exemplo livre:
"O bot começa cumprimentando o cliente e pede o nome. Depois mostra um menu com Ofertas, Lojas, Cartão e Falar com atendente. Se escolher Ofertas, pergunta o estado..."

OU markdown estruturado:
# Saudação
Bot: Oi! Sou o assistente da {marca}.
Cliente: {nome}
- Ofertas
- Lojas
- Atendente
`
                    : `Use formato com marcadores (Bot:, Cliente:, #, -):

# Saudação
Bot: Oi! Sou o assistente virtual da {marca}.
Bot: Como posso te ajudar?
- Ofertas
- Lojas
- Falar com atendente

## Cenário 1: Ofertas
Bot: Em qual estado?
- Pernambuco
- Paraíba
`
                }
                className="w-full text-sm font-mono px-3 py-2 border border-gray-300 rounded-md focus:border-blip-purple focus:outline-none focus:ring-1 focus:ring-blip-purple/30 resize-y"
                disabled={isPending}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleApply(pasted)}
                disabled={isPending || !pasted.trim()}
                className="bg-blip-purple text-white px-5 py-2 rounded-lg font-semibold hover:bg-blip-purple-dark disabled:opacity-40"
              >
                {isPending
                  ? 'Aplicando…'
                  : parseMode === 'ai'
                    ? '🤖 Interpretar com IA →'
                    : 'Parsear e aplicar →'}
              </button>
            </div>
          </div>
        )}

        {tab === 'exemplo' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-900 mb-1">
                🌱 Template "Varejo (exemplo)"
              </h3>
              <p className="text-sm text-amber-800">
                Chatbot genérico de varejo no WhatsApp. Contém:
              </p>
              <ul className="list-disc ml-5 mt-2 text-xs text-amber-800 space-y-0.5">
                <li>12 frames (Saudação, 9 cenários, Algo Mais, Encerramento)</li>
                <li>Bubbles BOT/USER com trackings automáticos</li>
                <li>Menu principal com 9 direcionamentos</li>
                <li>Exemplo de branching com btn-short → mídias diferentes</li>
              </ul>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleApplyExemplo}
                disabled={isPending}
                className="bg-blip-purple text-white px-5 py-2 rounded-lg font-semibold hover:bg-blip-purple-dark disabled:opacity-40"
              >
                {isPending ? 'Aplicando…' : 'Carregar exemplo →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Helper: ArrayBuffer → base64 (server actions só aceitam JSON-serializável)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Heurística simples: o texto tem padrões que o parser regex sabe interpretar?
 * (Bot:, Cliente:, Cenário, listas, hashtags)
 *
 * Usado pra avisar usuário no modo regex de que o texto pode não ser parseado.
 * A IA dispensa essa checagem.
 */
function hasParseableMarkers(text: string): boolean {
  return (
    /\b(bot|gui|atendente|assistente|chatbot)\s*:/i.test(text) ||
    /\b(cliente|user|usuário|customer)\s*:/i.test(text) ||
    /^cenário\s+\d+:/im.test(text) ||
    /^#{1,3}\s+\S+/m.test(text) ||
    /^[-*•]\s+\S+/m.test(text)
  );
}
