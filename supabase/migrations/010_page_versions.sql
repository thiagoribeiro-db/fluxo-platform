-- =============================================================================
-- FLUXO PLATFORM — Migration 010: Versionamento de snapshots de páginas
-- =============================================================================
-- Cada página agora pode ter N snapshots (versões) que registram o `state`
-- (nodes/edges/viewport) num momento específico. Útil pra:
--  - Recuperar trabalho após aplicar template/IA destrutivo
--  - Auditoria: "quem mudou o quê e quando"
--  - Time travel: voltar pra um ponto anterior
--
-- Auto-snapshot dispara em:
--  - Antes de aplicar template
--  - Antes de aplicar IA
--  - (futuro) periódico via cron
--
-- Auto-cleanup: mantém só os últimos N snapshots por página pra não
-- inflar o banco. Trigger AFTER INSERT que apaga os mais antigos.
--
-- IDEMPOTENTE.
-- =============================================================================

-- ---- 1. Tabela page_versions -------------------------------------------------
create table if not exists public.page_versions (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid not null references public.project_pages(id) on delete cascade,
  state jsonb not null,
  label text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Index principal: listar versões de uma page por created_at desc
create index if not exists idx_page_versions_page_created
  on public.page_versions(page_id, created_at desc);

-- ---- 2. RLS ------------------------------------------------------------------
alter table public.page_versions enable row level security;

drop policy if exists "Members can view page versions" on public.page_versions;
create policy "Members can view page versions"
  on public.page_versions for select
  using (
    exists (
      select 1
      from public.project_pages pp
      join public.projects p on p.id = pp.project_id
      where pp.id = page_versions.page_id
        and public.is_org_member(p.organization_id)
    )
  );

drop policy if exists "Editors and admins can create versions" on public.page_versions;
create policy "Editors and admins can create versions"
  on public.page_versions for insert
  with check (
    exists (
      select 1
      from public.project_pages pp
      join public.projects p on p.id = pp.project_id
      where pp.id = page_versions.page_id
        and public.user_role_in_org(p.organization_id) in ('admin', 'editor')
    )
  );

drop policy if exists "Editors and admins can delete versions" on public.page_versions;
create policy "Editors and admins can delete versions"
  on public.page_versions for delete
  using (
    exists (
      select 1
      from public.project_pages pp
      join public.projects p on p.id = pp.project_id
      where pp.id = page_versions.page_id
        and public.user_role_in_org(p.organization_id) in ('admin', 'editor')
    )
  );

-- ---- 3. Auto-cleanup: mantém só os últimos N por page ------------------------
-- N = 50 (configurável aqui). Quando uma nova versão é inserida, apaga
-- as mais antigas que excedem o limite.
create or replace function public.cleanup_old_page_versions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_keep integer := 50;
begin
  delete from public.page_versions
  where page_id = new.page_id
    and id in (
      select id from public.page_versions
      where page_id = new.page_id
      order by created_at desc
      offset max_keep
    );
  return new;
end;
$$;

drop trigger if exists trg_page_versions_cleanup on public.page_versions;
create trigger trg_page_versions_cleanup
  after insert on public.page_versions
  for each row execute function public.cleanup_old_page_versions();

-- ---- 4. Refresh schema cache -------------------------------------------------
notify pgrst, 'reload schema';
