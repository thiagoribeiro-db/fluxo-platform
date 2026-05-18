-- =============================================================================
-- FLUXO PLATFORM — Migration 002: Fix RLS policies + onboarding helpers
-- =============================================================================
-- Corrige 3 problemas da migration 001:
--   1. organizations não tinha policy de INSERT (RLS bloqueava criação)
--   2. memberships exigia ser admin pra criar — paradoxo p/ primeira membership
--   3. profiles não tinha trigger pra ser criado automaticamente após signup
-- =============================================================================

-- ---- 1. AUTO-CREATE PROFILE on auth.users insert -----------------------------
-- Quando o usuário faz login pela 1ª vez (Supabase Auth cria registro em
-- auth.users), criamos automaticamente o profile correspondente.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill: cria profile pra users que já existem em auth.users
insert into public.profiles (id, email, display_name)
select id, email, split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;

-- ---- 2. PROFILE INSERT policy ------------------------------------------------
-- Permite o usuário inserir o próprio profile (defensive — o trigger já faz isso)
drop policy if exists "Users can insert their own profile" on profiles;
create policy "Users can insert their own profile"
  on profiles for insert
  with check (id = auth.uid());

-- ---- 3. CREATE ORG via função atômica (bypass RLS controlado) ----------------
-- Cria a organização + membership-admin do criador na mesma transação.
-- Como `security definer`, roda com privilégios do owner do schema (bypass RLS),
-- mas autentica via auth.uid() — só usuários logados podem chamar.
create or replace function public.create_organization_with_admin(
  org_name text,
  org_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Garante profile (defensive — trigger geralmente já fez isso)
  insert into public.profiles (id, email)
  select current_user_id, email from auth.users where id = current_user_id
  on conflict (id) do nothing;

  -- Cria org
  insert into public.organizations (name, slug)
  values (org_name, org_slug)
  returning id into new_org_id;

  -- Cria membership como admin
  insert into public.memberships (user_id, organization_id, role)
  values (current_user_id, new_org_id, 'admin');

  return new_org_id;
end;
$$;

grant execute on function public.create_organization_with_admin to authenticated;

-- ---- 4. Policies adicionais que facilitam o uso ------------------------------
-- Permite admins/editors atualizar a org (ex: renomear workspace)
-- (já existia, mas garantir o nome)

-- Permite que o usuário VEJA a própria membership recém-criada
-- (a policy original "Members can view memberships in their orgs" usa
--  is_org_member que faz lookup na mesma tabela — funciona, mas testar)

-- Permite INSERT/UPDATE/DELETE em projetos quando autenticado e é membro
-- A policy original "Editors and admins can create projects" já cobre isso,
-- mas precisa garantir que user_role_in_org consiga ver a membership recém-criada.

-- ---- 5. Sanity: refresh do PostgREST schema cache -----------------------------
-- (PostgREST faz cache do schema; força reload pra reconhecer a nova função RPC)
notify pgrst, 'reload schema';
