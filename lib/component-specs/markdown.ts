/**
 * Encoder/decoder de ComponentSpec em formato MARKDOWN human-readable.
 *
 * O markdown gerado por `specsToMarkdown` segue o mesmo formato do export
 * inicial em `tmp/componentes-completo.md` — pretty, agrupado por componente,
 * com seções nomeadas e listas em bullets.
 *
 * O parser (`parseMarkdownSpecs`) é DELIBERADAMENTE CONSERVADOR. Ele só re-lê
 * de volta as seções que são "texto puro" (sem schema complexo):
 *  - Metadata (displayName, icon, category, flowControl, nodeType)
 *  - Descrição → description
 *  - Pistas de detecção → detectionCues
 *  - Regras de uso → usageRules
 *  - Erros comuns (evitar) → commonMistakes
 *  - Instruções extras pra IA → aiInstructions
 *  - Campos: SÓ as sub-chaves `Descrição` e `Dica pra IA` de cada campo;
 *    type/required/default/enum ficam preservados do spec atual.
 *
 * Seções estruturais (Regras do builder, Exemplos) NÃO são re-parseadas —
 * o `applySpecsImport` funde o que foi parseado com o spec ORIGINAL do DB,
 * preservando essas seções intactas. O usuário continua editando-as via UI.
 */

import type { ComponentSpec, ComponentField } from './spec-schema';

// =============================================================================
// ENCODER — ComponentSpec[] → Markdown
// =============================================================================

