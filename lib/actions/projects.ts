'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Project, ProjectState, ProjectStatus, ProjectVisibility } from '@/lib/types';
import { logAuditEvent } from './audit';

const EMPTY_STATE: ProjectState = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

/**
 * Pega ou cria a organização default do usuário (1 user = 1 org pessoal por enquanto).
 *
 * A criação de org+membership é feita pela função SQL atômica
 * `create_organization_with_admin` (security definer) — necessário porque RLS
 * impede inserts diretos por usuários sem membership ainda.
 */
async function ensureOrgForUser(userEmail: string) {
  const supabase = createClient();

  // 1) Já tem membership? RLS deixa o usuário ler as próprias.
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('organization_id')
    .limit(1)
    .maybeSingle();

  if (existingMembership?.organization_id) {
    return existingMembership.organization_id as string;
  }

  // 2) Primeira vez: cria org + membership-admin via RPC atômica.
  const orgName = `Workspace de ${userEmail.split('@')[0]}`;
  const slug = `${userEmail.split('@')[0]}-${Date.now().toString(36)}`;

  const { data: orgId, error } = await supabase.rpc(
    'create_organization_with_admin',
    { org_name: orgName, org_slug: slug }
  );

  if (error || !orgId) {
    throw new Error(`Falha ao criar organização: ${error?.message}`);
  }

  return orgId as string;
}

/**
 * Lista projetos do usuário autenticado.
 */
export async function listProjects(): Promise<Project[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('listProjects error:', error);
    return [];
  }
  return (data ?? []) as Project[];
}

/**
 * Busca um projeto pelo id.
 */
export async function getProject(id: string): Promise<Project | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('getProject error:', error);
    return null;
  }
  return (data as Project) ?? null;
}

/**
 * Busca o projeto + lista de páginas + página ativa.
 */
export async function getProjectWithPages(id: string): Promise<{
  project: Project;
  pages: import('@/lib/types').ProjectPage[];
  activePageId: string | null;
} | null> {
  const project = await getProject(id);
  if (!project) return null;
  const { listPages } = await import('@/lib/actions/pages');
  const pages = await listPages(id);
  const activeId =
    project.active_page_id ?? pages.find((p) => p.is_default)?.id ?? pages[0]?.id ?? null;
  return { project, pages, activePageId: activeId };
}

/**
 * Cria um projeto e redireciona pro editor.
 */
