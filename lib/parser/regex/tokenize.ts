/**
 * Tokenizer — pega texto bruto e produz uma estrutura de seções + blocos.
 *
 * Responsabilidades:
 *  1. Detectar cabeçalhos de seção
 *  2. Agrupar items de lista contíguos em um `options`
 *  3. Delegar cada linha de fluxo pro `detectBlock`
 *  4. Garantir uma seção default ("Início") quando o texto começa direto
 */

import { normalize } from './normalize';
import { SECTION_HEADER, LIST_ITEM } from './patterns';
import { detectBlock, type ParsedBlock } from './detect-blocks';

export interface ParsedSection {
  title: string;
  blocks: ParsedBlock[];
}

export function tokenize(text: string): ParsedSection[] {
  const normalized = normalize(text);
  const lines = normalized.replace(/\r\n?/g, '\n').split('\n');

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  let pendingList: string[] = [];
  /** true quando a próxima linha não-vazia deve virar título de seção (após ________________) */
  let nextIsSection = false;

  const pushList = () => {
    if (pendingList.length > 0 && current) {
      current.blocks.push({
        kind: 'options',
        items: pendingList.slice(),
        confidence: 0.85,
      });
      pendingList = [];
    }
  };

  const ensureSection = (title: string) => {
    pushList();
    current = { title: title.trim() || 'Sem título', blocks: [] };
    sections.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pushList();
      continue;
    }

    // Separador horizontal (________________ → ===SECTION_BREAK=== via normalize).
    // A PRÓXIMA linha não-vazia vira título da nova seção.
    if (line === '===SECTION_BREAK===') {
      pushList();
      nextIsSection = true;
      continue;
    }

    // Linha logo após separador → força nova seção independente do padrão
    if (nextIsSection) {
      nextIsSection = false;
      ensureSection(line.replace(/^#{1,3}\s+/, '').trim());
      continue;
    }

    // Seção?
    if (SECTION_HEADER.test(line)) {
      const cleaned = line
        .replace(/^#{1,3}\s+/, '')
        .replace(/^cenário\s+\d+:?\s*/i, '')
        .replace(/^frame\s*:?\s+/i, '')
        .replace(/^\d{1,2}[.)]\s+/, '')
        .trim();
      ensureSection(cleaned);
      continue;
    }

    if (!current) ensureSection('Início');

    // Item de lista? Acumula
    const listMatch = line.match(LIST_ITEM);
    if (listMatch) {
      pendingList.push(line.replace(LIST_ITEM, '').trim());
      continue;
    }
    pushList();

    // Detecta bloco individual
    const block = detectBlock(line);
    if (block) current!.blocks.push(block);
  }

  pushList();
  return sections;
}
