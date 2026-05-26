/**
 * Find & Replace bulk — busca e substitui texto em TODOS os nodes do canvas.
 *
 * Cobre os campos textuais visíveis ao usuário:
 *   - bubble bot/user: text
 *   - menu: header, options[] (cada opção), footer
 *   - btn-short/long: label, buttonText
 *   - direcionamento: label
 *   - condicional: condition, trueLabel, falseLabel
 *   - link: url, linkTitle, linkDescription
 *   - mídias: caption, filename
 *   - integração/IAG: title, fields[].value
 *   - frame: title
 *   - tracking/excecao: label, trackingText, trackingSub, excecaoTitle, excecaoSub
 *
 * Funções PURAS — não mexem em React, retornam dados. UI consome.
 */
import type { FluxoNode } from '@/lib/types';

export interface FindMatch {
  nodeId: string;
  nodeType: string;
  /** Campo onde o match foi encontrado (ex: 'text', 'header', 'options[0]'). */
  field: string;
  /** Valor atual completo do campo. */
  value: string;
  /** Quantas ocorrências do query nesse valor. */
  count: number;
  /** Code do node, pra exibir na UI ("S001", "OF003"). */
  code?: string;
}

export interface FindOptions {
  matchCase?: boolean;
}

/**
 * Lista campos pesquisáveis de cada tipo de node. Mantém em sincronia com
 * `replaceInNode` (deve cobrir os mesmos campos).
 */
const SEARCHABLE_FIELDS: Record<string, string[]> = {
  // 'code' está em todos os tipos com ID semântico — permite buscar por "EN001",
  // "S004" etc. direto. Replace ignora a coluna code via `REPLACE_BLOCKED`.
  'bubble-bot': ['text', 'code'],
  'bubble-user': ['text', 'code'],
  'menu': ['header', 'footer', 'code'],
  'btn-short': ['label', 'buttonText', 'code'],
  'btn-long': ['label', 'buttonText', 'code'],
  'direcionamento': ['label', 'code'],
  'condicional': ['condition', 'trueLabel', 'falseLabel', 'code'],
  'link': ['url', 'linkTitle', 'linkDescription', 'code'],
  'midia-imagem-bot': ['caption', 'filename', 'code'],
  'midia-imagem-user': ['caption', 'filename', 'code'],
  'midia-documento-bot': ['caption', 'filename', 'code'],
  'midia-documento-user': ['caption', 'filename', 'code'],
  'midia-video-bot': ['caption', 'filename', 'code'],
  'midia-video-user': ['caption', 'filename', 'code'],
  'midia-audio-bot': ['caption', 'code'],
  'midia-audio-user': ['caption', 'code'],
  'whatsapp-flow': ['flowName', 'triggerLabel', 'code'],
  'integracao-api': ['title', 'code'],
  'integracao-planilha': ['title', 'code'],
  'iag-entrada': ['title', 'code'],
  'iag-reentrada': ['title', 'code'],
  'iag-saida': ['title', 'code'],
  'frame': ['title', 'frameId', 'prefix'],
  'tracking': ['label', 'trackingText', 'trackingSub'],
  'excecao': ['label', 'excecaoTitle', 'excecaoSub'],
  'entry-point': ['label'],
  'atendimento-humano': ['label', 'code'],
};

/**
 * Campos que aparecem em SEARCHABLE_FIELDS pra BUSCA mas que NÃO devem ser
 * substituídos pelo replace (perigosos — quebram lookups internos).
 */
const REPLACE_BLOCKED = new Set(['code', 'frameId', 'prefix']);

function countOccurrences(haystack: string, query: string, matchCase: boolean): number {
  if (!query) return 0;
  const h = matchCase ? haystack : haystack.toLowerCase();
  const q = matchCase ? query : query.toLowerCase();
  let count = 0;
  let idx = 0;
  while ((idx = h.indexOf(q, idx)) !== -1) {
    count++;
    idx += q.length;
  }
  return count;
}

function replaceAll(haystack: string, query: string, replacement: string, matchCase: boolean): string {
  if (!query) return haystack;
  if (matchCase) {
    return haystack.split(query).join(replacement);
  }
  // Case-insensitive replace preservando ocorrências múltiplas
  const result: string[] = [];
  const lower = haystack.toLowerCase();
  const q = query.toLowerCase();
  let i = 0;
  let pos = lower.indexOf(q, i);
  while (pos !== -1) {
    result.push(haystack.slice(i, pos));
    result.push(replacement);
    i = pos + q.length;
    pos = lower.indexOf(q, i);
  }
  result.push(haystack.slice(i));
  return result.join('');
}

/**
 * Busca `query` em todos os nodes e retorna lista de matches.
 *
 * Inclui campos string SIMPLES e elementos de arrays (ex: menu.options[N]).
 * Cada match conta as ocorrências dentro do campo (pra mostrar "X occurrences").
 */