export function specsToMarkdown(specs: ComponentSpec[]): string {
  const parts: string[] = [];

  parts.push('# Componentes do Fluxo Platform');
  parts.push('');
  parts.push(
    'Este arquivo agrupa **TODOS** os specs de componente atuais. Edite à vontade — descrições, regras, dicas. Estrutura (type/required/default dos campos, regras do builder, exemplos) só pode ser editada pela UI da dashboard.'
  );
  parts.push('');
  parts.push('**Convenção de edição:**');
  parts.push(
    '- Não mude os títulos de SEÇÃO (`## Metadata`, `## Descrição`, etc) — o parser usa eles pra dividir o conteúdo.'
  );
  parts.push('- Não mude o `id:` do componente — é a chave de identificação.');
  parts.push(
    '- Campos opcionais que você não quer mais: apague o valor mas mantenha o cabeçalho da seção (ou apague a seção inteira).'
  );
  parts.push('');
  parts.push(`Total: ${specs.length} componentes.`);
  parts.push('');
  parts.push('---');
  parts.push('');

  for (const spec of specs) {
    parts.push(specToMarkdown(spec));
    parts.push('');
    parts.push('---');
    parts.push('');
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function specToMarkdown(spec: ComponentSpec): string {
  const lines: string[] = [];

  lines.push(`# ${spec.displayName} (\`${spec.id}\`)`);
  lines.push('');

  // ---- Metadata
  lines.push('## Metadata');
  lines.push('');
  lines.push(`- **id**: \`${spec.id}\` (NÃO MUDAR)`);
  lines.push(`- **displayName**: ${spec.displayName}`);
  lines.push(`- **icon**: ${spec.icon}`);
  lines.push(`- **category**: ${spec.category}`);
  const nt = Array.isArray(spec.nodeType)
    ? spec.nodeType.map((t) => `\`${t}\``).join(', ')
    : `\`${spec.nodeType}\``;
  lines.push(`- **nodeType**: ${nt}`);
  lines.push(`- **flowControl**: ${spec.flowControl}`);
  lines.push('');

  // ---- Descrição
  lines.push('## Descrição');
  lines.push('');
  lines.push(spec.description.trim());
  lines.push('');

  // ---- Pistas de detecção
  if (spec.detectionCues && spec.detectionCues.length > 0) {
    lines.push('## Pistas de detecção');
    lines.push('');
    lines.push(
      'Sinais textuais que indicam que esse componente deve ser usado pela IA.'
    );
    lines.push('');
    for (const cue of spec.detectionCues) {
      lines.push(`- ${cue}`);
    }
    lines.push('');
  }

  // ---- Regras de uso
  if (spec.usageRules && spec.usageRules.length > 0) {
    lines.push('## Regras de uso');
    lines.push('');
    lines.push('Como a IA deve interpretar e emitir esse componente.');
    lines.push('');
    for (const rule of spec.usageRules) {
      lines.push(`- ${rule}`);
    }
    lines.push('');
  }

  // ---- Erros comuns
  if (spec.commonMistakes && spec.commonMistakes.length > 0) {
    lines.push('## Erros comuns (evitar)');
    lines.push('');
    for (const mistake of spec.commonMistakes) {
      lines.push(`- ${mistake}`);
    }
    lines.push('');
  }

  // ---- Campos
  if (spec.fields && Object.keys(spec.fields).length > 0) {
    lines.push('## Campos');
    lines.push('');
    for (const [name, field] of Object.entries(spec.fields)) {
      lines.push(formatField(name, field));
    }
  }

  // ---- Regras do builder (READ-ONLY no import — mostrado pra contexto)
  if (spec.builderRules) {
    lines.push('## Regras do builder (técnico)');
    lines.push('');
    lines.push(
      `- **Conecta do bloco anterior:** ${spec.builderRules.edgeFromPrevious ?? true}`
    );
    lines.push(
      `- **Avança o cursor do fluxo:** ${spec.builderRules.updatesLastFlowId ?? true}`
    );
    if (spec.builderRules.autoChildren && spec.builderRules.autoChildren.length > 0) {
      lines.push('- **Children auto-criados:**');
      for (const child of spec.builderRules.autoChildren) {
        const desc = child.description ? ` — ${child.description}` : '';
        lines.push(
          `  - \`${child.nodeType}\` com label \`${child.labelTemplate}\`${desc}`
        );
      }
    }
    if (spec.builderRules.sideEffectOnPrevious) {
      const se = spec.builderRules.sideEffectOnPrevious;
      const desc = se.addChild.description ? ` — ${se.addChild.description}` : '';
      lines.push(
        `- **Side effect no anterior:** quando previous é \`${se.whenPreviousIsKind.join('/')}\`, adiciona \`${se.addChild.nodeType}\` com label \`${se.addChild.labelTemplate}\`${desc}`
      );
    }
    lines.push('');
  }

  // ---- Exemplos (READ-ONLY no import)
  if (spec.examples && spec.examples.length > 0) {
    lines.push('## Exemplos (few-shot pra IA)');
    lines.push('');
    spec.examples.forEach((ex, i) => {
      lines.push(`### Exemplo ${i + 1}: ${ex.description}`);
      lines.push('');
      lines.push('**Input:**');
      lines.push('');
      lines.push('```');
      lines.push(ex.input);
      lines.push('```');
      lines.push('');
      lines.push('**Output:**');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(ex.output, null, 2));
      lines.push('```');
      lines.push('');
      if (ex.note) {
        lines.push(`**Nota:** ${ex.note}`);
        lines.push('');
      }
    });
  }

  // ---- Instruções extras
  if (spec.aiInstructions && spec.aiInstructions.trim()) {
    lines.push('## Instruções extras pra IA');
    lines.push('');
    lines.push(spec.aiInstructions.trim());
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function formatField(name: string, field: ComponentField): string {
  const lines: string[] = [];
  const required = field.required ? 'obrigatório' : 'opcional';
  const visibility = field.visible === false ? ' (oculto)' : '';
  const defaultStr =
    field.default !== undefined
      ? ` (default: \`${JSON.stringify(field.default)}\`)`
      : '';
  lines.push(
    `### \`${name}\` — ${field.type} (${required})${visibility}${defaultStr}`
  );
  lines.push('');
  lines.push(`**Descrição:** ${field.description}`);
  lines.push('');
  if (field.aiHint) {
    lines.push(`**Dica pra IA:** ${field.aiHint}`);
    lines.push('');
  }
  if (field.enum && field.enum.length > 0) {
    lines.push(
      `**Valores permitidos:** ${field.enum.map((v) => `\`${v}\``).join(', ')}`
    );
    lines.push('');
  }
  return lines.join('\n');
}

// =============================================================================
// PARSER — Markdown → ParsedSpec[]
// =============================================================================

/**
 * Spec parcialmente parseado do markdown. Só contém as seções que o parser
 * re-lê com confiança. O caller deve FUNDIR com o ComponentSpec original
 * pra obter um spec completo (preservando fields/builderRules/examples etc).
 */
export interface ParsedSpec {
  id: string;
  displayName?: string;
  icon?: string;
  category?: string;
  flowControl?: string;
  nodeType?: string | string[];
  description?: string;
  detectionCues?: string[];
  usageRules?: string[];
  commonMistakes?: string[];
  aiInstructions?: string;
  /** Por NOME do campo, novos valores de description/aiHint (se presentes). */
  fieldUpdates?: Record<string, { description?: string; aiHint?: string }>;
}

export interface ParseResult {
  specs: ParsedSpec[];
  warnings: string[];
}

export function parseMarkdownSpecs(md: string): ParseResult {
  const warnings: string[] = [];
  const specs: ParsedSpec[] = [];

  // Quebra por linhas só com `---` (separador horizontal). Trim cada bloco.
  const blocks = md.split(/\n\s*---\s*\n/).map((b) => b.trim());

  for (const block of blocks) {
    if (!block) continue;

    // Header do componente: `# <displayName> (`<id>`)`
    const headerMatch = block.match(/^#\s+([^\n]+?)\s*\(`([^`]+)`\)\s*$/m);
    if (!headerMatch) {
      // Pode ser o bloco intro do arquivo — pulamos silenciosamente se não
      // tem nenhum `## ` dentro (é só prefácio).
      if (!/^##\s+/m.test(block)) continue;
      warnings.push(
        `Bloco sem header reconhecível (esperava \`# Nome (\`id\`)\`) — ignorado.`
      );
      continue;
    }

    const id = headerMatch[2].trim();
    const parsed: ParsedSpec = { id };

    // Pega seções `## Nome` e captura conteúdo até a próxima `## ` ou fim.
    const sectionRe = /^##\s+([^\n]+?)\s*\n([\s\S]*?)(?=^##\s+|\Z)/gm;
    let sm: RegExpExecArray | null;
    while ((sm = sectionRe.exec(block)) !== null) {
      const sectionName = sm[1];
      const content = sm[2].trim();
      const kind = classifySection(sectionName);
      switch (kind) {
        case 'metadata':
          parseMetadataSection(content, parsed);
          break;
        case 'descricao':
          parsed.description = content;
          break;
        case 'pistas':
          parsed.detectionCues = parseBullets(content);
          break;
        case 'regras':
          parsed.usageRules = parseBullets(content);
          break;
        case 'erros':
          parsed.commonMistakes = parseBullets(content);
          break;
        case 'instrucoes':
          parsed.aiInstructions = content;
          break;
        case 'campos':
          parsed.fieldUpdates = parseFieldsSection(content);
          break;
        // 'builder', 'exemplos', 'other' → preservados do spec original
      }
    }

    specs.push(parsed);
  }

  return { specs, warnings };
}

type SectionKind =
  | 'metadata'
  | 'descricao'
  | 'pistas'
  | 'regras'
  | 'erros'
  | 'campos'
  | 'builder'
  | 'exemplos'
  | 'instrucoes'
  | 'other';

function classifySection(name: string): SectionKind {
  const lower = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  // ORDEM IMPORTA: "regras do builder" vem ANTES de "regras de uso" pra não
  // ser confundido.
  if (lower.includes('regras do builder')) return 'builder';
  if (lower.includes('regras de uso')) return 'regras';
  if (lower.includes('metadata')) return 'metadata';
  if (lower.includes('descricao')) return 'descricao';
  if (lower.includes('pistas')) return 'pistas';
  if (lower.includes('erros comuns')) return 'erros';
  if (lower.includes('campos')) return 'campos';
  if (lower.includes('exemplos')) return 'exemplos';
  if (lower.includes('instrucoes')) return 'instrucoes';
  return 'other';
}

function parseMetadataSection(content: string, parsed: ParsedSpec): void {
  // Linhas do tipo: - **key**: value
  const lines = content.split('\n');
  for (const line of lines) {
    const m = line.match(/^-\s+\*\*([^*]+)\*\*\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    let value = m[2].trim();
    // Strip parêntese final tipo "(NÃO MUDAR)"
    value = value.replace(/\s*\([^)]*\)\s*$/, '').trim();
    // Strip backticks de wrap completo
    if (/^`.+`$/.test(value)) value = value.slice(1, -1);

    switch (key) {
      case 'id':
        // ID vem do header — ignoramos aqui pra evitar override acidental
        break;
      case 'displayname':
        parsed.displayName = value;
        break;
      case 'icon':
        parsed.icon = value;
        break;
      case 'category':
        parsed.category = value.toLowerCase();
        break;
      case 'nodetype': {
        // Pode ser único ou lista separada por vírgula (com backticks)
        const tokens = value
          .split(',')
          .map((t) => t.trim().replace(/^`|`$/g, ''))
          .filter(Boolean);
        parsed.nodeType = tokens.length === 1 ? tokens[0] : tokens;
        break;
      }
      case 'flowcontrol':
        parsed.flowControl = value.toLowerCase();
        break;
    }
  }
}

function parseBullets(content: string): string[] {
  // Linhas `- <texto>`, mas IGNORA `- **chave**:` (que é metadata-like).
  const out: string[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^-\s+(?!\*\*)(.+)$/);
    if (m) {
      out.push(m[1].trim());
    }
  }
  return out;
}

function parseFieldsSection(
  content: string
): Record<string, { description?: string; aiHint?: string }> {
  const updates: Record<string, { description?: string; aiHint?: string }> = {};

  // Cada campo: `### \`<name>\` — type (req) ...` seguido de **Descrição:** etc.
  const fieldRe = /^###\s+`([^`]+)`[^\n]*\n([\s\S]*?)(?=^###\s+`|\Z)/gm;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(content)) !== null) {
    const name = m[1].trim();
    const body = m[2];

    const update: { description?: string; aiHint?: string } = {};

    // **Descrição:** <texto até a próxima ** ou fim>
    const descMatch = body.match(
      /\*\*Descri[çc][ãa]o:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\Z)/
    );
    if (descMatch) {
      update.description = descMatch[1].trim();
    }

    const hintMatch = body.match(
      /\*\*Dica pra IA:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\Z)/
    );
    if (hintMatch) {
      update.aiHint = hintMatch[1].trim();
    }

    if (Object.keys(update).length > 0) {
      updates[name] = update;
    }
  }

  return updates;
}

