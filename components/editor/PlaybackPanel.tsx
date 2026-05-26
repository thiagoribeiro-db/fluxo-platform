'use client';

/**
 * Test Playground — painel à direita estilo WhatsApp que simula a
 * conversa do fluxo. Usa `usePlayback` pra rodar o `flow-runner`.
 *
 * UX:
 *  - Mensagens aparecem PROGRESSIVAMENTE (uma por vez com delay 400ms)
 *    + typing indicator entre elas — simula a sensação real do bot
 *  - Menus aparecem dentro da conversa como bubbles interativas
 *    (não só botões no footer)
 *  - Footer dinâmico: input texto / choice boolean / mensagem "..."
 *  - Reset limpa tudo (incluindo typing indicator pendente)
 *
 * `onActiveNode` é chamado a cada novo evento — pra highlight do node
 * ativo no canvas.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  FileText,
  Image as ImageIcon,
  Link2,
  Mic,
  RotateCcw,
  Send,
  Video,
  X,
  Zap,
} from 'lucide-react';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import { usePlayback } from '@/lib/playback/use-playback';
import type { RunnerEvent } from '@/lib/playback/flow-runner';
import { track } from '@/lib/analytics/posthog';

interface PlaybackPanelProps {
  nodes: FluxoNode[];
  edges: Edge[];
  onClose: () => void;
  /** Chamado com o nodeId do último evento bot/user — pra highlight no canvas. */
  onActiveNode?: (nodeId: string | null) => void;
}

const MESSAGE_DELAY_MS = 400;

/**
 * Wrapper externo. Mantém apenas um `sessionId` que muda a cada reset —
 * isso força o `PlaybackSession` interno a REMONTAR (via key), garantindo
 * que TODO state/refs/timers seja limpo sem precisar sincronizar manualmente.
 */
export default function PlaybackPanel(props: PlaybackPanelProps) {
  const [sessionId, setSessionId] = useState(0);
  return (
    <PlaybackSession
      key={sessionId}
      {...props}
      onResetSession={() => setSessionId((s) => s + 1)}
    />
  );
}

