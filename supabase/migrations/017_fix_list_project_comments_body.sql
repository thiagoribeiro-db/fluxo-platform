-- =============================================================================
-- FLUXO PLATFORM — Migration 017: Fix off-by-one em list_project_comments
-- =============================================================================
-- A função `list_project_comments` (recriada na migration 014) tem 15 colunas
-- no `RETURNS TABLE` mas o SELECT só projeta 14 — falta `c.body`. Isso causa
-- erro silencioso de mismatch de tipo quando há rows pra retornar (text
-- mapeado em uuid e vice-versa). Frontend recebe lista vazia.
--
-- Mesmo fix que aplicamos no `list_share_comments` (migration 016) — basta
-- adicionar `c.body` na posição correta.
--
-- IDEMPOTENTE.
-- =============================================================================

drop function if exists public.list_project_comments(uuid);

create or replace function public.list_project_comments(p_project_id uuid)
returns table(
  id uuid,
  project_id uuid,
  node_id text,
  position_x numeric,
  position_y numeric,
  parent_id uuid,
  body text,
  author_id uuid,
  author_email text,
  author_display_name text,
  external_author_name text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and public.is_org_member(p.organization_id)
  ) then
    return;
  end if;

  return query
  select
    c.id,
    c.project_id,
    c.node_id,
    c.position_x,
    c.position_y,
    c.parent_id,
    c.body,
    c.author_id,
    pr.email as author_email,
    pr.display_name as author_display_name,
    c.external_author_name,
    c.resolved_at,
    c.resolved_by,
    c.created_at,
    c.updated_at
  from public.comments c
  left join public.profiles pr on pr.id = c.author_id
  where c.project_id = p_project_id
  order by c.created_at asc;
end;
$$;

grant execute on function public.list_project_comments(uuid) to authenticated;

notify pgrst, 'reload schema';
