-- =============================================================================
-- FLUXO PLATFORM — Migration 016: Fix ambiguidade em list_share_comments
-- =============================================================================
-- A função `list_share_comments` (migration 014) tem `project_id` na cláusula
-- RETURNS TABLE — esse nome vira variável OUT implícita no PL/pgSQL. Quando
-- chamamos `select project_id from resolve_share_token(...)`, Postgres não
-- sabe se "project_id" é a variável OUT ou a coluna da função.
--
-- Erro:
--   ERROR: 42702 column reference "project_id" is ambiguous
--
-- Fix: alias explícito na chamada do resolve_share_token.
-- Mesma correção em `create_share_comment` por consistência.
--
-- IDEMPOTENTE.
-- =============================================================================

-- ---- 1. Re-cria list_share_comments com alias rst.project_id ----------------
drop function if exists public.list_share_comments(text);

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
  -- Alias `rst` desambigua: rst.project_id (coluna da função) != project_id
  -- (variável OUT do return).
  select rst.project_id into v_project_id
  from public.resolve_share_token(p_token) as rst;

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
  where c.project_id = v_project_id
  order by c.created_at asc;
end;
$$;

grant execute on function public.list_share_comments(text) to anon, authenticated;

-- ---- 2. Re-cria create_share_comment com aliases (preventivo) ----------------
-- Embora não dispare o erro (return é uuid simples sem OUT), aliases evitam
-- regressão se mexermos no return type no futuro.
drop function if exists public.create_share_comment(text, text, text, text, numeric, numeric, uuid);

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
  select rst.project_id, rst.permission
    into v_project_id, v_permission
  from public.resolve_share_token(p_token) as rst;

  if v_project_id is null then
    raise exception 'Token inválido ou expirado';
  end if;

  if v_permission not in ('comment', 'edit') then
    raise exception 'Esse link não permite comentar (permissão: %)', v_permission;
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Comentário não pode estar vazio';
  end if;

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

notify pgrst, 'reload schema';
