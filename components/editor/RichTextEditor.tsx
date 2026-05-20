'use client';

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { htmlToMarkdown, markdownToHtml } from '@/lib/utils/markdown';

// Lazy-load do emoji picker — só baixa o JS quando o usuário abre o picker.
// A lib é pesada (~50kb gz); evitamos no first paint.
const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => (
    <div className="p-3 text-xs text-gray-500">Carregando emojis…</div>
  ),
});

interface RichTextEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Se true, renderiza inline (1 linha, sem quebra). Útil pra header/label de menu. */
  singleLine?: boolean;
}

/**
 * WYSIWYG contenteditable com toolbar pra negrito, itálico, cor e emoji.
 *
 * - Armazena o valor como **markdown WhatsApp** por baixo (`*bold*`, `_italic_`,
 *   `{#hex:colorido}`, `\n` quebra) — preserva compat com export Blip.
 * - Renderiza o markdown como HTML formatado dentro do contenteditable pro
 *   usuário ver o resultado em tempo real.
 * - Atalhos: Ctrl/Cmd+B (bold), Ctrl/Cmd+I (italic).
 * - Cor: input `type=color` aplica `foreColor` na seleção atual via
 *   `execCommand` (deprecated mas funcional em todos browsers).
 * - Emoji: picker que insere Unicode na posição do cursor.
 */