// =============================================================================
// DIFF + MERGE
// =============================================================================

export interface SpecDiff {
  id: string;
  /** Campos top-level que mudaram. */
  changes: string[];
  /** Por nome de campo, quais sub-propriedades mudaram (description/aiHint). */
  fieldChanges: Record<string, string[]>;
}

/**
 * Aplica o `parsed` em cima do `existing`, retornando um ComponentSpec novo.
 * Preserva fields complexos (type, required, default, enum, sub-fields) —
 * só re-aplica description/aiHint dos campos quando o parser encontrou.
 */
export function mergeIntoSpec(
  existing: ComponentSpec,
  parsed: ParsedSpec
): ComponentSpec {
  const merged: ComponentSpec = {
    ...existing,
    displayName: parsed.displayName ?? existing.displayName,
    icon: parsed.icon ?? existing.icon,
    category:
      (parsed.category as ComponentSpec['category']) ?? existing.category,
    flowControl:
      (parsed.flowControl as ComponentSpec['flowControl']) ?? existing.flowControl,
    nodeType:
      (parsed.nodeType as ComponentSpec['nodeType']) ?? existing.nodeType,
    description: parsed.description ?? existing.description,
    detectionCues: parsed.detectionCues ?? existing.detectionCues,
    usageRules: parsed.usageRules ?? existing.usageRules,
    commonMistakes: parsed.commonMistakes ?? existing.commonMistakes,
    aiInstructions: parsed.aiInstructions ?? existing.aiInstructions,
  };

  if (parsed.fieldUpdates && existing.fields) {
    const newFields: Record<string, ComponentField> = {};
    for (const [name, field] of Object.entries(existing.fields)) {
      const upd = parsed.fieldUpdates[name];
      newFields[name] = upd
        ? {
            ...field,
            description: upd.description ?? field.description,
            aiHint: upd.aiHint !== undefined ? upd.aiHint : field.aiHint,
          }
        : field;
    }
    merged.fields = newFields;
  }

  return merged;
}

