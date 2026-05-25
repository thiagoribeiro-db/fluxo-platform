/**
 * Extrator de variáveis dos textos — gera trackings automáticos.
 *
 * Cobre 4 sintaxes comuns + 1 heurística semântica:
 *  - `{{nome}}` (handlebars/Blip)
 *  - `{nome}`   (single brace)
 *  - `[NOME]`   (uppercase bracket, estilo Blip legado)
 *  - `<nome>`   (angle bracket)
 *  - "Pergunta o nome", "Coleta o CPF" — verbo + entidade conhecida
 */

import * as P from './patterns';

export interface ExtractedVar {
  /** Nome normalizado (slug, lowercase, sem espaços). Ex: 'nome', 'cpf'. */
  name: string;
  /** Como apareceu no texto original — útil pra label do tracking. */
  raw: string;
  /** De qual sintaxe veio. */
  source: 'handlebars' | 'brace' | 'bracket' | 'angle' | 'verb';
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Extrai TODAS as variáveis de um texto, deduplicadas por `name`.
 * Primeiro match ganha.
 */
export function extractVariables(text: string): ExtractedVar[] {
  const out: ExtractedVar[] = [];
  const seen = new Set<string>();

  function push(v: ExtractedVar) {
    if (!v.name || seen.has(v.name)) return;
    seen.add(v.name);
    out.push(v);
  }

  // {{handlebars}} primeiro (mais comum em Blip)
  for (const m of text.matchAll(P.VAR_HANDLEBARS)) {
    const raw = m[1];
    push({ name: slugify(raw), raw, source: 'handlebars' });
  }

  // [BRACKET_UPPER]
  for (const m of text.matchAll(P.VAR_BRACKET_UPPER)) {
    const raw = m[1];
    push({ name: slugify(raw), raw, source: 'bracket' });
  }

  // <angle>
  for (const m of text.matchAll(P.VAR_ANGLE)) {
    const raw = m[1];
    push({ name: slugify(raw), raw, source: 'angle' });
  }

  // {singleBrace} — depois pra não conflitar com handlebars
  // Pular se contiver JSON-like aspas/colons no contexto
  for (const m of text.matchAll(P.VAR_SINGLE_BRACE)) {
    const idx = m.index ?? 0;
    const surrounding = text.slice(Math.max(0, idx - 2), Math.min(text.length, idx + m[0].length + 2));
    // Pula se for parte de JSON ({"key": "value") ou similar
    if (/[\"\':,]/.test(surrounding.replace(m[0], ''))) continue;
    const raw = m[1];
    push({ name: slugify(raw), raw, source: 'brace' });
  }

  // Heurística semântica: "Pergunta o nome do cliente" → var: nome
  // O CAPTURE_VERB já é regex global-friendly; reusamos com 'gi'.
  const captureGlobal = new RegExp(P.CAPTURE_VERB.source, 'gi');
  for (const m of text.matchAll(captureGlobal)) {
    const raw = m[1];
    if (raw) push({ name: slugify(raw), raw, source: 'verb' });
  }

  return out;
}
