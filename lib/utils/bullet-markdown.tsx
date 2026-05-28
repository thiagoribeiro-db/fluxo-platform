/**
 * Mini-renderer de markdown pra preview inline no editor de componentes.
 *
 * Suporta:
 *   **bold**              → <strong>
 *   *italic*              → <em>
 *   `code`                → <code>
 *   [texto](url)          → <a target="_blank">
 *   - item / * item / • item → <ul><li>
 *   linha em branco        → separador de parágrafo
 *
 * NÃO renderiza HTML do input. Sem deps externas.
 */

import type { ReactNode } from 'react';

// ============================================================================
// Inline tokens (bold, italic, code, link, br)
// ============================================================================

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: InlineToken[] }
  | { type: 'italic'; children: InlineToken[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: InlineToken[] }
  | { type: 'br' };

const INLINE_PATTERNS: Array<{
  re: RegExp;
  build: (m: RegExpExecArray) => InlineToken;
}> = [
  { re: /`([^`\n]+)`/, build: (m) => ({ type: 'code', value: m[1] }) },
  {
    re: /\[([^\]\n]+)\]\(([^)\n\s]+)\)/,
    build: (m) => ({
      type: 'link',
      href: m[2],
      children: tokenizeInline(m[1]),
    }),
  },
  {
    re: /\*\*([^*\n]+?)\*\*/,
    build: (m) => ({ type: 'bold', children: tokenizeInline(m[1]) }),
  },
  {
    re: /\*([^*\n]+?)\*/,
    build: (m) => ({ type: 'italic', children: tokenizeInline(m[1]) }),
  },
];

function tokenizeInline(input: string): InlineToken[] {
  if (!input) return [];
  const tokens: InlineToken[] = [];
  let rest = input;

  while (rest.length > 0) {
    let earliest: {
      idx: number;
      pat: (typeof INLINE_PATTERNS)[number];
      match: RegExpExecArray;
    } | null = null;
    for (const pat of INLINE_PATTERNS) {
      const re = new RegExp(pat.re.source);
      const m = re.exec(rest);
      if (m && (earliest === null || m.index < earliest.idx)) {
        earliest = { idx: m.index, pat, match: m };
      }
    }

    if (earliest === null) {
      pushTextWithBreaks(tokens, rest);
      break;
    }

    if (earliest.idx > 0) {
      pushTextWithBreaks(tokens, rest.slice(0, earliest.idx));
    }
    tokens.push(earliest.pat.build(earliest.match));
    rest = rest.slice(earliest.idx + earliest.match[0].length);
  }

  return tokens;
}

function pushTextWithBreaks(tokens: InlineToken[], text: string) {
  if (!text) return;
  const parts = text.split('\n');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length > 0) tokens.push({ type: 'text', value: parts[i] });
    if (i < parts.length - 1) tokens.push({ type: 'br' });
  }
}

function inlineToReact(tokens: InlineToken[], keyPrefix = ''): ReactNode[] {
  return tokens.map((t, i) => {
    const key = `${keyPrefix}${i}`;
    switch (t.type) {
      case 'text':
        return t.value;
      case 'br':
        return <br key={key} />;
      case 'bold':
        return <strong key={key}>{inlineToReact(t.children, key + '.')}</strong>;
      case 'italic':
        return <em key={key}>{inlineToReact(t.children, key + '.')}</em>;
      case 'code':
        return (
          <code
            key={key}
            className="bg-blip-purple/10 text-blip-purple-dark border border-blip-purple/20 px-1.5 py-0.5 rounded-md text-[0.85em] font-mono font-medium"
          >
            {t.value}
          </code>
        );
      case 'link':
        return (
          <a
            key={key}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blip-purple underline hover:text-blip-purple-dark"
          >
            {inlineToReact(t.children, key + '.')}
          </a>
        );
    }
  });
}

// ============================================================================
// Block tokens (paragraph, list)
// ============================================================================

type Block =
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; lines: string[] };

/** Detecta se uma linha é item de lista e retorna o conteúdo, ou null. */
function matchListItem(line: string): string | null {
  const m = /^\s*[-*•]\s+(.*)$/.exec(line);
  return m ? m[1] : null;
}

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    const item = matchListItem(line);
    const isBlank = line.trim().length === 0;

    if (item !== null) {
      if (current?.type !== 'list') {
        if (current) blocks.push(current);
        current = { type: 'list', items: [] };
      }
      current.items.push(item);
    } else if (isBlank) {
      if (current) {
        blocks.push(current);
        current = null;
      }
    } else {
      if (current?.type !== 'paragraph') {
        if (current) blocks.push(current);
        current = { type: 'paragraph', lines: [] };
      }
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  return blocks;
}

function blockToReact(block: Block, key: string): ReactNode {
  if (block.type === 'list') {
    return (
      <ul key={key} className="list-disc pl-5 space-y-1 my-1">
        {block.items.map((item, i) => (
          <li key={i}>{inlineToReact(tokenizeInline(item))}</li>
        ))}
      </ul>
    );
  }
  return (
    <p key={key} className="my-1">
      {inlineToReact(tokenizeInline(block.lines.join('\n')))}
    </p>
  );
}

// ============================================================================
// Public API
// ============================================================================

/** Renderiza markdown (inline + listas + parágrafos) como ReactNode. */
export function renderBulletMarkdown(input: string): ReactNode {
  const blocks = parseBlocks(input);
  return <>{blocks.map((b, i) => blockToReact(b, String(i)))}</>;
}

/** Converte um array de bullets em texto markdown (`- item\n- item`). */
export function bulletsToMarkdown(items: string[] | undefined): string {
  if (!items || items.length === 0) return '';
  return items.map((i) => `- ${i}`).join('\n');
}

/**
 * Parseia texto markdown e extrai os bullets como array.
 * Linhas começando com `-`, `*` ou `•` viram items; linhas sem marker são
 * tratadas como continuação do item anterior (se houver) ou item próprio.
 */
export function markdownToBullets(markdown: string): string[] {
  if (!markdown.trim()) return [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const items: string[] = [];
  let buffer: string | null = null;

  function flush() {
    if (buffer !== null) {
      const trimmed = buffer.trim();
      if (trimmed) items.push(trimmed);
      buffer = null;
    }
  }

  for (const line of lines) {
    const item = matchListItem(line);
    const isBlank = line.trim().length === 0;
    if (item !== null) {
      flush();
      buffer = item;
    } else if (isBlank) {
      flush();
    } else if (buffer !== null) {
      buffer += '\n' + line.trim();
    } else {
      // Linha solta sem bullet — vira item próprio
      buffer = line.trim();
    }
  }
  flush();
  return items;
}