export async function createProject(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;

  if (!name) {
    throw new Error('Nome é obrigatório');
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const orgId = await ensureOrgForUser(user.email ?? 'user');

  const { data, error } = await supabase
    .from('projects')
    .insert({
      organization_id: orgId,
      name,
      description,
      created_by: user.id,
      visibility: 'private' as ProjectVisibility,
      state: EMPTY_STATE,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar projeto: ${error?.message}`);
  }

  revalidatePath('/dashboard');
  redirect(`/editor/${data.id}`);
}

export type TemplateName = 'varejo-exemplo' | 'saude-clinica';

/**
 * Aplica um escopo em TEXTO (Markdown ou TXT) ao projeto, parseando via REGEX
 * heurístico (legado) e sobrescrevendo o `state`.
 *
 * Heurísticas no parser:
 *  - Seções → frames (com prefixo derivado das iniciais)
 *  - Bot:/Cliente: → bubble-bot / bubble-user
 *  - Listas com 1 → btn-long; 2-3 → btn-short; 4+ → menu
 *  - [colchete] referenciando mídia → mídia bot
 *
 * NOTA: este parser NÃO usa IA. Para uso com IA (recomendado para PDFs e
 * textos sem markdown claro), use `applyEscopoWithAI` abaixo.
 */
export async function applyEscopoToProject(
  projectId: string,
  escopoText: string,
  /** Página alvo. Se omitido, usa `projects.active_page_id`. */
  pageId?: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  if (!escopoText || !escopoText.trim()) {
    throw new Error('Texto do escopo vazio');
  }

  const { parseEscopoText } = await import('@/lib/parser/escopo');
  const state = parseEscopoText(escopoText);

  if (state.nodes.length === 0) {
    throw new Error(
      'Não foi possível extrair nenhum frame do escopo. Verifique se tem seções (# Título ou "Cenário N: ..."), Bot:/Cliente: ou listas com opções.'
    );
  }

  await saveStateOnActivePageOrLegacy(
    supabase,
    projectId,
    state,
    pageId,
    'Antes de aplicar escopo (regex)'
  );

  revalidatePath(`/editor/${projectId}`);
}

/**
 * Aplica um escopo em TEXTO ao projeto usando **IA (Anthropic Claude)** para
 * interpretação semântica.
 *
 * Diferente do parser heurístico (`applyEscopoToProject`), esta versão:
 *  - Distingue ORIENTAÇÃO (notas, contextos) de ESTRUTURA (bubbles, menus)
 *  - Funciona com PDFs corridos, sem markdown ou marcadores explícitos
 *  - Identifica frames/cenários automaticamente
 *  - Gera direcionamentos pra opções de menu
 *  - Demora 30s-2min (use overlay de loading na UI)
 *
 * Retorna metadata útil pra UI (frames count, tempo, tokens consumidos, etc.)
 *
 * Requer `ANTHROPIC_API_KEY` no `.env.local`.
 */
export async function applyEscopoWithAI(
  projectId: string,
  escopoText: string,
  fileName?: string,
  /** Página alvo. Se omitido, usa `projects.active_page_id`. */
  pageId?: string
): Promise<{
  framesCount: number;
  blocksCount: number;
  notes: string[];
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  if (!escopoText || !escopoText.trim()) {
    throw new Error('Texto do escopo vazio');
  }

  // Dynamic import pra não carregar o SDK Anthropic no bundle do client
  const { parseEscopoWithAI } = await import('@/lib/actions/parse-with-ai');
  const { state, meta } = await parseEscopoWithAI({
    text: escopoText,
    fileName,
    projectId,
  });

  if (state.nodes.length === 0) {
    throw new Error(
      'A IA interpretou o documento mas não gerou nenhum node. Verifique o conteúdo.'
    );
  }

  await saveStateOnActivePageOrLegacy(
    supabase,
    projectId,
    state,
    pageId,
    `Antes de aplicar IA${fileName ? ` (${fileName})` : ''}`
  );

  revalidatePath(`/editor/${projectId}`);

  return {
    framesCount: meta.framesCount,
    blocksCount: meta.blocksCount,
    notes: meta.notes,
    durationMs: meta.durationMs,
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    cacheReadTokens: meta.cacheReadTokens,
  };
}

/**
 * Aplica um template pré-construído ao projeto, sobrescrevendo o `state`.
 *
 * Templates disponíveis (chave estável):
 *  - `varejo-exemplo`: chatbot genérico de varejo (Saudação + 9 cenários + Algo Mais + Encerramento)
 *
 * Mais tarde, isto vira parser de PDF/DOCX e pode receber `templateSource`
 * em vez de nome fixo.
 */
export async function applyTemplate(
  projectId: string,
  templateName: TemplateName,
  /** Página alvo. Se omitido, usa `projects.active_page_id`. */
  pageId?: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  // Dynamic import pra não carregar o template no client por engano
  let state: ProjectState;
  if (templateName === 'varejo-exemplo') {
    const { buildVarejoExemploTemplate } = await import(
      '@/lib/templates/varejo-exemplo'
    );
    state = buildVarejoExemploTemplate();
  } else if (templateName === 'saude-clinica') {
    const { buildSaudeClinicaTemplate } = await import(
      '@/lib/templates/saude-clinica'
    );
    state = buildSaudeClinicaTemplate();
  } else {
    throw new Error(`Template desconhecido: ${templateName}`);
  }

  // Salva na PÁGINA ATIVA (não em projects.state — legado)
  await saveStateOnActivePageOrLegacy(
    supabase,
    projectId,
    state,
    pageId,
    `Antes de aplicar template "${templateName}"`
  );

  await logAuditEvent(projectId, 'template.applied', {
    templateName,
    pageId: pageId ?? null,
  });

  revalidatePath(`/editor/${projectId}`);
}

/**
 * Helper: salva o state na página alvo do projeto.
 *
 * Resolução do alvo (em ordem):
 *   1. `explicitPageId` (caller diz exatamente onde aplicar)
 *   2. `projects.active_page_id` (default — página ativa segundo o banco)
 *   3. `projects.state` (legado — fallback final se nem 1 nem 2 existem)
 *
 * AUTO-SNAPSHOT: se a página alvo tem nodes > 0, cria uma VERSÃO em
 * `page_versions` com o state antigo ANTES de sobrescrever. Recuperação
 * via painel "Versões" no editor.
 */
async function saveStateOnActivePageOrLegacy(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  state: ProjectState,
  explicitPageId?: string,
  snapshotLabel?: string
): Promise<void> {
  // Determina a página alvo
  let targetPageId: string | null = explicitPageId ?? null;

  if (!targetPageId) {
    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .select('active_page_id')
      .eq('id', projectId)
      .single();
    if (projErr || !proj) {
      throw new Error(`Projeto não encontrado: ${projErr?.message}`);
    }
    targetPageId = (proj.active_page_id as string | null) ?? null;
  }

  if (targetPageId) {
    // Lê o state ATUAL pra decidir se vale fazer snapshot
    const { data: currentPage } = await supabase
      .from('project_pages')
      .select('state')
      .eq('id', targetPageId)
      .single();

    const currentState = currentPage?.state as ProjectState | undefined;
    const hasContent = Boolean(
      currentState?.nodes && currentState.nodes.length > 0
    );

    if (hasContent) {
      // Snapshot defensive na tabela page_versions (não bloqueia o write
      // principal — se snapshot falhar, ainda assim aplicamos o template).
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await supabase.from('page_versions').insert({
          page_id: targetPageId,
          state: currentState,
          label: snapshotLabel ?? 'Snapshot automático',
          created_by: user?.id ?? null,
        });
      } catch (snapErr) {
        console.error('[snapshot pré-aplicação] falha (não-fatal):', snapErr);
      }
    }

    // Update real
    const { error: pageErr } = await supabase
      .from('project_pages')
      .update({ state })
      .eq('id', targetPageId);
    if (pageErr) {
      throw new Error(`Falha ao salvar na página: ${pageErr.message}`);
    }
  } else {
    // Fallback: salva em projects.state (legado, sem pages)
    const { error: legErr } = await supabase
      .from('projects')
      .update({ state })
      .eq('id', projectId);
    if (legErr) {
      throw new Error(`Falha ao salvar: ${legErr.message}`);
    }
  }
}

/**
 * Atualiza apenas o `state` (nodes/edges/viewport) — autosave.
 */
export async function saveProjectState(id: string, state: ProjectState) {
  const supabase = createClient();

  const { error } = await supabase
    .from('projects')
    .update({ state })
    .eq('id', id);

  if (error) {
    throw new Error(`Falha ao salvar: ${error.message}`);
  }
}

/**
 * Renomeia / atualiza metadados.
 */
export async function updateProject(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    visibility?: ProjectVisibility;
    status?: ProjectStatus;
    estimated_hours?: number | null;
  }
) {
  const supabase = createClient();

  const { error } = await supabase.from('projects').update(patch).eq('id', id);
  if (error) throw new Error(`Falha ao atualizar: ${error.message}`);

  // Audit log: registra mudança de status (alta sensibilidade pra governança)
  if (patch.status) {
    await logAuditEvent(id, 'project.status_changed', { status: patch.status });
  }

  revalidatePath('/dashboard');
  revalidatePath(`/editor/${id}`);
}

/**
 * Deleta projeto.
 */
export async function deleteProject(id: string) {
  const supabase = createClient();

  // Buscamos nome ANTES de deletar pra registrar no audit (project_id some no cascade)
  const { data: row } = await supabase
    .from('projects')
    .select('name')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw new Error(`Falha ao deletar: ${error.message}`);

  // Nota: o cascade já apagou os audit_events deste projeto também.
  // O log do delete em si fica perdido com o projeto — aceitamos isso por
  // simplicidade (alternativa: tabela `org_audit` separada).
  if (row?.name) {
    // Sem effect — projeto não existe mais. Mantemos só telemetria PostHog.
  }

  revalidatePath('/dashboard');
}
