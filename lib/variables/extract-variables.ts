/**
 * Coleta variáveis declaradas pelo fluxo — pra autocomplete `{{...}}`.
 *
 * Fontes:
 *  - tracking-input  → label vira o nome da variável capturada
 *  - tracking-output → idem (variável escrita)
 *  - iag-saida       → label/title é o nome do output da IA
 *  - bubble-user     → o que o user disse fica em variável (label como hint)
 *
 * Outras fontes possíveis no futuro: integração-api response keys,
 * condicional outputs, etc. Por enquanto cobrimos o caso mais comum.
 *
 * Função PURA — sem React, sem DOM. Testável.
 */

import type { FluxoNode } from '@/lib/types';

export interface FlowVariable {
  /** Nome "normalizado" pra usar entre `{{...}}` (sem espaços/acentos). */
  name: string;
  /** Label original (com espaços e acentos) — só pra mostrar na UI. */
  displayLabel: string;
  /** De onde veio a variável. */
  source: 'tracking-input' | 'tracking-output' | 'iag-saida' | 'bubble-user';
  /** Code do bloco que declarou (ex: "U001"). Útil pra desempate na UI. */
  code?: string;
  /** ID do node de origem. */
  nodeId: string;
}

function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos
      .toLowerCase()
      // troca espaços e separadores por underscore
      .replace(/[^a-z0-9]+/g, '_')
      // remove leading/trailing _
      .replace(/^_+|_+$/g, '')
  );
}

/**
 * Tenta extrair só o "nome" do label de um tracking — a label costuma vir
 * formato "X input" ou "Y output", queremos só "x".
 */
function extractTrackingVarName(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const trimmed = label.trim();
  // Remove sufixo "input" ou "output"
  const stripped = trimmed
    .replace(/\s+(input|output)\s*$/i, '')
    .trim();
  return stripped || trimmed;
}

export function extractVariables(nodes: FluxoNode[]): FlowVariable[] {
  const out: FlowVariable[] = [];
  for (const n of nodes) {
    const data = n.data as Record<string, unknown> | undefined;
    if (!data) continue;
    const label = data.label as string | undefined;
    const code = data.code as string | undefined;

    if (n.type === 'tracking') {
      // O tracking pode ser input OU output — detectado pelo sufixo da label
      const raw = label?.trim() ?? '';
      const isOutput = /output\s*$/i.test(raw);
      const source: FlowVariable['source'] = isOutput
        ? 'tracking-output'
        : 'tracking-input';
      const name = extractTrackingVarName(label);
      if (name) {
        out.push({
          name: slugify(name),
          displayLabel: name,
          source,
          code,
          nodeId: n.id,
        });
      }
    } else if (n.type === 'iag-saida') {
      const title = (data.title as string | undefined) ?? label;
      if (title) {
        out.push({
          name: slugify(title),
          displayLabel: title,
          source: 'iag-saida',
          code,
          nodeId: n.id,
        });
      }
    } else if (n.type === 'bubble-user') {
      // bubble-user implicitamente captura a resposta do usuário — usa code
      // como nome (ex: "U001") ou label se houver hint
      const hint = (data.text as string | undefined) ?? label;
      const baseName = code ?? hint;
      if (baseName) {
        out.push({
          name: slugify(baseName),
          displayLabel: hint ?? code ?? n.id,
          source: 'bubble-user',
          code,
          nodeId: n.id,
        });
      }
    }
  }

  // Dedupe por `name` — primeiro ganha
  const seen = new Set<string>();
  const deduped: FlowVariable[] = [];
  for (const v of out) {
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    deduped.push(v);
  }
  return deduped;
}

/**
 * Filtra a lista de variáveis pelo termo de busca digitado depois do `{{`.
 * Case-insensitive, match por substring tanto em `name` quanto em `displayLabel`.
 */
export function filterVariables(
  vars: FlowVariable[],
  query: string
): FlowVariable[] {
  const q = query.trim().toLowerCase();
  if (!q) return vars;
  return vars.filter(
    (v) =>
      v.name.toLowerCase().includes(q) ||
      v.displayLabel.toLowerCase().includes(q)
  );
}
