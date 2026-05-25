'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Slugs estáveis pra actions auditadas. Adicione novos aqui pra manter
 * consistência de nomenclatura (sempre `<domain>.<verb>`).
 */
export type AuditAction =
  | 'project.created'
  | 'project.deleted'
  | 'project.status_changed'
  | 'template.applied'
  | 'version.created'
  | 'version.restored'
  | 'share.created'
  | 'share.revoked'
  | 'page.created'
  | 'page.deleted'
  | 'page.renamed';

export interface AuditEvent {
  id: string;
  project_id: string;
  user_id: string | null;
  action: AuditAction;
  details: Record<string, unknown> | null;
  created_at: string;
  /** Resolved via JOIN nas queries — vem como display_name do profiles. */
  user_display_name?: string | null;
}

/**
 * Registra evento de auditoria. Best-effort — não falha o caller se o
 * INSERT der erro (loga warning no servidor e segue).
 *
 * Usado por dentro de outras server actions, sempre depois da operação
 * principal ter dado certo.
 */
export async function logAuditEvent(
  projectId: string,
  action: AuditAction,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('audit_events').insert({
      project_id: projectId,
      user_id: user?.id ?? null,
      action,
      details: details ?? null,
    });
    if (error) {
      console.warn('[audit] insert failed:', action, error.message);
    }
  } catch (err) {
    console.warn('[audit] unexpected error:', action, err);
  }
}

/**
 * Lista eventos de auditoria de um projeto (mais recentes primeiro).
 * Limite default 100 — paginação simples via `offset`.
 */
export async function listAuditEvents(
  projectId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<AuditEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audit_events')
    .select('id, project_id, user_id, action, details, created_at, profiles:user_id(display_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1);

  if (error) {
    console.error('listAuditEvents error:', error);
    return [];
  }

  return (data ?? []).map((row): AuditEvent => {
    // Supabase devolve `data` como any[] quando o select tem join — em vez de
    // `as unknown as Foo`, tipamos `row` como Record<string, unknown> e
    // narrowing via runtime checks pra cada campo.
    const r = row as Record<string, unknown>;
    const profiles = r.profiles as { display_name: string | null } | null;
    return {
      id: String(r.id),
      project_id: String(r.project_id),
      user_id: (r.user_id as string | null) ?? null,
      action: r.action as AuditAction,
      details: (r.details as Record<string, unknown> | null) ?? null,
      created_at: String(r.created_at),
      user_display_name: profiles?.display_name ?? null,
    };
  });
}