/**
 * Compara `a` (atual) vs `b` (resultado do merge) e devolve uma descrição
 * estruturada do que mudou. Vazio = `unchanged`.
 */
export function diffSpec(a: ComponentSpec, b: ComponentSpec): SpecDiff {
  const changes: string[] = [];
  if (a.displayName !== b.displayName) changes.push('displayName');
  if (a.icon !== b.icon) changes.push('icon');
  if (a.category !== b.category) changes.push('category');
  if (a.flowControl !== b.flowControl) changes.push('flowControl');
  if (JSON.stringify(a.nodeType) !== JSON.stringify(b.nodeType))
    changes.push('nodeType');
  if (a.description !== b.description) changes.push('description');
  if (JSON.stringify(a.detectionCues ?? []) !== JSON.stringify(b.detectionCues ?? []))
    changes.push('detectionCues');
  if (JSON.stringify(a.usageRules ?? []) !== JSON.stringify(b.usageRules ?? []))
    changes.push('usageRules');
  if (
    JSON.stringify(a.commonMistakes ?? []) !==
    JSON.stringify(b.commonMistakes ?? [])
  )
    changes.push('commonMistakes');
  if ((a.aiInstructions ?? '') !== (b.aiInstructions ?? ''))
    changes.push('aiInstructions');

  const fieldChanges: Record<string, string[]> = {};
  if (a.fields && b.fields) {
    for (const name of Object.keys(b.fields)) {
      const af = a.fields[name];
      const bf = b.fields[name];
      if (!af) continue;
      const fc: string[] = [];
      if (af.description !== bf.description) fc.push('description');
      if ((af.aiHint ?? '') !== (bf.aiHint ?? '')) fc.push('aiHint');
      if (fc.length > 0) fieldChanges[name] = fc;
    }
  }

  return { id: b.id, changes, fieldChanges };
}
