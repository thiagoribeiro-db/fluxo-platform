/**
 * Compat re-export — o parser real vive em `lib/parser/regex/`.
 *
 * Mantemos esse arquivo pra preservar o import path
 * `@/lib/parser/escopo` que `applyEscopoToProject` usa. Ao tocar nesse
 * código no futuro, considere importar direto de `@/lib/parser/regex`.
 *
 * Versões do parser:
 *  - v1 (legado, removido): heurísticas básicas
 *  - v2 (atual): condicionais, URLs, IA, API, variáveis automáticas,
 *    skills auto-detectadas, fuzzy match em direcionamentos
 */
export { parseEscopoText } from './regex';
