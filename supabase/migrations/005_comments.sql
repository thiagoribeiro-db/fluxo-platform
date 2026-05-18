-- =============================================================================
-- FLUXO PLATFORM — Migration 005: Comments policies + RPC pra listar com autor
-- =============================================================================
-- Adiciona policies UPDATE/DELETE que faltavam, e uma RPC pra trazer autor
-- junto na listagem (evita N+1).
--
-- IDEMPOTENTE.
-- =============================================================================

-- ---- 1. Policies que faltavam --------------------------------------------------
drop policy if exists "Authors can update own comments" on comments;
create policy "Authors can update own comments"
  on comments for update
  using (author_id = auth.uid());

drop policy if exists "Authors and admins can delete comments" on comments;
create policy "Authors and admins can delete comments"
  on comments for delete
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = comments.project_id
        and public.user_role_in_org(p.organization_id) = 'admin'
    )
  );

-- ---- 2. RPC pra listar comentários do projeto com nome do autor --------------
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
begin
  -- Apenas membros da org podem ver os comentários
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
    p.email as author_email,
    p.display_name as author_display_name,
    c.resolved_at,
    c.resolved_by,
    c.created_at,
    c.updated_at
  from public.comments c
  left join public.profiles p on p.id = c.author_id
  where c.project_id = p_project_id
  order by c.created_at asc;
end;
$$;

grant execute on function public.list_project_comments(uuid) to authenticated;

-- ---- 3. Refresh schema cache --------------------------------------------------
notify pgrst, 'reload schema';