function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 100,
  singleLine = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const pickerId = useId();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  // Re-render quando value muda EXTERNAMENTE (não pelo próprio editor).
  // O contenteditable mantém seu próprio HTML; só re-sincronizamos quando o
  // value vier de fora (ex: troca de node selecionado no panel).
  const lastSyncedValue = useRef<string>('');

  useEffect(() => {
    if (!editorRef.current) return;
    if (lastSyncedValue.current === value) return;
    editorRef.current.innerHTML = markdownToHtml(value);
    lastSyncedValue.current = value;
  }, [value]);

  // Calcula posição do picker (fixed na viewport) baseada no botão.
  // Tenta abrir pra baixo; se não couber, abre pra cima. Sempre encosta
  // pela borda direita do botão (pra picker grande não estourar pra direita).
  const openEmojiPicker = useCallback(() => {
    const btn = emojiBtnRef.current;
    if (!btn) return setEmojiOpen(true);
    const r = btn.getBoundingClientRect();
    const pickerW = 300;
    const pickerH = 380;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Por padrão: abre abaixo do botão. Alinha pela DIREITA do botão pra
    // ficar dentro do sidebar (não vazar pra direita da tela).
    let left = r.right - pickerW;
    if (left < 8) left = 8; // não cola na borda esquerda
    if (left + pickerW > vw - 8) left = vw - pickerW - 8;
    let top = r.bottom + 4;
    if (top + pickerH > vh - 8) {
      // Não cabe abaixo — abre acima
      top = r.top - pickerH - 4;
      if (top < 8) top = 8;
    }
    setPickerPos({ top, left });
    setEmojiOpen(true);
  }, []);

  // Fecha o picker ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!emojiOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (emojiBtnRef.current?.contains(target)) return;
      const picker = document.getElementById(pickerId);
      if (picker?.contains(target)) return;
      setEmojiOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEmojiOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [emojiOpen, pickerId]);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    const md = htmlToMarkdown(editorRef.current.innerHTML);
    lastSyncedValue.current = md;
    onChange(md);
  }, [onChange]);

  // Atalhos Ctrl/Cmd + B / I
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        document.execCommand('bold');
        emitChange();
        return;
      }
      if (mod && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        document.execCommand('italic');
        emitChange();
        return;
      }
      // Em singleLine, Enter não cria quebra
      if (singleLine && e.key === 'Enter') {
        e.preventDefault();
      }
    },
    [emitChange, singleLine]
  );

  // Cola: sanitiza pra texto puro (evita HTML estranho do clipboard)
  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
      emitChange();
    },
    [emitChange]
  );

  // Copy/cut: substitui o conteúdo do clipboard pelo markdown da seleção
  // (em vez do HTML/texto plain) — assim ao colar em WhatsApp/Word/etc o
  // `*negrito*` e `_itálico_` vão junto e mantêm formatação no destino.
  const onCopyOrCut = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      // Só intercepta se a seleção está DENTRO do editor
      if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
      const fragment = range.cloneContents();
      const container = document.createElement('div');
      container.appendChild(fragment);
      const md = htmlToMarkdown(container.innerHTML);
      e.clipboardData.setData('text/plain', md);
      e.preventDefault();
      // No cut, ainda remove o conteúdo selecionado e dispara onChange
      if (e.type === 'cut') {
        document.execCommand('delete');
        emitChange();
      }
    },
    [emitChange]
  );

  // Bold/Italic/Color via toolbar
  const applyBold = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('bold');
    emitChange();
  }, [emitChange]);

  const applyItalic = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('italic');
    emitChange();
  }, [emitChange]);

  const applyColor = useCallback(
    (color: string) => {
      editorRef.current?.focus();
      // execCommand('foreColor') aplica a cor na seleção atual; sem seleção
      // é no-op (não muda o texto futuro como seria útil — limitação).
      document.execCommand('foreColor', false, color);
      emitChange();
    },
    [emitChange]
  );

  // Insere emoji na posição atual do cursor
  const insertEmoji = useCallback(
    (emoji: string) => {
      editorRef.current?.focus();
      document.execCommand('insertText', false, emoji);
      setEmojiOpen(false);
      emitChange();
    },
    [emitChange]
  );

  return (
    <div className="border border-gray-300 rounded bg-white focus-within:border-blip-purple focus-within:ring-1 focus-within:ring-blip-purple/30">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-1.5 py-1 border-b border-gray-200 bg-gray-50/50 text-[12px]">
        <button
          type="button"
          onClick={applyBold}
          className="px-1.5 py-0.5 font-bold rounded hover:bg-gray-200"
          title="Negrito (Ctrl+B) — *texto*"
        >
          B
        </button>
        <button
          type="button"
          onClick={applyItalic}
          className="px-1.5 py-0.5 italic rounded hover:bg-gray-200"
          title="Itálico (Ctrl+I) — _texto_"
        >
          I
        </button>
        <label
          className="px-1.5 py-0.5 rounded hover:bg-gray-200 cursor-pointer flex items-center gap-1"
          title="Cor do texto (só visual no editor)"
        >
          <span className="text-xs">🎨</span>
          <input
            type="color"
            className="w-4 h-4 border-0 cursor-pointer p-0"
            onChange={(e) => applyColor(e.target.value)}
          />
        </label>
        <button
          ref={emojiBtnRef}
          type="button"
          onClick={() => (emojiOpen ? setEmojiOpen(false) : openEmojiPicker())}
          className="px-1.5 py-0.5 rounded hover:bg-gray-200"
          title="Inserir emoji"
          aria-expanded={emojiOpen}
          aria-controls={pickerId}
        >
          😀
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onCopy={onCopyOrCut}
        onCut={onCopyOrCut}
        className="px-2 py-1.5 text-sm outline-none whitespace-pre-wrap break-words"
        style={{ minHeight }}
        data-placeholder={placeholder ?? ''}
      />
      <style jsx>{`
        div[contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>

      {emojiOpen &&
        pickerPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={pickerId}
            className="fixed z-[9999] shadow-2xl rounded-lg overflow-hidden"
            style={{ top: pickerPos.top, left: pickerPos.left }}
            onMouseDown={(e) => e.preventDefault()} // não tira foco do editor
          >
            <EmojiPicker
              onEmojiClick={(emojiData) => insertEmoji(emojiData.emoji)}
              width={300}
              height={380}
            />
          </div>,
          document.body
        )}
    </div>
  );
}

export default memo(RichTextEditor);
