-- =============================================================================
-- FLUXO PLATFORM — Migration 009: RPCs SECURITY DEFINER pra edição via share
-- =============================================================================
-- Quando um usuário ANÔNIMO abre um link de compartilhamento com permission='edit',
-- ele não tem auth.uid() — RLS bloqueia UPDATE em project_pages.
--
-- Estas RPCs rodam com SECURITY DEFINER (bypass RLS) mas validam manualmente:
--   1. Token existe na tabela `shares`
--   2. Permission é 'edit'
--   3. Não expirou
--   4. Page/Project pertence ao share
--
-- IDEMPOTENTE.
-- =============================================================================

-- ---- 1. RPC pra salvar state de uma page ------------------------------------
create or replace function public.save_shared_page_state(
  p_token text,
  p_page_id uuid,
  p_state jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share record;
begin
  -- Busca o share pelo token
  select id, project_id, permission, expires_at into v_share
  from public.shares
  where share_token = p_token;

  if not found then
    raise exception 'Token inválido';
  end if;

  -- Valida permission
  if v_share.permission <> 'edit' then
    raise exception 'Share não tem permissão de edição';
  end if;

  -- Valida expiração
  if v_share.expires_at is not null and v_share.expires_at < now() then
    raise exception 'Link expirado';
  end if;

  -- Valida que a page pertence ao project do share
  if not exists (
    select 1 from public.project_pages
    where id = p_page_id and project_id = v_share.project_id
  ) then
    raise exception 'Página não pertence ao projeto compartilhado';
  end if;

  -- Atualiza state
  update public.project_pages
  set state = p_state, updated_at = now()
  where id = p_page_id;
end;
$$;

comment on function public.save_shared_page_state is
  'Permite que um usuário anônimo (via share token com permission=edit) salve o state de uma página do projeto compartilhado. Valida token, permission, expiração e ownership da page.';

-- ---- 2. RPC pra salvar state do projeto (legado, sem páginas) --------------
create or replace function public.save_shared_project_state(
  p_token text,
  p_state jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share record;
begin
  select id, project_id, permission, expires_at into v_share
  from public.shares
  where share_token = p_token;

  if not found then
    raise exception 'Token inválido';
  end if;

  if v_share.permission <> 'edit' then
    raise exception 'Share não tem permissão de edição';
  end if;

  if v_share.expires_at is not null and v_share.expires_at < now() then
    raise exception 'Link expirado';
  end if;

  update public.projects
  set state = p_state, updated_at = now()
  where id = v_share.project_id;
end;
$$;

comment on function public.save_shared_project_state is
  'Variante legada de save_shared_page_state — atualiza projects.state diretamente. Use só pra projetos sem páginas.';

-- ---- 3. Grants — anon e authenticated podem chamar -------------------------
grant execute on function public.save_shared_page_state(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.save_shared_project_state(text, jsonb) to anon, authenticated;
