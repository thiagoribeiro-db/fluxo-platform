/**
 * Loader de Component Specs.
 *
 * Lê todos os arquivos `lib/component-specs/builtins/*.yaml` na PRIMEIRA
 * importação e cacheia em memória. Os specs builtins NÃO mudam em runtime
 * (são versionados no git), então leitura síncrona via `fs` é OK.
 *
 * Specs CUSTOM (definidos pelo usuário via UI da home — Fase B) virão de
 * uma chamada async ao DB. Por enquanto, esse arquivo só lê os builtins.
 */
import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import type { ComponentSpec } from './spec-schema';
import { isValidSpec } from './spec-schema';

const BUILTINS_DIR = path.join(process.cwd(), 'lib', 'component-specs', 'builtins');

let _cachedBuiltins: ComponentSpec[] | null = null;

/**
 * Lê e cacheia todos os specs builtins.
 *
 * Em prod, isso roda 1 vez no init do módulo. Em dev, hot-reload do Next.js
 * pode re-executar — mas o cache evita leituras múltiplas dentro do mesmo
 * processo.
 *
 * Se algum YAML estiver malformado, loga warning e PULA esse spec (não
 * derruba todo o pipeline).
 */
export function loadBuiltinSpecs(): ComponentSpec[] {
  if (_cachedBuiltins) return _cachedBuiltins;

  if (!fs.existsSync(BUILTINS_DIR)) {
    console.warn(`[component-specs] Diretório builtins não existe: ${BUILTINS_DIR}`);
    _cachedBuiltins = [];
    return _cachedBuiltins;
  }

  const files = fs
    .readdirSync(BUILTINS_DIR)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  const specs: ComponentSpec[] = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(BUILTINS_DIR, file), 'utf-8');
      const parsed = parseYaml(content);
      if (isValidSpec(parsed)) {
        specs.push(parsed);
      } else {
        console.warn(`[component-specs] Spec inválido (campos required ausentes): ${file}`);
      }
    } catch (err) {
      console.error(`[component-specs] Falha ao parsear ${file}:`, err);
    }
  }

  // Ordem estável: pela `category` e depois `id` (pra prompt determinístico)
  specs.sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category);
    if (catCmp !== 0) return catCmp;
    return a.id.localeCompare(b.id);
  });

  console.log(
    `[component-specs] Carregados ${specs.length} specs builtins: ${specs.map((s) => s.id).join(', ')}`
  );

  _cachedBuiltins = specs;
  return specs;
}

/**
 * Retorna TODOS os specs (builtins + custom).
 *
 * Hoje só retorna builtins. Quando Fase B (CRUD de componentes) for entregue,
 * essa função vai async e merge com `loadCustomSpecs()` que lê do Supabase.
 */
export function loadAllSpecs(): ComponentSpec[] {
  return loadBuiltinSpecs();
  // TODO Fase B:
  // const customs = await loadCustomSpecs();
  // return [...loadBuiltinSpecs(), ...customs];
}

/**
 * Busca um spec específico por ID. Retorna undefined se não existir.
 */
export function getSpecById(id: string): ComponentSpec | undefined {
  return loadAllSpecs().find((s) => s.id === id);
}

/**
 * Filtra specs por categoria.
 */
export function getSpecsByCategory(
  category: ComponentSpec['category']
): ComponentSpec[] {
  return loadAllSpecs().filter((s) => s.category === category);
}

/**
 * Força recarregar os specs (útil em dev quando arquivos YAML mudam).
 */
export function invalidateSpecsCache(): void {
  _cachedBuiltins = null;
}
