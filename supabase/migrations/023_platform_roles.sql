-- =============================================================================
-- FLUXO PLATFORM — Platform Roles + Project Collaborators
-- =============================================================================
-- Adds:
--   1. platform_role on profiles: 'editor' (default) | 'admin' | 'superAdmin'
--   2. project_collaborators: cross-org project sharing by email
--   3. Helper functions: is_platform_superadmin, get_my_platform_role
--   4. Updated RLS: superAdmin sees all projects; collaborators see shared projects
--   5. Updated profiles SELECT: org members can see each other (for sharing UI)
-- =============================================================================

-- 1. Add platform_role to profiles (all existing users get 'editor' default)
alter table profiles
  add column if not exists platform_role text
  not null default 'editor'
  check (platform_role in ('editor', 'admin', 'superAdmin'));

create index if not exists idx_profiles_platform_role
  on profiles(platform_role);

-- 2. project_collaborators — explicit per-project share to another platform user
create table if not exists project_collaborators (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id)  on delete cascade,
  user_id     uuid not null references profiles(id)  on delete cascade,
  invited_by  uuid not null references profiles(id),
  permission  text not null default 'edit'
              check (permission in ('view', 'edit')),
  created_at  timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists idx_collab_project  on project_collaborators(project_id);
create index if not exists idx_collab_user     on project_collaborators(user_id);

alter table project_collaborators enable row level security;

-- 3. Helper: is current user superAdmin?
create or replace function is_platform_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select platform_role = 'superAdmin' from profiles where id = auth.uid()),
    false
  );
$$;

-- Helper: get current user's platform_role (safe for client calls)
create or replace function get_my_platform_role()
returns text
language sql
security definer
set search_path = public
as $$
  select platform_role from profiles where id = auth.uid();
$$;

-- 4. Update project SELECT policy — preserve org access, add superAdmin + collaborators
drop policy if exists "Members can view org projects" on projects;

create policy "Users can view accessible projects"
  on projects for select
  using (
    -- SuperAdmin sees everything
    is_platform_superadmin()
    -- Org members see org projects (existing behavior)
    or is_org_member(organization_id)
    -- Public projects
    or visibility = 'public'
    -- Own projects (belt-and-suspenders for editors without org)
    or created_by = auth.uid()
    -- Explicitly shared via project_collaborators
    or exists (
      select 1 from project_collaborators pc
      where pc.project_id = projects.id
        and pc.user_id = auth.uid()
    )
  );

-- 5. Update profiles SELECT — let platform users see each other
--    (required for the "share by email" lookup and access management page)
drop policy if exists "Users can view their own profile" on profiles;
drop policy if exists "Users can view profiles" on profiles;

create policy "Users can view accessible profiles"
  on profiles for select
  using (
    -- Own profile
    id = auth.uid()
    -- SuperAdmin sees all (security definer — sem recursão)
    or is_platform_superadmin()
    -- Admins see all — usa get_my_platform_role() que é security definer
    -- IMPORTANTE: não usar (SELECT platform_role FROM profiles ...) aqui
    -- pois causaria recursão infinita no RLS da própria tabela profiles.
    or get_my_platform_role() = 'admin'
    -- Same-org members see each other
    or exists (
      select 1 from memberships my_m
      join memberships their_m
        on their_m.organization_id = my_m.organization_id
        and their_m.user_id = profiles.id
      where my_m.user_id = auth.uid()
    )
  );

-- SuperAdmins and the profile owner can update platform_role
drop policy if exists "Users can update their own profile" on profiles;

create policy "Users can update their own profile"
  on profiles for update
  -- USING: quais linhas podem ser alvo do UPDATE
  --   próprio perfil OU superAdmin pode atualizar qualquer um
  using (
    id = auth.uid()
    or is_platform_superadmin()
  )
  -- WITH CHECK: o que é permitido escrever
  with check (
    id = auth.uid()
    or is_platform_superadmin()
  );

-- 6. RLS for project_collaborators

-- NOTA: não referenciar a tabela `projects` aqui!
-- projects SELECT já referencia project_collaborators — cruzar de volta causa recursão infinita.
-- O criador do projeto já é coberto por invited_by (ele mesmo compartilhou).
create policy "View project collaborations"
  on project_collaborators for select
  using (
    user_id    = auth.uid()
    or invited_by = auth.uid()
    or is_platform_superadmin()
  );

create policy "Add project collaborators"
  on project_collaborators for insert
  with check (
    invited_by = auth.uid()
    and (
      is_platform_superadmin()
      -- Creator can share their own project
      or exists (
        select 1 from projects p
        where p.id = project_id
          and p.created_by = auth.uid()
      )
      -- Org admin can share any org project
      or exists (
        select 1 from projects p
        join memberships m
          on m.organization_id = p.organization_id
          and m.user_id = auth.uid()
          and m.role = 'admin'
        where p.id = project_id
      )
    )
  );

create policy "Remove project collaborators"
  on project_collaborators for delete
  using (
    -- The person who was invited can remove themselves
    user_id = auth.uid()
    -- The inviter can remove
    or invited_by = auth.uid()
    -- Project creator can remove
    or exists (
      select 1 from projects p
      where p.id = project_id
        and p.created_by = auth.uid()
    )
    or is_platform_superadmin()
  );

-- 7. Update the new-user trigger to preserve platform_role for pending invitations
--    (if a platform_invitations table is added later, hook here)
--    For now, new users always start as 'editor'.
