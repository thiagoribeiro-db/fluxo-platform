'use client';

/**
 * Chat IA contextual — painel lateral pra perguntar à IA sobre o fluxo.
 *
 * UX:
 *  - Header com botão de fechar
 *  - Atalhos rápidos: "Explicar este frame" (se houver frame selecionado),
 *    "Sugerir próximo bloco"
 *  - Histórico de mensagens (user/assistant)
 *  - Input livre no rodapé
 *  - Loading state durante chamada Anthropic (~5-15s)
 */

import { useRef, useState, useTransition } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import { askAI, type ChatQuestionKind } from '@/lib/actions/ai-chat';
import { handleError } from '@/lib/utils/errors';

interface AIChatPanelProps {
  nodes: FluxoNode[];
  edges: Edge[];
  /** ID do frame selecionado no canvas (pra "Explicar este frame"). */
  selectedFrameId: string | undefined;
  selectedFrameTitle: string | undefined;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  isLoading?: boolean;
}

export default function AIChatPanel({
  nodes,
  edges,
  selectedFrameId,
  selectedFrameTitle,
  onClose,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      const el = bodyRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  };

  const ask = (kind: ChatQuestionKind, opts?: { question?: string; frameId?: string }) => {
    const display =
      kind === 'explain-frame'
        ? `Explique o frame "${opts?.frameId ?? selectedFrameTitle ?? selectedFrameId ?? ''}"`
        : kind === 'suggest-next'
          ? `Sugira próximo bloco em "${opts?.frameId ?? selectedFrameTitle ?? selectedFrameId ?? ''}"`
          : (opts?.question ?? '');

    setMessages((prev) => [
      ...prev,
      { role: 'user', text: display },
      { role: 'assistant', text: '', isLoading: true },
    ]);
    scrollToBottom();

    startTransition(async () => {
      try {
        const result = await askAI({
          kind,
          question: opts?.question,
          frameId: opts?.frameId ?? selectedFrameId,
          nodes,
          edges,
        });
        setMessages((prev) => {
          const next = [...prev];
          // Substitui o último (que é o loading) pela resposta real
          next[next.length - 1] = { role: 'assistant', text: result.answer };
          return next;
        });
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            text: '⚠️ Falha ao consultar a IA. Tente novamente.',
          };
          return next;
        });
        handleError(err, { context: 'ai-chat', toast: false });
      }
      scrollToBottom();
    });
  };

  const handleSend = () => {
    const v = input.trim();
    if (!v || isPending) return;
    setInput('');
    ask('free', { question: v });
  };

  return (
    <aside className="fixed top-0 right-0 h-full w-[380px] bg-white dark:bg-gray-900 border-l border-gray-300 dark:border-gray-700 shadow-2xl flex flex-col z-30">
      {/* Header */}
      <header className="bg-gradient-to-r from-blip-purple to-blip-purple-dark text-white px-4 py-3 flex items-center gap-2 shrink-0">
        <Sparkles size={18} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm">Assistente IA</h2>
          <p className="text-[11px] text-white/70">Contextualizado no seu fluxo</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-white/10"
          title="Fechar"
          aria-label="Fechar Chat IA"
        >
          <X size={16} />
        </button>
      </header>

      {/* Quick actions */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-1.5 shrink-0">
        {selectedFrameId ? (
          <>
            <QuickButton
              disabled={isPending}
              onClick={() => ask('explain-frame', { frameId: selectedFrameId })}
            >
              💬 Explicar &ldquo;{selectedFrameTitle ?? selectedFrameId}&rdquo;
            </QuickButton>
            <QuickButton
              disabled={isPending}
              onClick={() => ask('suggest-next', { frameId: selectedFrameId })}
            >
              ✨ Sugerir próximo bloco
            </QuickButton>
          </>
        ) : (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
            Selecione um frame no canvas pra ações rápidas
          </p>
        )}
      </div>

      {/* Mensagens */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-12 px-4">
            <Sparkles
              size={28}
              className="mx-auto mb-2 text-blip-purple/40"
            />
            <p>Pergunte sobre o fluxo, peça sugestões ou explicações.</p>
            <p className="text-xs mt-2 text-gray-400">
              Ex: &quot;O fluxo de Algo Mais está bem desenhado?&quot;
            </p>
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={i} message={m} />)
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2 shrink-0 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo sobre o fluxo…"
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1 bg-white dark:bg-gray-900 dark:text-white rounded-md px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blip-purple/40 focus:border-blip-purple disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending || !input.trim()}
            className="bg-blip-purple hover:bg-blip-purple-dark text-white rounded-md w-9 h-9 flex items-center justify-center disabled:opacity-50 transition-colors"
            title="Enviar"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// =============================================================================
// Sub-componentes
// =============================================================================

function QuickButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[11px] font-medium px-2 py-1 rounded-md bg-blip-purple/10 dark:bg-blip-purple/20 text-blip-purple hover:bg-blip-purple/20 dark:hover:bg-blip-purple/30 disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-blip-purple text-white text-sm px-3 py-2 rounded-lg rounded-br-sm">
          {message.text}
        </div>
      </div>
    );
  }
  if (message.isLoading) {
    return (
      <div className="flex justify-start">
        <div className="bg-gray-100 dark:bg-gray-800 text-sm px-3 py-2 rounded-lg rounded-bl-sm inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-typing-dot" />
          <span
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-typing-dot"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-typing-dot"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    );
  }
  // Resposta da IA — markdown leve (apenas quebras de linha por enquanto)
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] bg-gray-100 dark:bg-gray-800 text-sm px-3 py-2 rounded-lg rounded-bl-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200 break-words">
        {message.text}
      </div>
    </div>
  );
}
