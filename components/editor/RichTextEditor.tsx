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
import type { FlowVariable } from '@/lib/variables/extract-variables';
import { filterVariables } from '@/lib/variables/extract-variables';
import {
  createSnippet,
  deleteSnippet,
  searchSnippets,
  type Snippet,
} from '@/lib/snippets/manager';

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
  /**
   * Variáveis do escopo (`{{...}}`) — quando fornecido, mostra botão de
   * autocomplete na toolbar com a lista. Opcional pra não obrigar todos
   * os usos do editor a passar essa info.
   */
  variables?: FlowVariable[];
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
  variables,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const varsBtnRef = useRef<HTMLButtonElement>(null);
  const snippetsBtnRef = useRef<HTMLButtonElement>(null);
  const pickerId = useId();
  const varsPopoverId = useId();
  const snippetsPopoverId = useId();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [varsPos, setVarsPos] = useState<{ top: number; left: number } | null>(null);
  const [varsQuery, setVarsQuery] = useState('');
  // Snippets popover
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [snippetsPos, setSnippetsPos] = useState<{ top: number; left: number } | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [snippetQuery, setSnippetQuery] = useState('');
  const [creatingSnippet, setCreatingSnippet] = useState(false);
  const [newSnippetName, setNewSnippetName] = useState('');
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

  // Abre popover de variáveis ancorado no botão da toolbar.
  const openVarsPopover = useCallback(() => {
    const btn = varsBtnRef.current;
    if (!btn) return setVarsOpen(true);
    const r = btn.getBoundingClientRect();
    const popW = 280;
    const popH = 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.right - popW;
    if (left < 8) left = 8;
    if (left + popW > vw - 8) left = vw - popW - 8;
    let top = r.bottom + 4;
    if (top + popH > vh - 8) {
      top = r.top - popH - 4;
      if (top < 8) top = 8;
    }
    setVarsPos({ top, left });
    setVarsQuery('');
    setVarsOpen(true);
  }, []);

  // Fecha popover de variáveis em click outside + Esc
  useEffect(() => {
    if (!varsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (varsBtnRef.current?.contains(target)) return;
      const pop = document.getElementById(varsPopoverId);
      if (pop?.contains(target)) return;
      setVarsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVarsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [varsOpen, varsPopoverId]);

  // Insere `{{nome}}` na posição do cursor
  const insertVariable = useCallback(
    (name: string) => {
      editorRef.current?.focus();
      document.execCommand('insertText', false, `{{${name}}}`);
      setVarsOpen(false);
      emitChange();
    },
    [emitChange]
  );

  const filteredVars = variables ? filterVariables(variables, varsQuery) : [];

  // ---- Snippets ------------------------------------------------------------
  // Abre popover de snippets — refresca a lista do localStorage a cada abrir.
  const openSnippetsPopover = useCallback(() => {
    const btn = snippetsBtnRef.current;
    if (!btn) return setSnippetsOpen(true);
    const r = btn.getBoundingClientRect();
    const popW = 320;
    const popH = 380;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.right - popW;
    if (left < 8) left = 8;
    if (left + popW > vw - 8) left = vw - popW - 8;
    let top = r.bottom + 4;
    if (top + popH > vh - 8) {
      top = r.top - popH - 4;
      if (top < 8) top = 8;
    }
    setSnippetsPos({ top, left });
    setSnippetQuery('');
    setSnippets(searchSnippets(''));
    setCreatingSnippet(false);
    setNewSnippetName('');
    setSnippetsOpen(true);
  }, []);

  // Fecha popover snippets em click outside + Esc
  useEffect(() => {
    if (!snippetsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (snippetsBtnRef.current?.contains(target)) return;
      const pop = document.getElementById(snippetsPopoverId);
      if (pop?.contains(target)) return;
      setSnippetsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSnippetsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [snippetsOpen, snippetsPopoverId]);

  // Re-filtra ao digitar
  useEffect(() => {
    if (!snippetsOpen) return;
    setSnippets(searchSnippets(snippetQuery));
  }, [snippetQuery, snippetsOpen]);

  // Insere body do snippet no cursor (preserva quebras de linha)
  const insertSnippet = useCallback(
    (body: string) => {
      editorRef.current?.focus();
      // execCommand insertText respeita newlines como <br>; pra preservar
      // melhor o conteúdo markdown, inserimos linha-a-linha via execCommand.
      const lines = body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) document.execCommand('insertHTML', false, '<br>');
        if (lines[i]) document.execCommand('insertText', false, lines[i]);
      }
      setSnippetsOpen(false);
      emitChange();
    },
    [emitChange]
  );

  // Salva o texto atual do editor como snippet novo
  const saveCurrentAsSnippet = useCallback(() => {
    const name = newSnippetName.trim();
    if (!name) return;
    const md = htmlToMarkdown(editorRef.current?.innerHTML ?? '');
    if (!md.trim()) return;
    createSnippet(name, md);
    setNewSnippetName('');
    setCreatingSnippet(false);
    setSnippets(searchSnippets(snippetQuery));
  }, [newSnippetName, snippetQuery]);

  // Remove snippet
  const removeSnippet = useCallback(
    (id: string) => {
      deleteSnippet(id);
      setSnippets(searchSnippets(snippetQuery));
    },
    [snippetQuery]
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
        {variables && variables.length > 0 && (
          <button
            ref={varsBtnRef}
            type="button"
            onClick={() => (varsOpen ? setVarsOpen(false) : openVarsPopover())}
            className="px-1.5 py-0.5 rounded hover:bg-gray-200 font-mono text-[11px]"
            title={`Inserir variável (${variables.length} disponíveis)`}
            aria-expanded={varsOpen}
            aria-controls={varsPopoverId}
          >
            {'{{ }}'}
          </button>
        )}
        <button
          ref={snippetsBtnRef}
          type="button"
          onClick={() =>
            snippetsOpen ? setSnippetsOpen(false) : openSnippetsPopover()
          }
          className="px-1.5 py-0.5 rounded hover:bg-gray-200"
          title="Inserir snippet salvo"
          aria-expanded={snippetsOpen}
          aria-controls={snippetsPopoverId}
        >
          📋
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

      {snippetsOpen &&
        snippetsPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={snippetsPopoverId}
            className="fixed z-[9999] flex flex-col rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            style={{
              top: snippetsPos.top,
              left: snippetsPos.left,
              width: 320,
              maxHeight: 380,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-1 border-b border-slate-200 p-2 dark:border-slate-700">
              <input
                value={snippetQuery}
                onChange={(e) => setSnippetQuery(e.target.value)}
                placeholder="Buscar snippet…"
                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blip-purple dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => setCreatingSnippet((v) => !v)}
                className="rounded px-2 py-1 text-xs text-blip-purple hover:bg-blip-purple/10"
                title="Salvar texto atual como snippet novo"
              >
                + Salvar
              </button>
            </div>

            {creatingSnippet && (
              <div className="border-b border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
                <input
                  autoFocus
                  value={newSnippetName}
                  onChange={(e) => setNewSnippetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCurrentAsSnippet();
                  }}
                  placeholder="Nome do snippet (ex: Saudação)"
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blip-purple dark:border-slate-600 dark:bg-slate-900"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Salva o conteúdo atual deste editor como snippet reusável.
                </p>
                <div className="mt-1 flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingSnippet(false);
                      setNewSnippetName('');
                    }}
                    className="rounded px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveCurrentAsSnippet}
                    disabled={!newSnippetName.trim()}
                    className="rounded bg-blip-purple px-2 py-0.5 text-[11px] text-white hover:bg-blip-purple-dark disabled:opacity-40"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-1">
              {snippets.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Sem snippets salvos. Use <strong>+ Salvar</strong> com texto
                  no editor.
                </div>
              ) : (
                snippets.map((s) => (
                  <div
                    key={s.id}
                    className="group flex items-start gap-1 rounded px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <button
                      type="button"
                      onClick={() => insertSnippet(s.body)}
                      className="flex-1 text-left"
                    >
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-100">
                        {s.name}
                      </div>
                      <div className="line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">
                        {s.body}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSnippet(s.id)}
                      className="invisible rounded px-1 text-[11px] text-red-500 hover:bg-red-50 group-hover:visible dark:hover:bg-red-950"
                      title="Apagar snippet"
                    >
                      🗑
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )}

      {varsOpen &&
        varsPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={varsPopoverId}
            className="fixed z-[9999] flex flex-col rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            style={{ top: varsPos.top, left: varsPos.left, width: 280, maxHeight: 320 }}
            onMouseDown={(e) => e.preventDefault()} // não tira foco do editor
          >
            <input
              autoFocus
              value={varsQuery}
              onChange={(e) => setVarsQuery(e.target.value)}
              placeholder="Buscar variável…"
              className="m-2 rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blip-purple dark:border-slate-600 dark:bg-slate-800"
            />
            <div className="flex-1 overflow-y-auto px-1 pb-1">
              {filteredVars.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma variável encontrada.
                </div>
              ) : (
                filteredVars.map((v) => (
                  <button
                    key={v.nodeId + v.name}
                    type="button"
                    onClick={() => insertVariable(v.name)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="flex flex-col">
                      <span className="font-mono text-blip-purple">{`{{${v.name}}}`}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {v.displayLabel}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {v.source.replace('-', ' ')}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default memo(RichTextEditor);
