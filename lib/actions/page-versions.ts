'use server';

/**
 * Server actions de versionamento de páginas (snapshots).
 *
 * Cada chamada de `createVersion` armazena o estado atual da página
 * (nodes/edges/viewport) em `page_versions`. O auto-cleanup do banco
 * mantém só os últimos 50 por página.
 *
 * `restoreVersion` substitui o `state` da página pelo da versão E
 * cria um snapshot da versão PRÉVIA antes (defensive — pra dar undo
 * do próprio restore).
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ProjectState } from '@/lib/types';

export interface PageVersion {
  id: string;
  page_id: string;
  state: ProjectState;
  label: string | null;
  created_by: string | null;
  created_at: string;
  /** Resolve via join se incluído na query — author display name. */
  author_name?: string | null;
  author_email?: string | null;
}

/**
 * Lista as versões de uma página, mais recentes primeiro.
 * Limite default: 50 (mesmo do auto-cleanup do banco).
 *
 * IMPORTANTE: a query é SPLIT em 2 etapas (versões + profiles) em vez de
 * usar JOIN embed do PostgREST. Motivo: a RLS de `profiles` é
 * `id = auth.uid()` (só vê o próprio), então quando o JOIN tenta puxar o
 * author de uma versão criada por OUTRO user no mesmo org (ou se a row
 * em profiles ainda não foi criada pelo trigger), o embed retornava
 * vazio E silenciosamente colapsava a versão inteira em alguns casos.
 * Fazendo em 2 queries, mesmo que o lookup do profile falhe, a versão
 * continua aparecendo (só sem o nome do autor — fallback pra email).
 */
export async function listVersions(
  pageId: string,
  limit = 50
): Promise<PageVersion[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('page_versions')
    .select('id, page_id, state, label, created_by, created_at')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('listVersions error:', error);
    return [];
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Tenta enriquecer com profile do autor (best-effort — se falhar, retorna
  // sem author_name/email; RLS da profiles só vê o próprio user)
  const authorIds = Array.from(
    new Set(rows.map((r) => r.created_by).filter((id): id is string => !!id))
  );
  const authorById = new Map<string, { display_name?: string; email?: string }>();
  if (authorIds.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', authorIds);
    if (pErr) {
      console.warn('listVersions: profile lookup failed', pErr);
    } else {
      for (const p of profiles ?? []) {
        authorById.set(p.id, { display_name: p.display_name, email: p.email });
      }
    }
  }

  return rows.map((v) => {
    const a = v.created_by ? authorById.get(v.created_by) : undefined;
    return {
      id: v.id,
      page_id: v.page_id,
      state: v.state as ProjectState,
      label: v.label,
      created_by: v.created_by,
      created_at: v.created_at,
      author_name: a?.display_name ?? null,
      author_email: a?.email ?? null,
    };
  });
}

/**
 * Cria uma versão (snapshot) da página com o `state` atual da própria
 * page (lê do banco) ou com o `state` explícito passado pelo client.
 * Use o segundo quando há mudanças locais não-salvas que você quer
 * guardar antes de aplicar um destrutivo.
 */
export async function createVersion(
  pageId: string,
  label?: string,
  explicitState?: ProjectState
): Promise<{ id: string; created_at: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  let state: ProjectState | undefined = explicitState;
  if (!state) {
    const { data: page, error: pageErr } = await supabase
      .from('project_pages')
      .select('state')
      .eq('id', pageId)
      .single();
    if (pageErr || !page) {
      throw new Error(`Página não encontrada: ${pageErr?.message}`);
    }
    state = page.state as ProjectState;
  }

  // Não cria snapshot vazio — perda de tempo + storage
  if (!state.nodes || state.nodes.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from('page_versions')
    .insert({
      page_id: pageId,
      state,
      label: label ?? null,
      created_by: user.id,
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar versão: ${error?.message}`);
  }
  return { id: data.id, created_at: data.created_at };
}

/**
 * Restaura uma versão — substitui o `state` da página correspondente.
 * ANTES de restaurar, cria UM snapshot do state atual com label
 * "Antes do restore" — assim o usuário pode desfazer o restore.
 */
export async function restoreVersion(versionId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  // Busca a versão (state + page_id)
  const { data: version, error: vErr } = await supabase
    .from('page_versions')
    .select('id, page_id, state, label')
    .eq('id', versionId)
    .single();
  if (vErr || !version) {
    throw new Error(`Versão não encontrada: ${vErr?.message}`);
  }

  // Snapshot defensive do state atual ANTES de sobrescrever.
  // Se falhar, bloqueia o restore — melhor falhar ruidosamente do que
  // permitir um restore destrutivo sem backup.
  await createVersion(
    version.page_id,
    `Antes do restore de "${version.label ?? new Date(version.id).toLocaleString()}"`
  );

  // Aplica o state da versão na página
  const { error: updErr, data: pageRow } = await supabase
    .from('project_pages')
    .update({ state: version.state })
    .eq('id', version.page_id)
    .select('project_id')
    .single();
  if (updErr || !pageRow) {
    throw new Error(`Falha ao restaurar: ${updErr?.message}`);
  }

  revalidatePath(`/editor/${pageRow.project_id}`);
}

/**
 * Apaga uma versão específica. Não toca em outras versões nem na page.
 */
export async function deleteVersion(versionId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { error } = await supabase
    .from('page_versions')
    .delete()
    .eq('id', versionId);
  if (error) {
    throw new Error(`Falha ao deletar: ${error.message}`);
  }
}
