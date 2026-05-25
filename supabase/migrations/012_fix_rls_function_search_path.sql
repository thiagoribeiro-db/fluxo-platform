-- =============================================================================
-- FLUXO PLATFORM — Migration 012: Fix search_path nas RLS helper functions
-- =============================================================================
-- As funções `is_org_member` e `user_role_in_org` foram criadas no schema
-- 001 com `security definer` mas SEM `set search_path`. Em projetos novos
-- do Supabase, isso quebra silenciosamente — `auth.uid()` e `memberships`
-- podem não resolver corretamente dentro do contexto da função, fazendo
-- ela retornar NULL/false sempre. Resultado: o user não consegue inserir
-- em `projects` mesmo sendo admin da org, dando
-- "permission denied for table projects".
--
-- Em projetos antigos (criados antes de Supabase reforçar a recomendação)
-- isso "funcionava" por acidente porque o search_path default cobria.
-- Em projetos novos é obrigatório explicitar.
--
-- Esta migration RECRIA as 2 funções com `set search_path = public, auth`
-- pra garantir resolução correta em qualquer projeto.
--
-- IDEMPOTENTE — `create or replace` é safe em re-runs.
-- =============================================================================

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and organization_id = org_id
  );
$$;

create or replace function public.user_role_in_org(org_id uuid)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select role::text from public.memberships
  where user_id = auth.uid() and organization_id = org_id
  limit 1;
$$;

notify pgrst, 'reload schema';
