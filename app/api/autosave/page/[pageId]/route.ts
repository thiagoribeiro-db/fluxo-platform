/**
 * POST /api/autosave/page/:pageId
 *
 * Endpoint de autosave de emergência — chamado via `fetch keepalive` no
 * `beforeunload` e `visibilitychange` para garantir que mudanças pendentes
 * (que ainda estão no debounce) sejam salvas antes do processo ser destruído.
 *
 * Por que uma API route e não uma Server Action?
 *   - Server Actions precisam de um client React runtime ativo para serem
 *     chamadas — o `beforeunload` acontece APÓS o documento ser destruído,
 *     então o runtime pode não estar mais disponível.
 *   - `fetch` com `keepalive: true` funciona mesmo após o documento ser
 *     destruído (RFC 7230 — o browser completa o request em background).
 *   - Não precisa de um bundle separado; coexiste com as Server Actions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ProjectState } from '@/lib/types';

export async function POST(
  req: NextRequest,
  { params }: { params: { pageId: string } }
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
      .from('project_pages')
      .update({ state: body })
      .eq('id', params.pageId);

    if (error) {
      console.error('[autosave/page] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[autosave/page] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
