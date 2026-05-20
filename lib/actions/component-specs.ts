'use server';

/**
 * Server actions pra CRUD de Component Specs.
 *
 * Estratégia híbrida:
 *  - BUILTINS: vivem em YAML (`lib/component-specs/builtins/*.yaml`), versionados
 *    no git, autoritativos. Read-only no DB.
 *  - DB: armazena (a) OVERRIDES de builtins (mesmo `spec_id`, mas `data` editada
 *    pela org), e (b) CUSTOMS (specs novos com `spec_id` único da org).
 *
 * O loader merge YAML + DB no momento da leitura — ver `loadAllSpecsForOrg`.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { loadBuiltinSpecs } from '@/lib/component-specs/loader';
import type { ComponentSpec } from '@/lib/component-specs/spec-schema';
import {
  specsToMarkdown,
  parseMarkdownSpecs,
  mergeIntoSpec,
  diffSpec,
  type ParsedSpec,
  type SpecDiff,
} from '@/lib/component-specs/markdown';

/**
 * Linha do DB serializada com o spec dentro de `data`.
 */
export interface ComponentSpecRow {
  id: string;
  organization_id: string;
  spec_id: string;
  is_override: boolean;
  data: ComponentSpec;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Spec listado na UI — sempre tem `data` (o ComponentSpec) e um wrapper
 * com metadata pra a UI saber se é builtin, override ou custom.
 */
export interface ListedSpec {
  data: ComponentSpec;
  source: 'builtin' | 'override' | 'custom';
  /** Apenas pra overrides/customs: ID da linha no DB (necessário pra update/delete) */
  rowId?: string;
  /** Timestamp da última edição (DB only) */
  updatedAt?: string;
}

/**
 * Resolve a organização ativa do usuário. Reusa lógica de `projects.ts`.
 * (Por enquanto cada user tem 1 org pessoal — quando virar multi-org, vira
 * parâmetro da action.)
 */
async function getCurrentOrgId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data: membership, error } = await supabase
    .from('memberships')
    .select('organization_id')
    .limit(1)
    .maybeSingle();

  if (error || !membership?.organization_id) {
    throw new Error('Organização não encontrada');
  }
  return membership.organization_id as string;
}

/**
 * Lista TODOS os specs disponíveis (builtins + overrides DB + customs DB),
 * com merge correto: builtins servem de base; se houver override no DB com
 * mesmo `spec_id`, o override SOBRESCREVE.
 *
 * Returns: ListedSpec[] já pronto pra renderizar na UI.
 */
export async function listComponentSpecs(): Promise<ListedSpec[]> {
  const orgId = await getCurrentOrgId();
  const supabase = createClient();

  // 1. Builtins do YAML
  const builtins = loadBuiltinSpecs();
  const builtinIds = new Set(builtins.map((s) => s.id));

  // 2. Specs do DB pra essa org
  const { data: dbRows, error } = await supabase
    .from('component_specs')
    .select('*')
    .eq('organization_id', orgId);

  if (error) {
    console.error('[listComponentSpecs] DB error:', error);
    // Se DB falhar, retorna só builtins (graceful degradation)
    return builtins.map((s) => ({ data: s, source: 'builtin' as const }));
  }

  const rows = (dbRows ?? []) as ComponentSpecRow[];
  const overridesBySpecId = new Map<string, ComponentSpecRow>();
  const customs: ComponentSpecRow[] = [];

  for (const row of rows) {
    if (row.is_override && builtinIds.has(row.spec_id)) {
      overridesBySpecId.set(row.spec_id, row);
    } else {
      customs.push(row);
    }
  }

  // 3. Merge: builtins (com override aplicado se houver) + customs
  const result: ListedSpec[] = [];

  for (const builtin of builtins) {
    const override = overridesBySpecId.get(builtin.id);
    if (override) {
      result.push({
        data: override.data,
        source: 'override',
        rowId: override.id,
        updatedAt: override.updated_at,
      });
    } else {
      result.push({ data: builtin, source: 'builtin' });
    }
  }

  for (const custom of customs) {
    result.push({
      data: custom.data,
      source: 'custom',
      rowId: custom.id,
      updatedAt: custom.updated_at,
    });
  }

  return result;
}

/**
 * Cria um spec CUSTOM novo (kind inédito). Falha se spec_id já existe.
 */
