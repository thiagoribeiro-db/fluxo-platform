/**
 * Gera o trecho de SYSTEM PROMPT da IA a partir dos Component Specs.
 *
 * Substitui o "Vocabulário de blocos" hardcoded em `ai-system-prompt.ts`.
 * Agora cada bloco vem dos specs YAML — adicionar/editar um componente
 * automaticamente atualiza o prompt da IA na próxima chamada.
 */
import type {
  ComponentSpec,
  ComponentField,
  ComponentExample,
} from './spec-schema';
import { loadAllSpecs } from './loader';

/**
 * Gera a seção de "Vocabulário de blocos" do system prompt a partir de
 * TODOS os specs. Cada spec vira um sub-seção markdown.
 *
 * Pula specs com `category: 'auto'` (tracking, excecao) — esses são
 * auto-gerados pelo builder, a IA não emite.
 *
 * Pula spec `frame` na vocabulário inline (frame não é um "kind" — é o
 * container). O frame tem seção própria mais abaixo no prompt.
 */
export function generateComponentVocabulary(specs?: ComponentSpec[]): string {
  const all = specs ?? loadAllSpecs();
  const emittable = all.filter(
    (s) => s.category !== 'auto' && s.category !== 'structure'
  );

  const lines: string[] = [];
  lines.push('# Vocabulário de blocos (campo `kind`)');
  lines.push('');
  lines.push(
    'Cada bloco emitido pela IA tem um `kind` discriminator. Abaixo, ' +
      'a referência completa de TODOS os kinds aceitos:'
  );
  lines.push('');

  for (const spec of emittable) {
    lines.push(formatSpecForPrompt(spec));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Gera a seção de frames (regras de agrupamento) a partir do spec `frame`.
 */
export function generateFrameSection(specs?: ComponentSpec[]): string {
  const all = specs ?? loadAllSpecs();
  const frame = all.find((s) => s.id === 'frame');
  if (!frame) return '';

  const lines: string[] = [];
  lines.push('# Regras de FRAME');
  lines.push('');
  lines.push(frame.description.trim());
  lines.push('');

  if (frame.usageRules?.length) {
    lines.push('## Como decidir o que é um frame');
    lines.push('');
    for (const rule of frame.usageRules) {
      lines.push(`- ${rule}`);
    }
    lines.push('');
  }

  if (frame.commonMistakes?.length) {
    lines.push('## Erros comuns a evitar');
    lines.push('');
    for (const mistake of frame.commonMistakes) {
      lines.push(`- ${mistake}`);
    }
    lines.push('');
  }

  // Campos do frame
  if (frame.fields) {
    lines.push('## Campos obrigatórios do frame');
    lines.push('');
    for (const [name, field] of Object.entries(frame.fields)) {
      if (field.visible === false) continue;
      lines.push(`- **\`${name}\`**: ${field.description}`);
      if (field.aiHint) {
        const hint = field.aiHint.trim();
        // Se hint tem múltiplas linhas, indenta
        if (hint.includes('\n')) {
          lines.push(`  ${hint.split('\n').join('\n  ')}`);
        } else {
          lines.push(`  Dica: ${hint}`);
        }
      }
    }
    lines.push('');
  }

  if (frame.aiInstructions) {
    lines.push(frame.aiInstructions.trim());
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formata um spec individual como sub-seção markdown.
 */
function formatSpecForPrompt(spec: ComponentSpec): string {
  const lines: string[] = [];

  lines.push(`## kind: \`${spec.id}\` — ${spec.icon} ${spec.displayName}`);
  lines.push('');
  lines.push(spec.description.trim());
  lines.push('');

  if (spec.usageRules?.length) {
    lines.push('**Regras de uso:**');
    for (const rule of spec.usageRules) {
      lines.push(`- ${rule}`);
    }
    lines.push('');
  }

  if (spec.detectionCues?.length) {
    lines.push('**Como detectar no escopo:**');
    for (const cue of spec.detectionCues) {
      lines.push(`- ${cue}`);
    }
    lines.push('');
  }

  if (spec.commonMistakes?.length) {
    lines.push('**Erros comuns a EVITAR:**');
    for (const m of spec.commonMistakes) {
      lines.push(`- ❌ ${m}`);
    }
    lines.push('');
  }

  if (spec.fields && Object.keys(spec.fields).length > 0) {
    lines.push('**Campos:**');
    for (const [name, field] of Object.entries(spec.fields)) {
      if (field.visible === false) continue;
      lines.push(formatFieldForPrompt(name, field));
    }
    lines.push('');
  }

  if (spec.examples?.length) {
    lines.push('**Exemplos:**');
    lines.push('');
    for (const ex of spec.examples) {
      lines.push(formatExampleForPrompt(ex));
    }
  }

  if (spec.aiInstructions) {
    lines.push('');
    lines.push(spec.aiInstructions.trim());
  }

  return lines.join('\n');
}

function formatFieldForPrompt(name: string, field: ComponentField): string {
  const required = field.required ? ' **(obrigatório)**' : '';
  const enumStr = field.enum ? ` — valores: ${field.enum.map((v) => `\`${v}\``).join(' | ')}` : '';
  const defaultStr = field.default !== undefined ? ` (default: \`${JSON.stringify(field.default)}\`)` : '';

  let line = `- \`${name}\`${required}: ${field.description}${enumStr}${defaultStr}`;

  if (field.aiHint) {
    line += `\n  - Dica: ${field.aiHint}`;
  }

  return line;
}

function formatExampleForPrompt(ex: ComponentExample): string {
  const lines: string[] = [];
  lines.push(`*${ex.description}*`);
  lines.push('');
  lines.push('```');
  lines.push('Input:');
  lines.push(ex.input.trim());
  lines.push('');
  lines.push('Output:');
  // Pretty-print JSON com indentação 2
  const outputStr = Array.isArray(ex.output)
    ? JSON.stringify(ex.output, null, 2)
    : JSON.stringify(ex.output, null, 2);
  lines.push(outputStr);
  lines.push('```');
  if (ex.note) {
    lines.push(`> Nota: ${ex.note}`);
  }
  lines.push('');
  return lines.join('\n');
}
