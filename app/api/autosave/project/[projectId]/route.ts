/**
 * POST /api/autosave/project/:projectId
 *
 * Endpoint de autosave de emergência para projetos legado (sem pages).
 * Usado pelo `beforeunload` / `visibilitychange` via `fetch keepalive`.
 *
 * Ver comentário em /api/autosave/page/[pageId]/route.ts para justificativa.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ProjectState } from '@/lib/types';

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json() as ProjectState;
    if (!body || !Array.isArray(body.nodes)) {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    const { error } = await supabase
      .from('projects')
      .update({ state: body })
      .eq('id', params.projectId);

    if (error) {
      console.error('[autosave/project] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[autosave/project] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