export async function createComponentSpec(
  spec: ComponentSpec
): Promise<{ id: string }> {
  const orgId = await getCurrentOrgId();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  // Verifica se o spec_id já existe (builtin ou outro custom)
  const builtins = loadBuiltinSpecs();
  if (builtins.some((b) => b.id === spec.id)) {
    throw new Error(
      `O ID "${spec.id}" é um builtin. Edite o builtin (cria override) em vez de criar um novo.`
    );
  }

  const { data, error } = await supabase
    .from('component_specs')
    .insert({
      organization_id: orgId,
      spec_id: spec.id,
      is_override: false,
      data: spec,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      // unique constraint
      throw new Error(`Já existe um componente com ID "${spec.id}" nessa org.`);
    }
    throw new Error(`Falha ao criar componente: ${error?.message}`);
  }

  revalidatePath('/dashboard');
  return { id: data.id };
}

/**
 * Atualiza um spec existente (custom OU override de builtin).
 *
 * Comportamento:
 *  - Se o spec_id é de um BUILTIN e ainda não há override → cria override.
 *  - Se já existe override/custom → atualiza o `data`.
 */
export async function updateComponentSpec(
  specId: string,
  patch: ComponentSpec
): Promise<void> {
  const orgId = await getCurrentOrgId();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const builtins = loadBuiltinSpecs();
  const isBuiltin = builtins.some((b) => b.id === specId);

  // Tenta encontrar uma linha existente
  const { data: existing } = await supabase
    .from('component_specs')
    .select('id, is_override')
    .eq('organization_id', orgId)
    .eq('spec_id', specId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('component_specs')
      .update({ data: patch })
      .eq('id', existing.id);
    if (error) throw new Error(`Falha ao atualizar: ${error.message}`);
  } else {
    // Não existe linha → cria override (se builtin) ou custom (se não)
    const { error } = await supabase.from('component_specs').insert({
      organization_id: orgId,
      spec_id: specId,
      is_override: isBuiltin,
      data: patch,
      created_by: user.id,
    });
    if (error) throw new Error(`Falha ao criar override: ${error.message}`);
  }

  revalidatePath('/dashboard');
}

/**
 * Deleta uma linha de spec (custom OU override).
 *
 *  - CUSTOM: spec some inteiramente.
 *  - OVERRIDE: spec volta a ser o builtin original (revert).
 *
 * NÃO permite deletar builtin (não tem linha no DB, então essa função
 * simplesmente não vai achar nada).
 */
export async function deleteComponentSpec(specId: string): Promise<void> {
  const orgId = await getCurrentOrgId();
  const supabase = createClient();

  const { error } = await supabase
    .from('component_specs')
    .delete()
    .eq('organization_id', orgId)
    .eq('spec_id', specId);

  if (error) throw new Error(`Falha ao deletar: ${error.message}`);

  revalidatePath('/dashboard');
}

/**
 * Clona um spec (geralmente builtin) como CUSTOM com novo ID.
 *
 * Use case: usuário quer um componente similar a um builtin mas com regras
 * diferentes — em vez de override (que altera o builtin), clona pra ter
 * uma nova entrada independente.
 */
