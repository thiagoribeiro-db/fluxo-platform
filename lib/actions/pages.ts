'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ProjectPage, ProjectState } from '@/lib/types';

const EMPTY_STATE: ProjectState = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

/**
 * Lista todas as páginas do projeto, ordenadas por position.
 */
export async function listPages(projectId: string): Promise<ProjectPage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('project_pages')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (error) {
    console.error('listPages error:', error);
    return [];
  }
  return (data ?? []) as ProjectPage[];
}

/**
 * Cria página nova (em branco) no projeto.
 */
export async function createPage(
  projectId: string,
  name: string
): Promise<ProjectPage> {
  const supabase = createClient();

  // Calcula a próxima position (max + 1)
  const { data: existing } = await supabase
    .from('project_pages')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1);
  const nextPos =
    existing && existing.length > 0 ? (existing[0].position as number) + 1 : 0;

  const { data, error } = await supabase
    .from('project_pages')
    .insert({
      project_id: projectId,
      name: name.trim() || 'Nova página',
      state: EMPTY_STATE,
      position: nextPos,
      is_default: false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar página: ${error?.message}`);
  }
  revalidatePath(`/editor/${projectId}`);
  return data as ProjectPage;
}

export async function renamePage(pageId: string, name: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('project_pages')
    .update({ name: name.trim() || 'Página' })
    .eq('id', pageId)
    .select('id, project_id')
    .single();
  if (error || !data) {
    throw new Error(`Falha ao renomear: ${error?.message}`);
  }
  revalidatePath(`/editor/${data.project_id}`);
}

export async function deletePage(pageId: string): Promise<void> {
  const supabase = createClient();

  // Busca a página + verifica se é a única
  const { data: page } = await supabase
    .from('project_pages')
    .select('id, project_id, is_default')
    .eq('id', pageId)
    .single();
  if (!page) throw new Error('Página não encontrada');

  const { count } = await supabase
    .from('project_pages')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', page.project_id);

  if ((count ?? 0) <= 1) {
    throw new Error('Não é possível apagar a última página do projeto');
  }

  // Se a página deletada era a ativa, vamos limpar active_page_id
  // (o /editor lida com isso re-carregando a primeira página)
  const { error } = await supabase.from('project_pages').delete().eq('id', pageId);
  if (error) throw new Error(`Falha ao deletar: ${error.message}`);

  // Se a página deletada era a ativa, escolhe outra
  const { data: proj } = await supabase
    .from('projects')
    .select('active_page_id')
    .eq('id', page.project_id)
    .single();
  if (proj && proj.active_page_id === pageId) {
    const { data: another } = await supabase
      .from('project_pages')
      .select('id')
      .eq('project_id', page.project_id)
      .order('position', { ascending: true })
      .limit(1);
    await supabase
      .from('projects')
      .update({ active_page_id: another?.[0]?.id ?? null })
      .eq('id', page.project_id);
  }

  revalidatePath(`/editor/${page.project_id}`);
}

/**
 * Marca uma página como ativa pro projeto.
 */
export async function setActivePage(
  projectId: string,
  pageId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('projects')
    .update({ active_page_id: pageId })
    .eq('id', projectId);
  if (error) throw new Error(`Falha ao trocar página: ${error.message}`);
  revalidatePath(`/editor/${projectId}`);
}

/**
 * Salva o state da página (autosave).
 */
export async function savePageState(
  pageId: string,
  state: ProjectState
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('project_pages')
    .update({ state })
    .eq('id', pageId);
  if (error) {
    throw new Error(`Falha ao salvar página: ${error.message}`);
  }
}

/**
 * Duplica uma página (mantém o state, novo nome).
 */
export async function duplicatePage(pageId: string): Promise<ProjectPage> {
  const supabase = createClient();
  const { data: orig, error: fetchErr } = await supabase
    .from('project_pages')
    .select('*')
    .eq('id', pageId)
    .single();
  if (fetchErr || !orig) {
    throw new Error(`Falha ao buscar página: ${fetchErr?.message}`);
  }
  const newPage = await createPage(orig.project_id, `${orig.name} (cópia)`);
  // Copia o state
  await supabase
    .from('project_pages')
    .update({ state: orig.state })
    .eq('id', newPage.id);
  return { ...newPage, state: orig.state as ProjectState };
}
