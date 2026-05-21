/**
 * API route DEV-ONLY pra restaurar uma página de um `tmp/state-snapshot.json`.
 *
 * Útil quando o usuário perdeu conteúdo por bug (ex.: template aplicado na
 * página errada). Cria uma página nova no projeto com o state do snapshot
 * — NÃO sobrescreve nada.
 *
 * Uso:
 *   POST /api/dev/restore-snapshot
 *   Body opcional: { projectId?: string, pageId?: string }
 *     - projectId: filtra qual projeto do snapshot restaurar (default: o do snapshot)
 *     - pageId: qual página do snapshot restaurar (default: a primeira page com nodes)
 *
 * Returns: { ok, pageId, name, nodesCount, edgesCount }
 *
 * 404 em produção.
 */
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabase/server';

interface SnapshotPage {
  id: string;
  project_id: string;
  name: string;
  state: { nodes?: unknown[]; edges?: unknown[]; viewport?: unknown };
  position?: number;
}

interface Snapshot {
  timestamp: string;
  project: { id: string; name: string };
  pages: SnapshotPage[];
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }

  let body: { projectId?: string; pageId?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }

  try {
    const filePath = path.join(process.cwd(), 'tmp', 'state-snapshot.json');
    const raw = await fs.readFile(filePath, 'utf8');
    const snap = JSON.parse(raw) as Snapshot;

    const targetProjectId = body.projectId ?? snap.project.id;

    // Escolhe a página do snapshot
    let snapPage: SnapshotPage | undefined;
    if (body.pageId) {
      snapPage = snap.pages.find((p) => p.id === body.pageId);
    } else {
      // Primeira page com nodes
      snapPage = snap.pages.find((p) => (p.state?.nodes?.length ?? 0) > 0);
    }
    if (!snapPage) {
      return NextResponse.json(
        { error: 'Nenhuma página com conteúdo encontrada no snapshot' },
        { status: 404 }
      );
    }

    const supabase = createClient();

    // Auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado. Faça login na UI antes.' },
        { status: 401 }
      );
    }

    // Verifica que o user tem acesso ao projeto
    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', targetProjectId)
      .single();
    if (projErr || !proj) {
      return NextResponse.json(
        { error: `Projeto ${targetProjectId} não encontrado ou sem acesso` },
        { status: 404 }
      );
    }

    // Calcula próxima position
    const { data: maxPos } = await supabase
      .from('project_pages')
      .select('position')
      .eq('project_id', targetProjectId)
      .order('position', { ascending: false })
      .limit(1);
    const nextPos =
      maxPos && maxPos.length > 0 ? (maxPos[0].position as number) + 1 : 0;

    // Timestamp legível no nome
    const snapDate = new Date(snap.timestamp);
    const ts = `${String(snapDate.getDate()).padStart(2, '0')}/${String(snapDate.getMonth() + 1).padStart(2, '0')} ${String(snapDate.getHours()).padStart(2, '0')}:${String(snapDate.getMinutes()).padStart(2, '0')}`;
    const newName = `[Restore ${ts}] ${snapPage.name}`;

    const { data: created, error: insErr } = await supabase
      .from('project_pages')
      .insert({
        project_id: targetProjectId,
        name: newName,
        state: snapPage.state,
        position: nextPos,
        is_default: false,
      })
      .select('id, name')
      .single();

    if (insErr || !created) {
      return NextResponse.json(
        { error: `Falha ao inserir: ${insErr?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      pageId: created.id,
      name: created.name,
      projectId: targetProjectId,
      projectName: proj.name,
      nodesCount: snapPage.state?.nodes?.length ?? 0,
      edgesCount: snapPage.state?.edges?.length ?? 0,
      snapshotTimestamp: snap.timestamp,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Falha no restore',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
