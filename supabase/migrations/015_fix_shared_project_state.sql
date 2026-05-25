-- =============================================================================
-- FLUXO PLATFORM — Migration 015: Fix get_shared_project pra ler page ativa
-- =============================================================================
-- A migration 003 cria `get_shared_project` que retorna `projects.state`. Mas
-- na migration 007 a fonte da verdade do state passou pra `project_pages.state`
-- e `projects.state` virou backup/legado. Resultado: links públicos abrem o
-- projeto VAZIO porque pegam o state legado (vazio ou desatualizado).
--
-- Esta migration recria a função pra:
--   1. Pegar `active_page_id` do projeto
--   2. Retornar o `state` da página ativa
--   3. Fallback pra `projects.state` se não houver page (projetos legados)
--
-- IDEMPOTENTE — `drop function` + `create or replace`.
-- =============================================================================

drop function if exists public.get_shared_project(text);

create or replace function public.get_shared_project(token text)
returns table(
  id uuid,
  name text,
  description text,
  state jsonb,
  permission text,
  expires_at timestamptz,
  organization_id uuid,
  updated_at timestamptz,
  active_page_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.name,
    p.description,
    -- Página ativa primeiro; fallback pro state legado de projects
    coalesce(pp.state, p.state) as state,
    s.permission,
    s.expires_at,
    p.organization_id,
    coalesce(pp.updated_at, p.updated_at) as updated_at,
    p.active_page_id
  from public.shares s
  join public.projects p on p.id = s.project_id
  left join public.project_pages pp on pp.id = p.active_page_id
  where s.share_token = token
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
end;
$$;

grant execute on function public.get_shared_project(text) to anon, authenticated;

notify pgrst, 'reload schema';
