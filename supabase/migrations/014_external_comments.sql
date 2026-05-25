-- =============================================================================
-- FLUXO PLATFORM — Migration 014: Comentários externos (via share link)
-- =============================================================================
-- Permite que usuários acessando via share link com `permission = 'comment'`
-- ou `'edit'` criem comentários sem ter conta no sistema. O autor é gravado
-- como string em `external_author_name` (em vez de um UUID em `author_id`).
--
-- O RPC `create_share_comment` valida o token, garante que a permission
-- permite comentar, e insere o comment. Já o `list_share_comments` lista
-- todos os comentários do projeto associado ao token, pra que o cliente
-- veja também os comentários internos.
--
-- IDEMPOTENTE.
-- =============================================================================

-- ---- 1. Schema --------------------------------------------------------------
-- author_id passa a ser opcional (NULL = comment externo)
alter table public.comments alter column author_id drop not null;

-- Nome do autor externo (digitado no form da página /share/[token])
alter table public.comments add column if not exists external_author_name text;

-- ---- 2. Função helper: resolve share token → project_id + permission ---------
create or replace function public.resolve_share_token(p_token text)
returns table(project_id uuid, permission text)
language sql
security definer
set search_path = public
as $$
  select s.project_id, s.permission::text
  from public.shares s
  where s.share_token = p_token
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;

grant execute on function public.resolve_share_token(text) to anon, authenticated;

-- ---- 3. RPC: criar comentário via share token --------------------------------
create or replace function public.create_share_comment(
  p_token text,
  p_author_name text,
  p_body text,
  p_node_id text default null,
  p_position_x numeric default null,
  p_position_y numeric default null,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_permission text;
  v_id uuid;
begin
  -- 1. Valida token + permission
  select project_id, permission into v_project_id, v_permission
  from public.resolve_share_token(p_token);

  if v_project_id is null then
    raise exception 'Token inválido ou expirado';
  end if;

  if v_permission not in ('comment', 'edit') then
    raise exception 'Esse link não permite comentar (permissão: %)', v_permission;
  end if;

  -- 2. Sanity: body não-vazio
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Comentário não pode estar vazio';
  end if;

  -- 3. Insere — author_id NULL, external_author_name preenchido
  insert into public.comments (
    project_id,
    body,
    node_id,
    position_x,
    position_y,
    parent_id,
    author_id,
    external_author_name
  ) values (
    v_project_id,
    p_body,
    p_node_id,
    p_position_x,
    p_position_y,
    p_parent_id,
    null,
    coalesce(nullif(trim(p_author_name), ''), 'Anônimo')
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_share_comment(text, text, text, text, numeric, numeric, uuid) to anon, authenticated;

-- ---- 4. RPC: listar comentários via share token ------------------------------
-- Equivalente de `list_project_comments` mas auth via token (não membership)
create or replace function public.list_share_comments(p_token text)
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
declare
  v_project_id uuid;
begin
  select project_id into v_project_id from public.resolve_share_token(p_token);
  if v_project_id is null then
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
  where c.project_id = v_project_id
  order by c.created_at asc;
end;
$$;

grant execute on function public.list_share_comments(text) to anon, authenticated;

-- ---- 5. Atualiza list_project_comments pra incluir external_author_name ------
-- Recria a função (já existe da 005/006) pra retornar a coluna nova.
-- DROP obrigatório: Postgres não deixa `create or replace` mudar return type.
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
