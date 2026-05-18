-- =============================================================================
-- FLUXO PLATFORM — Initial Schema
-- =============================================================================
-- Multi-tenant: Organizations → Memberships (users + roles) → Projects → Nodes
-- =============================================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_organizations_slug on organizations(slug);

-- =============================================================================
-- USERS (extends Supabase auth.users)
-- =============================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- MEMBERSHIPS (user belongs to org with a role)
-- =============================================================================
create type member_role as enum ('admin', 'editor', 'viewer');

create table memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique(user_id, organization_id)
);

create index idx_memberships_user on memberships(user_id);
create index idx_memberships_org on memberships(organization_id);

-- =============================================================================
-- PROJECTS (a flow design)
-- =============================================================================
create table projects (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references profiles(id),
  -- Visibility levels
  visibility text not null default 'private' check (visibility in ('private', 'org', 'public')),
  -- Full project state (nodes, edges, viewport) stored as JSONB for fast load
  state jsonb not null default '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'::jsonb,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_org on projects(organization_id);
create index idx_projects_creator on projects(created_by);
create index idx_projects_visibility on projects(visibility);

-- =============================================================================
-- PROJECT_VERSIONS (history / audit log)
-- =============================================================================
create table project_versions (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  state jsonb not null,
  message text,
  author_id uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_versions_project on project_versions(project_id, created_at desc);

-- =============================================================================
-- COMMENTS (anchored to node IDs within projects)
-- =============================================================================
create table comments (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  -- Anchor: node_id within the project state, OR null for general project comments
  node_id text,
  -- Position on canvas (for floating comments not tied to nodes)
  position_x numeric,
  position_y numeric,
  -- Threading: parent comment for replies
  parent_id uuid references comments(id) on delete cascade,
  body text not null,
  author_id uuid not null references profiles(id),
  -- Resolved state
  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_comments_project on comments(project_id);
create index idx_comments_node on comments(project_id, node_id);
create index idx_comments_parent on comments(parent_id);

-- Mentions (extracted from comment body, stored separately for indexing)
create table comment_mentions (
  comment_id uuid not null references comments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (comment_id, user_id)
);

-- =============================================================================
-- SHARES (per-project share links with expiry/permission)
-- =============================================================================
create table shares (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  share_token text unique not null,
  permission text not null default 'view' check (permission in ('view', 'comment', 'edit')),
  expires_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_shares_token on shares(share_token);

-- =============================================================================
-- AUDIT LOG
-- =============================================================================
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references profiles(id),
  action text not null,         -- e.g., 'project.create', 'project.delete', 'membership.role_change'
  resource_type text,            -- e.g., 'project', 'comment', 'membership'
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_org on audit_logs(organization_id, created_at desc);

-- =============================================================================
-- TRIGGERS — updated_at auto-update
-- =============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_organizations_updated_at before update on organizations
  for each row execute function set_updated_at();
create trigger trg_projects_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger trg_comments_updated_at before update on comments
  for each row execute function set_updated_at();

-- =============================================================================
-- RLS — Row Level Security (multi-tenant isolation)
-- =============================================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table memberships enable row level security;
alter table projects enable row level security;
alter table project_versions enable row level security;
alter table comments enable row level security;
alter table comment_mentions enable row level security;
alter table shares enable row level security;
alter table audit_logs enable row level security;

-- Helper: is user member of org?
create or replace function is_org_member(org_id uuid)
returns boolean as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and organization_id = org_id
  );
$$ language sql security definer;

-- Helper: user's role in org
create or replace function user_role_in_org(org_id uuid)
returns text as $$
  select role::text from memberships
  where user_id = auth.uid() and organization_id = org_id
  limit 1;
$$ language sql security definer;

-- Policies: ORGANIZATIONS
create policy "Members can view their organizations"
  on organizations for select
  using (is_org_member(id));

create policy "Admins can update org"
  on organizations for update
  using (user_role_in_org(id) = 'admin');

-- Policies: PROFILES (self + org members)
create policy "Users can view their own profile" on profiles for select using (id = auth.uid());
create policy "Users can update their own profile" on profiles for update using (id = auth.uid());

-- Policies: MEMBERSHIPS
create policy "Members can view memberships in their orgs"
  on memberships for select
  using (is_org_member(organization_id));
create policy "Admins can manage memberships"
  on memberships for all
  using (user_role_in_org(organization_id) = 'admin');

-- Policies: PROJECTS
create policy "Members can view org projects"
  on projects for select
  using (
    is_org_member(organization_id)
    or visibility = 'public'
  );
create policy "Editors and admins can update projects"
  on projects for update
  using (user_role_in_org(organization_id) in ('admin', 'editor'));
create policy "Editors and admins can create projects"
  on projects for insert
  with check (user_role_in_org(organization_id) in ('admin', 'editor'));
create policy "Admins can delete projects"
  on projects for delete
  using (user_role_in_org(organization_id) = 'admin');

-- Policies: COMMENTS (anyone with access to the project can comment)
create policy "Project viewers can read comments"
  on comments for select
  using (
    exists (select 1 from projects where id = comments.project_id and is_org_member(organization_id))
  );
create policy "Project members can post comments"
  on comments for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from projects where id = comments.project_id and is_org_member(organization_id))
  );

-- Policies: SHARES (public-accessible by token)
create policy "Anyone with valid share token can use it"
  on shares for select
  using (true); -- Actually validated in code via token match

-- Policies: AUDIT (read-only for admins)
create policy "Admins can view audit logs"
  on audit_logs for select
  using (user_role_in_org(organization_id) = 'admin');
