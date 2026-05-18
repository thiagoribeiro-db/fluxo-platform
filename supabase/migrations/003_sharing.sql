-- =============================================================================
-- FLUXO PLATFORM — Migration 003: Sharing por share token
-- =============================================================================
-- Permite criar links públicos por projeto.
-- Acesso ao projeto via /share/[token] sem login.
--
-- IDEMPOTENTE: pode rodar várias vezes sem quebrar.
-- =============================================================================

-- ---- 1. RPC para acessar projeto via share token (SECURITY DEFINER) -------
create or replace function public.get_shared_project(token text)
returns table(
  id uuid,
  name text,
  description text,
  state jsonb,
  permission text,
  expires_at timestamptz,
  organization_id uuid,
  updated_at timestamptz
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
    p.state,
    s.permission,
    s.expires_at,
    p.organization_id,
    p.updated_at
  from public.shares s
  join public.projects p on p.id = s.project_id
  where s.share_token = token
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
end;
$$;

grant execute on function public.get_shared_project(text) to anon, authenticated;

-- ---- 2. Policies de SHARES (idempotentes) ----------------------------------
drop policy if exists "Anyone with valid share token can use it" on shares;
drop policy if exists "Owner can list own shares" on shares;
drop policy if exists "Members can create shares" on shares;
drop policy if exists "Owner can revoke own shares" on shares;

-- SELECT: owner pode listar seus shares
create policy "Owner can list own shares"
  on shares for select
  using (created_by = auth.uid());

-- INSERT: usuário cria share pra projeto da org dele
create policy "Members can create shares"
  on shares for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.is_org_member(p.organization_id)
    )
  );

-- DELETE: só o criador revoga
create policy "Owner can revoke own shares"
  on shares for delete
  using (created_by = auth.uid());

-- ---- 3. Refresh do PostgREST schema cache ----------------------------------
notify pgrst, 'reload schema';
