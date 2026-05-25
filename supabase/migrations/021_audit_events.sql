-- =============================================================================
-- FLUXO PLATFORM — Migration 021: Audit log de ações sensíveis
-- =============================================================================
-- Tabela `audit_events` registra quem fez o quê e quando. Não é log
-- granular de toda mudança (isso já tem em page_versions) — é só pra
-- ações de governança: template aplicado, versão restaurada, share
-- criado/revogado, status mudado, projeto deletado, etc.
--
-- Acesso: membros da org dona do projeto veem o log (via RLS).
-- INSERT: feito apenas via server actions internas (RLS bloqueia client direto).
-- =============================================================================

-- ---- 1. Tabela ---------------------------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- NULL pra ações de sistema (ex: cron job, IA automatizada)
  user_id uuid references public.profiles(id) on delete set null,
  -- Slug curto, ex: 'template.applied', 'version.restored', 'share.created'
  action text not null,
  -- Payload JSON livre — ex: { templateName: 'varejo-exemplo', pageId: '...' }
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_project on public.audit_events(project_id, created_at desc);
create index if not exists idx_audit_action on public.audit_events(action);

comment on table public.audit_events is
  'Audit log de ações de governança (template aplicado, versão restaurada, share criado/revogado, etc.). Granular de mudança de conteúdo fica em page_versions.';

-- ---- 2. RLS ------------------------------------------------------------------
alter table public.audit_events enable row level security;

-- SELECT: qualquer membro da org dona do projeto
drop policy if exists "Org members can read audit events" on public.audit_events;
create policy "Org members can read audit events"
  on public.audit_events for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = audit_events.project_id
        and public.is_org_member(p.organization_id)
    )
  );

-- INSERT: members podem registrar (editor/admin), com user_id = auth.uid()
drop policy if exists "Org editors can insert audit events" on public.audit_events;
create policy "Org editors can insert audit events"
  on public.audit_events for insert
  with check (
    (user_id is null or user_id = auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = audit_events.project_id
        and public.user_role_in_org(p.organization_id) in ('admin', 'editor')
    )
  );

notify pgrst, 'reload schema';
