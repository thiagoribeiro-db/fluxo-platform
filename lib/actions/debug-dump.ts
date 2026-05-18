'use server';

/**
 * Server action utilitária (dev): exporta o estado atual de um projeto
 * (projects + active_page) pra `tmp/state-snapshot.json` no disco do servidor.
 *
 * Pra que serve: permitir que o desenvolvedor (Claude) leia a snapshot via
 * file system e analise o output do usuário pra ajustar o builder/defaults
 * sem ter que pedir pro usuário copiar/colar JSON imenso no chat.
 *
 * Roda com a auth do usuário (cookies do Supabase), então RLS aplica
 * normalmente — só dá pra dumpar projetos que o user tem acesso.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createClient } from '@/lib/supabase/server';

interface DumpResult {
  success: true;
  path: string;
  projectName: string;
  framesCount: number;
  totalNodes: number;
}

export async function dumpProjectStateToFile(
  projectId: string
): Promise<DumpResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  // Pega projeto
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();
  if (projErr || !project) {
    throw new Error(`Projeto não encontrado: ${projErr?.message ?? 'sem dados'}`);
  }

  // Pega todas as pages do projeto
  const { data: pages, error: pagesErr } = await supabase
    .from('project_pages')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true });
  if (pagesErr) {
    throw new Error(`Falha ao buscar páginas: ${pagesErr.message}`);
  }

  const activePage = pages?.find((p) => p.id === project.active_page_id);

  // Conta nodes/frames pra reportar
  type StatePage = { nodes?: unknown[] };
  const pageState = (activePage?.state ?? project.state) as StatePage | undefined;
  const totalNodes = pageState?.nodes?.length ?? 0;
  const framesCount =
    pageState?.nodes?.filter(
      (n) => (n as { type?: string }).type === 'frame'
    ).length ?? 0;

  // Snapshot completo
  const snapshot = {
    timestamp: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      active_page_id: project.active_page_id,
      organization_id: project.organization_id,
      created_at: project.created_at,
      updated_at: project.updated_at,
    },
    pages: pages ?? [],
    activePage: activePage ?? null,
    // Repete o state ativo separado pra facilitar leitura
    state: activePage?.state ?? project.state ?? null,
  };

  // Garante dir tmp/
  const projectRoot = process.cwd();
  const tmpDir = join(projectRoot, 'tmp');
  await mkdir(tmpDir, { recursive: true });
  const filePath = join(tmpDir, 'state-snapshot.json');

  await writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');

  console.log(
    `[debug-dump] Snapshot escrito em ${filePath} (${totalNodes} nodes, ${framesCount} frames)`
  );

  return {
    success: true,
    path: filePath,
    projectName: project.name,
    framesCount,
    totalNodes,
  };
}
