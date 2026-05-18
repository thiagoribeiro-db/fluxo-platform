#!/usr/bin/env node
/**
 * Script utilitário pra IMPRIMIR o system prompt gerado, pra debug.
 *
 * Uso: node scripts/preview-prompt.mjs [--full] [--save]
 *
 * --full: imprime o prompt completo (default só estatísticas)
 * --save: salva em scripts/.last-prompt.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BUILTINS_DIR = path.join(ROOT, 'lib', 'component-specs', 'builtins');

const args = process.argv.slice(2);
const showFull = args.includes('--full');
const shouldSave = args.includes('--save');

// --- Lê specs
const files = fs.readdirSync(BUILTINS_DIR).filter((f) => f.endsWith('.yaml'));
const specs = files.map((f) => {
  const content = fs.readFileSync(path.join(BUILTINS_DIR, f), 'utf-8');
  return parseYaml(content);
});

console.log(`\n📦 Specs carregados: ${specs.length}`);
for (const s of specs) {
  const examples = s.examples?.length ?? 0;
  const rules = s.usageRules?.length ?? 0;
  console.log(`   - ${s.id.padEnd(20)} ${s.category.padEnd(12)} (${rules} regras, ${examples} exemplos)`);
}

// --- Estima tokens (regra de bolso: 1 token ≈ 4 chars em pt-BR)
let totalChars = 0;
for (const s of specs) {
  totalChars += JSON.stringify(s).length;
}
console.log(`\n📊 Total de chars nos specs: ${totalChars.toLocaleString('pt-BR')}`);
console.log(`📊 Tokens estimados (specs): ~${Math.round(totalChars / 4).toLocaleString('pt-BR')}`);

if (showFull || shouldSave) {
  // Replica o que prompt-generator.ts faz
  const vocab = [
    '# Vocabulário de blocos (campo `kind`)',
    '',
    'Cada bloco emitido pela IA tem um `kind` discriminator.',
    '',
  ];

  const emittable = specs.filter(
    (s) => s.category !== 'auto' && s.category !== 'structure'
  );
  for (const s of emittable) {
    vocab.push(`## kind: \`${s.id}\` — ${s.icon} ${s.displayName}`);
    vocab.push('');
    vocab.push(s.description.trim());
    vocab.push('');
    if (s.usageRules?.length) {
      vocab.push('**Regras:**');
      s.usageRules.forEach((r) => vocab.push(`- ${r}`));
      vocab.push('');
    }
    if (s.examples?.length) {
      vocab.push(`**Exemplos** (${s.examples.length}):`);
      s.examples.forEach((ex) => vocab.push(`- ${ex.description}`));
      vocab.push('');
    }
  }

  const prompt = vocab.join('\n');
  console.log(`\n📝 Prompt vocabulário gerado: ${prompt.length} chars (~${Math.round(prompt.length / 4)} tokens)`);

  if (showFull) {
    console.log('\n=== PROMPT (vocabulário) ===\n');
    console.log(prompt);
  }
  if (shouldSave) {
    const out = path.join(__dirname, '.last-prompt.md');
    fs.writeFileSync(out, prompt, 'utf-8');
    console.log(`\n💾 Salvo em: ${out}`);
  }
}

console.log('\n✓ OK\n');