export async function cloneComponentSpec(
  sourceSpecId: string,
  newSpecId: string,
  newDisplayName: string
): Promise<{ id: string }> {
  const orgId = await getCurrentOrgId();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  // Busca o source (builtin OU custom no DB)
  const allSpecs = await listComponentSpecs();
  const source = allSpecs.find((s) => s.data.id === sourceSpecId);
  if (!source) {
    throw new Error(`Spec source "${sourceSpecId}" não encontrado`);
  }

  // Valida o novo ID
  if (allSpecs.some((s) => s.data.id === newSpecId)) {
    throw new Error(`Já existe um componente com ID "${newSpecId}".`);
  }

  const cloned: ComponentSpec = {
    ...source.data,
    id: newSpecId,
    displayName: newDisplayName,
  };

  const { data, error } = await supabase
    .from('component_specs')
    .insert({
      organization_id: orgId,
      spec_id: newSpecId,
      is_override: false,
      data: cloned,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Falha ao clonar: ${error?.message}`);
  }

  revalidatePath('/dashboard');
  return { id: data.id };
}

// =============================================================================
// EXPORT / IMPORT (markdown)
// =============================================================================

/**
 * Exporta TODOS os specs (builtins + overrides + customs) em um único
 * markdown human-readable. Usado pelo botão "Exportar" da dashboard.
 */
export async function exportSpecsMarkdown(): Promise<string> {
  const listed = await listComponentSpecs();
  const specs = listed.map((l) => l.data);
  return specsToMarkdown(specs);
}

// Tipo retornado pelo diff: pra UI mostrar antes de aplicar.
export interface ImportDiff {
  /** Specs novos (id inexistente) — serão criados como CUSTOM. */
  toCreate: ParsedSpec[];
  /** Specs que existem e mudaram (incluindo qual override/custom criar). */
  toUpdate: Array<{
    id: string;
    merged: ComponentSpec;
    diff: SpecDiff;
    /** O que vai acontecer no apply: 'create-override' | 'update-row'. */
    intent: 'create-override' | 'update-row';
  }>;
  /** Specs presentes mas sem alterações detectadas. */
  unchanged: string[];
  /** Specs que existem no DB/builtins mas NÃO estão no arquivo. NÃO são deletados — só listados pra revisão. */
  missing: string[];
  /** Avisos do parser (header não reconhecido, etc). */
  warnings: string[];
}

/**
 * Parseia o markdown enviado pelo usuário e retorna o DIFF contra o estado
 * atual. NÃO escreve nada no DB — só calcula.
 *
 * O caller (UI) mostra o diff, o usuário confirma, e aí chama `applySpecsImport`.
 */
export async function importSpecsMarkdownDiff(md: string): Promise<ImportDiff> {
  const { specs: parsed, warnings } = parseMarkdownSpecs(md);

  const listed = await listComponentSpecs();
  const existingMap = new Map(listed.map((l) => [l.data.id, l]));
  const builtinIds = new Set(loadBuiltinSpecs().map((b) => b.id));

  const importedIds = new Set(parsed.map((p) => p.id));

  const toCreate: ParsedSpec[] = [];
  const toUpdate: ImportDiff['toUpdate'] = [];
  const unchanged: string[] = [];

  for (const p of parsed) {
    const exist = existingMap.get(p.id);
    if (!exist) {
      toCreate.push(p);
      continue;
    }
    const merged = mergeIntoSpec(exist.data, p);
    const d = diffSpec(exist.data, merged);
    if (d.changes.length === 0 && Object.keys(d.fieldChanges).length === 0) {
      unchanged.push(p.id);
    } else {
      const intent: 'create-override' | 'update-row' =
        exist.source === 'builtin' && builtinIds.has(p.id)
          ? 'create-override'
          : 'update-row';
      toUpdate.push({ id: p.id, merged, diff: d, intent });
    }
  }

  const missing: string[] = [];
  for (const l of listed) {
    if (!importedIds.has(l.data.id)) {
      missing.push(l.data.id);
    }
  }

  return { toCreate, toUpdate, unchanged, missing, warnings };
}

/**
 * Aplica o resultado do diff. Recebe arrays exatos do que criar/atualizar
 * (o caller pode filtrar antes se quiser).
 *
 * NÃO deleta nada — `missing` é só informacional.
 */
export async function applySpecsImport(
  toCreate: ParsedSpec[],
  toUpdate: Array<{ id: string; merged: ComponentSpec }>
): Promise<{ created: number; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  // CREATE — specs novos viram CUSTOM com nodeType padrão se não foi inferido.
  for (const p of toCreate) {
    const newSpec: ComponentSpec = {
      id: p.id,
      displayName: p.displayName ?? p.id,
      icon: p.icon ?? '🧩',
      category: (p.category as ComponentSpec['category']) ?? 'auto',
      // nodeType é REQUIRED — se o parser não pegou, usa fallback que o
      // usuário pode corrigir depois via UI.
      nodeType: ((p.nodeType as ComponentSpec['nodeType']) ?? 'bubble-bot'),
      flowControl: (p.flowControl as ComponentSpec['flowControl']) ?? 'linear',
      description: p.description ?? '',
      detectionCues: p.detectionCues,
      usageRules: p.usageRules,
      commonMistakes: p.commonMistakes,
      aiInstructions: p.aiInstructions,
    };
    try {
      await createComponentSpec(newSpec);
      created++;
    } catch (e) {
      errors.push(
        `Criar "${p.id}": ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // UPDATE — usa o updateComponentSpec existente, que já lida com
  // override de builtin OU update de custom transparentemente.
  for (const u of toUpdate) {
    try {
      await updateComponentSpec(u.id, u.merged);
      updated++;
    } catch (e) {
      errors.push(
        `Atualizar "${u.id}": ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/components');
  return { created, updated, errors };
}