function PlaybackSession({
  nodes,
  edges,
  onClose,
  onActiveNode,
  onResetSession,
}: PlaybackPanelProps & { onResetSession: () => void }) {
  const playback = usePlayback(nodes, edges);
  const [textInput, setTextInput] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  // ---- Staggered display: mostra uma mensagem por vez com delay -----------
  // Strategy: a cada novo evento na timeline, agenda animação progressiva
  // do `revealCount` (quantos eventos estão visíveis). Sem refs, sem
  // setTimeout encadeado — useEffect direto observa o "gap" e dispara um
  // próximo reveal.
  const [revealCount, setRevealCount] = useState(0);

  useEffect(() => {
    if (revealCount >= playback.timeline.length) return;
    const nextEvent = playback.timeline[revealCount];
    const delay = nextEvent.kind === 'user-input' ? 50 : MESSAGE_DELAY_MS;
    const timer = setTimeout(() => {
      setRevealCount((c) => c + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [revealCount, playback.timeline]);

  const displayed = playback.timeline.slice(0, revealCount);
  const isTyping = revealCount < playback.timeline.length;

  // ---- Side effects: active node + auto-scroll ----------------------------

  useEffect(() => {
    if (!onActiveNode) return;
    for (let i = displayed.length - 1; i >= 0; i--) {
      const ev = displayed[i];
      if ('nodeId' in ev && ev.nodeId) {
        onActiveNode(ev.nodeId);
        return;
      }
    }
    onActiveNode(null);
  }, [displayed, onActiveNode]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [revealCount, isTyping]);

  // Cleanup do highlight ao fechar
  useEffect(() => {
    return () => {
      onActiveNode?.(null);
    };
  }, [onActiveNode]);

  // Track início e fim da sessão (uma vez por mount/finish)
  useEffect(() => {
    track('playback_started', { totalEvents: playback.timeline.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (playback.state.finished) {
      track('playback_finished', { events: playback.timeline.length });
    }
  }, [playback.state.finished, playback.timeline.length]);

  // ---- Handlers -----------------------------------------------------------

  const handleSendText = useCallback(() => {
    const v = textInput.trim();
    if (!v) return;
    playback.send({ userInput: v });
    setTextInput('');
  }, [textInput, playback]);

  // Reset robusto: dispara key change no wrapper, remontando o componente
  // do zero. Limpa state e timers — tudo automático.
  const handleReset = useCallback(() => {
    onResetSession();
  }, [onResetSession]);

  // O menu/choice interativo pode estar JÁ EXIBIDO (último evento bot-menu).
  // Pra evitar repetir no footer, usamos `awaiting` só pra detectar o estado.
  const awaitingKind = isTyping ? 'none' : playback.state.awaiting.kind;

  const statusLabel = playback.state.finished
    ? '✓ Finalizado'
    : isTyping
      ? 'Digitando…'
      : awaitingKind === 'none'
        ? 'Iniciando…'
        : 'Aguardando você';

  return (
    <aside className="fixed top-0 right-0 h-full w-[360px] bg-wpp-bg-chat border-l border-gray-300 shadow-2xl flex flex-col z-30">
      {/* Header */}
      <header className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3 shadow-md shrink-0">
        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white">
          <Bot size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Test Playground</div>
          <div className="text-[11px] text-white/80">{statusLabel}</div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          title="Reiniciar conversa"
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          title="Fechar"
          aria-label="Fechar Test Playground"
        >
          <X size={16} />
        </button>
      </header>

      {/* Conversa */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(0,0,0,0.02) 35px, rgba(0,0,0,0.02) 70px)',
        }}
      >
        {displayed.map((event, idx) => (
          <EventBubble
            key={idx}
            event={event}
            // Menu/cond/buttons: só permite click se for o ÚLTIMO evento exibido (atual)
            interactive={idx === displayed.length - 1 && !isTyping}
            onMenuChoose={(opt) => playback.send({ userInput: opt })}
            onCondChoose={(v) => playback.send({ conditionalChoice: v })}
            onButtonClick={(btnNodeId) => playback.send({ btnNodeId })}
          />
        ))}

        {isTyping && <TypingIndicator />}

        {playback.state.finished && !isTyping && (
          <div className="text-center text-xs text-gray-500 mt-4 pb-4">
            Conversa finalizada.{' '}
            <button
              type="button"
              onClick={handleReset}
              className="text-blip-purple hover:underline font-medium"
            >
              Reiniciar
            </button>
          </div>
        )}
      </div>

      {/* Footer dinâmico — só pra text input. Menu/cond ficam dentro da conversa */}
      <footer className="bg-gray-100 border-t border-gray-300 p-2 shrink-0">
        {awaitingKind === 'text' ? (
          <TextInput
            value={textInput}
            onChange={setTextInput}
            onSend={handleSendText}
          />
        ) : awaitingKind === 'menu' || awaitingKind === 'buttons' ? (
          <div className="text-center text-[11px] text-gray-500 py-2">
            👆 Clique numa opção acima
          </div>
        ) : awaitingKind === 'conditional' ? (
          <div className="text-center text-[11px] text-gray-500 py-2">
            👆 Escolha verdadeiro ou falso acima
          </div>
        ) : (
          <div className="text-center text-[11px] text-gray-500 py-2">
            {playback.state.finished ? 'Conversa finalizada' : isTyping ? '...' : '…'}
          </div>
        )}
      </footer>
    </aside>
  );
}

// =============================================================================
// EventBubble — renderiza um evento da timeline
// =============================================================================

interface EventBubbleProps {
  event: RunnerEvent;
  /** Se true, opções de menu/cond/buttons podem ser clicadas (só pro evento atual). */
  interactive: boolean;
  onMenuChoose: (opt: string) => void;
  onCondChoose: (v: boolean) => void;
  onButtonClick: (btnNodeId: string) => void;
}

function EventBubble({
  event,
  interactive,
  onMenuChoose,
  onCondChoose,
  onButtonClick,
}: EventBubbleProps) {
  switch (event.kind) {
    case 'bot-text':
      return (
        <div className="flex justify-start">
          <div className="bubble-bot text-sm leading-snug max-w-[80%] whitespace-pre-wrap break-words">
            {event.text}
          </div>
        </div>
      );
    case 'bot-media':
      return (
        <div className="flex justify-start">
          <div className="bubble-bot max-w-[80%]">
            <MediaPreview
              kind={event.mediaKind}
              caption={event.caption}
              filename={event.filename}
            />
          </div>
        </div>
      );
    case 'bot-link':
      return (
        <div className="flex justify-start">
          <div className="bubble-bot text-sm leading-snug max-w-[80%]">
            <div className="flex items-center gap-1.5 text-blue-600 font-medium">
              <Link2 size={14} /> {event.title || 'Link'}
            </div>
            {event.description && (
              <div className="text-xs text-gray-600 mt-1">{event.description}</div>
            )}
            <div className="text-[10px] text-gray-400 mt-1 break-all">{event.url}</div>
          </div>
        </div>
      );
    case 'bot-menu':
      return (
        <div className="flex justify-start">
          <div className="bubble-bot max-w-[90%] w-full">
            <div className="text-sm text-gray-900 mb-2">{event.header}</div>
            <div className="space-y-1">
              {event.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!interactive}
                  onClick={() => onMenuChoose(opt)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-md border border-gray-200 transition-colors ${
                    interactive
                      ? 'bg-white hover:bg-blip-purple/10 hover:text-blip-purple-dark hover:border-blip-purple/40 cursor-pointer'
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span className="font-mono text-[10px] text-gray-400 mr-1.5">
                    {i + 1}.
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    case 'bot-conditional':
      return (
        <div className="flex justify-start">
          <div className="bubble-bot max-w-[90%] w-full">
            <div className="text-[10px] uppercase tracking-wide text-amber-600 font-bold mb-1">
              Condicional
            </div>
            <div className="text-sm text-gray-900 mb-2">{event.condition}</div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onCondChoose(true)}
                className={`flex-1 text-sm font-medium py-1.5 px-3 rounded-md transition-colors ${
                  interactive
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                ✓ {event.trueLabel}
              </button>
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onCondChoose(false)}
                className={`flex-1 text-sm font-medium py-1.5 px-3 rounded-md transition-colors ${
                  interactive
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                ✗ {event.falseLabel}
              </button>
            </div>
          </div>
        </div>
      );
    case 'bot-integration': {
      // Pra integracao-api COM mock configurado, mostra o request resumido
      // + status do mock + JSON da resposta. Pra outros tipos (planilha, iag),
      // só o título.
      const isApi = event.subtype === 'integracao-api';
      const hasMock = isApi && !!event.apiMockResponse;
      const status = event.apiMockStatus ?? 200;
      const statusColor =
        status >= 200 && status < 300
          ? 'text-green-700 bg-green-100'
          : status >= 400
            ? 'text-red-700 bg-red-100'
            : 'text-amber-700 bg-amber-100';

      return (
        <div className="flex justify-start">
          <div className="bubble-bot text-sm max-w-[85%]">
            <div className="flex items-center gap-1.5 text-blip-purple font-semibold">
              <Zap size={14} /> {event.title}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">{event.subtype}</div>
            {isApi && event.apiUrl && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono">
                <span className="font-bold text-gray-700">{event.apiMethod ?? 'GET'}</span>
                <span className="text-gray-500 truncate">{event.apiUrl}</span>
              </div>
            )}
            {hasMock && (
              <div className="mt-1.5">
                <div className="flex items-center gap-1.5 text-[10px] mb-0.5">
                  <span className={`font-mono font-bold px-1 py-0 rounded ${statusColor}`}>
                    {status}
                  </span>
                  <span className="text-gray-500 uppercase tracking-wide">
                    Mock response
                  </span>
                </div>
                <pre className="text-[10px] font-mono bg-gray-50 border border-gray-200 rounded px-1.5 py-1 max-h-[160px] overflow-auto whitespace-pre-wrap break-words text-gray-700">
                  {event.apiMockResponse}
                </pre>
              </div>
            )}
            {isApi && !hasMock && event.apiUrl && (
              <div className="mt-1.5 text-[10px] text-amber-700 italic">
                Sem mock — defina o Response Mock nas propriedades pra simular.
              </div>
            )}
          </div>
        </div>
      );
    }
    case 'user-input':
      return (
        <div className="flex justify-end">
          <div className="bubble-user text-sm max-w-[80%] whitespace-pre-wrap break-words">
            {event.placeholder ?? '...'}
          </div>
        </div>
      );
    case 'user-buttons':
      return (
        <div className="flex justify-start">
          <div className="bubble-bot max-w-[90%] w-full">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
              Escolha uma opção
            </div>
            <div className="flex flex-wrap gap-1.5">
              {event.buttons.map((b) => (
                <button
                  key={b.btnNodeId}
                  type="button"
                  disabled={!interactive}
                  onClick={() => onButtonClick(b.btnNodeId)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    interactive
                      ? 'border-blip-purple text-blip-purple hover:bg-blip-purple hover:text-white cursor-pointer'
                      : 'border-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {b.label || '...'}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    case 'system':
      return (
        <div className="text-center my-2">
          <span className="inline-block text-[11px] bg-white/70 px-2 py-1 rounded shadow-sm text-gray-600">
            {event.text}
          </span>
        </div>
      );
    case 'end':
      return (
        <div className="text-center my-2">
          <span className="inline-block text-[11px] bg-emerald-100 px-2 py-1 rounded shadow-sm text-emerald-800">
            {event.reason === 'handoff'
              ? '🧑 Transbordo pro humano'
              : event.reason === 'dead-end'
                ? '⛔ Fim do caminho'
                : '✓ Fluxo completo'}
          </span>
        </div>
      );
  }
}

// =============================================================================
// TypingIndicator — 3 pontinhos pulsantes
// =============================================================================

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bubble-bot inline-flex items-center gap-1 py-2.5">
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

// =============================================================================
// MediaPreview
// =============================================================================

function MediaPreview({
  kind,
  caption,
  filename,
}: {
  kind: 'imagem' | 'documento' | 'video' | 'audio';
  caption?: string;
  filename?: string;
}) {
  const Icon =
    kind === 'imagem'
      ? ImageIcon
      : kind === 'video'
        ? Video
        : kind === 'audio'
          ? Mic
          : FileText;
  const label =
    kind === 'imagem'
      ? 'Imagem'
      : kind === 'video'
        ? 'Vídeo'
        : kind === 'audio'
          ? 'Áudio'
          : filename || 'Documento';
  return (
    <div>
      <div className="bg-gray-200 rounded-lg p-3 flex items-center gap-2 text-gray-600 text-xs">
        <Icon size={18} />
        <span className="font-medium">{label}</span>
      </div>
      {/* WhatsApp Cloud API não suporta caption em áudio — só mostramos pra documentação interna */}
      {caption && kind !== 'audio' && (
        <div className="text-sm text-gray-900 mt-1">{caption}</div>
      )}
    </div>
  );
}

// =============================================================================
// TextInput (footer)
// =============================================================================

function TextInput({
  value,
  onChange,
  onSend,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="Digite uma resposta…"
        className="flex-1 bg-white rounded-full px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blip-purple/30"
      />
      <button
        type="button"
        onClick={onSend}
        className="bg-[#075e54] hover:bg-[#054a40] text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors"
        title="Enviar"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
