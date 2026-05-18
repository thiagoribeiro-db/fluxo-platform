-- =============================================================================
-- FLUXO PLATFORM — Migration 007: Versionamento de páginas por projeto
-- =============================================================================
-- Cada projeto agora pode ter N páginas (dev, hmg, prd ou nomes custom).
-- Cada página armazena seu próprio state (nodes/edges/viewport).
--
-- Migração: pra cada projeto existente, cria uma página "Principal" com o
-- state atual do projeto. O campo `projects.state` continua existindo
-- (legado/backup) mas a fonte da verdade passa a ser `project_pages.state`.
--
-- IDEMPOTENTE.
-- =============================================================================

-- ---- 1. Tabela project_pages -------------------------------------------------
create table if not exists public.project_pages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Página',
  state jsonb not null default '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'::jsonb,
  position integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pages_project on public.project_pages(project_id, position);

-- Trigger updated_at (reusa a função já existente)
drop trigger if exists trg_pages_updated_at on public.project_pages;
create trigger trg_pages_updated_at before update on public.project_pages
  for each row execute function public.set_updated_at();

-- ---- 2. Campo active_page_id em projects -------------------------------------
alter table public.projects
  add column if not exists active_page_id uuid references public.project_pages(id) on delete set null;

-- ---- 3. Migração: cria página "Principal" pra cada projeto existente --------
-- (só pra projetos que ainda não têm nenhuma página)
insert into public.project_pages (project_id, name, state, position, is_default)
select p.id, 'Principal', p.state, 0, true
from public.projects p
where not exists (
  select 1 from public.project_pages pp where pp.project_id = p.id
);

-- Set active_page_id pra a página default
update public.projects p
set active_page_id = pp.id
from public.project_pages pp
where pp.project_id = p.id
  and pp.is_default = true
  and p.active_page_id is null;

-- ---- 4. RLS ------------------------------------------------------------------
alter table public.project_pages enable row level security;

drop policy if exists "Members can view project pages" on public.project_pages;
create policy "Members can view project pages"
  on public.project_pages for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_pages.project_id
        and public.is_org_member(p.organization_id)
    )
  );

drop policy if exists "Editors and admins can manage pages (insert)" on public.project_pages;
create policy "Editors and admins can manage pages (insert)"
  on public.project_pages for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_pages.project_id
        and public.user_role_in_org(p.organization_id) in ('admin', 'editor')
    )
  );

drop policy if exists "Editors and admins can manage pages (update)" on public.project_pages;
create policy "Editors and admins can manage pages (update)"
  on public.project_pages for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_pages.project_id
        and public.user_role_in_org(p.organization_id) in ('admin', 'editor')
    )
  );

drop policy if exists "Editors and admins can manage pages (delete)" on public.project_pages;
create policy "Editors and admins can manage pages (delete)"
  on public.project_pages for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_pages.project_id
        and public.user_role_in_org(p.organization_id) in ('admin', 'editor')
    )
  );

-- ---- 5. Trigger pra criar página default em projetos NOVOS -------------------
create or replace function public.create_default_page_for_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_page_id uuid;
begin
  -- Cria página "Principal" automaticamente quando um novo projeto é inserido
  insert into public.project_pages (project_id, name, state, position, is_default)
  values (new.id, 'Principal', new.state, 0, true)
  returning id into new_page_id;

  -- Seta active_page_id no projeto
  update public.projects set active_page_id = new_page_id where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_project_created_create_page on public.projects;
create trigger on_project_created_create_page
after insert on public.projects
for each row execute function public.create_default_page_for_project();

-- ---- 6. Refresh schema cache -------------------------------------------------
notify pgrst, 'reload schema';
