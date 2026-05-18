-- =============================================================================
-- FLUXO PLATFORM — Migration 006: Fix da RPC list_project_comments
-- =============================================================================
-- A RPC anterior chamava is_org_member() (security definer) de dentro de outra
-- security definer — em alguns casos auth.uid() perde contexto entre funções
-- aninhadas, retornando vazio mesmo pra membro válido.
--
-- Esta versão faz a checagem de membership INLINE (sem função aninhada).
-- =============================================================================

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
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  is_member boolean;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    return;
  end if;

  -- Check membership INLINE (não usa is_org_member aninhada)
  select exists (
    select 1
    from public.memberships m
    join public.projects p on p.organization_id = m.organization_id
    where m.user_id = current_user_id
      and p.id = p_project_id
  ) into is_member;

  if not is_member then
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