export function findInNodes(
  nodes: FluxoNode[],
  query: string,
  opts: FindOptions = {}
): FindMatch[] {
  const matchCase = opts.matchCase ?? false;
  if (!query) return [];

  const matches: FindMatch[] = [];
  for (const node of nodes) {
    if (!node.type) continue;
    const fields = SEARCHABLE_FIELDS[node.type] ?? [];
    const data = (node.data ?? {}) as Record<string, unknown>;

    for (const field of fields) {
      const value = data[field];
      if (typeof value === 'string' && value) {
        const count = countOccurrences(value, query, matchCase);
        if (count > 0) {
          matches.push({
            nodeId: node.id,
            nodeType: node.type,
            field,
            value,
            count,
            code: data.code as string | undefined,
          });
        }
      }
    }

    // Arrays de strings (menu.options, integracao.fields[].value)
    if (node.type === 'menu') {
      const options = (data.options as string[] | undefined) ?? [];
      options.forEach((opt, i) => {
        if (typeof opt === 'string' && opt) {
          const count = countOccurrences(opt, query, matchCase);
          if (count > 0) {
            matches.push({
              nodeId: node.id,
              nodeType: node.type!,
              field: `options[${i}]`,
              value: opt,
              count,
              code: data.code as string | undefined,
            });
          }
        }
      });
    }

    if (
      node.type === 'integracao-api' ||
      node.type === 'integracao-planilha' ||
      node.type === 'iag-entrada' ||
      node.type === 'iag-reentrada' ||
      node.type === 'iag-saida'
    ) {
      const fieldsArr = (data.fields as Array<{ label: string; key: string; value: string }> | undefined) ?? [];
      fieldsArr.forEach((f, i) => {
        if (typeof f.value === 'string' && f.value) {
          const count = countOccurrences(f.value, query, matchCase);
          if (count > 0) {
            matches.push({
              nodeId: node.id,
              nodeType: node.type!,
              field: `fields[${i}].value`,
              value: f.value,
              count,
              code: data.code as string | undefined,
            });
          }
        }
      });
    }
  }

  return matches;
}

/**
 * Aplica replace em todos os nodes. Retorna lista nova de nodes (não muta
 * a entrada). Conta total de substituições feitas.
 */
export function replaceInNodes(
  nodes: FluxoNode[],
  query: string,
  replacement: string,
  opts: FindOptions = {}
): { nodes: FluxoNode[]; totalReplacements: number; affectedNodeIds: string[] } {
  const matchCase = opts.matchCase ?? false;
  if (!query) return { nodes, totalReplacements: 0, affectedNodeIds: [] };

  let totalReplacements = 0;
  const affected = new Set<string>();

  const newNodes = nodes.map((node) => {
    if (!node.type) return node;
    const fields = SEARCHABLE_FIELDS[node.type] ?? [];
    const data = (node.data ?? {}) as Record<string, unknown>;
    const newData: Record<string, unknown> = { ...data };
    let nodeChanged = false;

    for (const field of fields) {
      // Campos sensíveis (code, frameId, prefix) entram na busca mas não
      // permitem substituição — evita quebrar lookups internos.
      if (REPLACE_BLOCKED.has(field)) continue;
      const value = newData[field];
      if (typeof value === 'string' && value) {
        const count = countOccurrences(value, query, matchCase);
        if (count > 0) {
          newData[field] = replaceAll(value, query, replacement, matchCase);
          totalReplacements += count;
          nodeChanged = true;
        }
      }
    }

    if (node.type === 'menu') {
      const options = (newData.options as string[] | undefined) ?? [];
      const newOptions = options.map((opt) => {
        if (typeof opt !== 'string' || !opt) return opt;
        const count = countOccurrences(opt, query, matchCase);
        if (count > 0) {
          totalReplacements += count;
          nodeChanged = true;
          return replaceAll(opt, query, replacement, matchCase);
        }
        return opt;
      });
      if (nodeChanged) newData.options = newOptions;
    }

    if (
      node.type === 'integracao-api' ||
      node.type === 'integracao-planilha' ||
      node.type === 'iag-entrada' ||
      node.type === 'iag-reentrada' ||
      node.type === 'iag-saida'
    ) {
      const fieldsArr = (newData.fields as Array<{ label: string; key: string; value: string }> | undefined) ?? [];
      const newFields = fieldsArr.map((f) => {
        if (typeof f.value !== 'string' || !f.value) return f;
        const count = countOccurrences(f.value, query, matchCase);
        if (count > 0) {
          totalReplacements += count;
          nodeChanged = true;
          return { ...f, value: replaceAll(f.value, query, replacement, matchCase) };
        }
        return f;
      });
      if (nodeChanged) newData.fields = newFields;
    }

    if (!nodeChanged) return node;
    affected.add(node.id);
    return { ...node, data: newData } as FluxoNode;
  });

  return {
    nodes: newNodes,
    totalReplacements,
    affectedNodeIds: Array.from(affected),
  };
}
