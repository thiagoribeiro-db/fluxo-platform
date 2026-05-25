-- =============================================================================
-- FLUXO PLATFORM — Migration 008: Tabela de Component Specs (custom + override)
-- =============================================================================
-- Componentes "builtins" continuam vivendo em YAML (lib/component-specs/builtins/).
-- Esta tabela armazena:
--   1. CUSTOMS: specs novos criados pelo usuário (kinds inéditos)
--   2. OVERRIDES: edições de builtins (mesmo spec_id de um YAML, mas com `data`
--      sobrescrita pela org)
--
-- O loader (`lib/component-specs/loader.ts`) faz o MERGE: YAML como base,
-- DB sobrescreve por `spec_id` quando há override.
--
-- IDEMPOTENTE.
-- =============================================================================

-- ---- 1. Tabela component_specs ----------------------------------------------
create table if not exists public.component_specs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- ID semântico do spec (matches a `id` no YAML — ex: "bot", "user", "menu").
  -- Pra customs, é um slug gerado pelo usuário (ex: "campanha-natal").
  spec_id text not null,
  -- true = override de um builtin com mesmo spec_id; false = custom novo.
  is_override boolean not null default false,
  -- Conteúdo completo do spec (mesmas chaves do TS ComponentSpec).
  data jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraint: por org, só pode haver UM spec por spec_id (override OU custom)
  unique (organization_id, spec_id)
);

create index if not exists idx_specs_org on public.component_specs(organization_id, spec_id);

-- ---- 2. Trigger updated_at --------------------------------------------------
-- Função genérica `update_updated_at_column` — escreve `now()` em `updated_at`
-- antes de cada UPDATE. Definida aqui (em vez de migration separada) pra
-- garantir que projetos novos do Supabase, que não vêm com essa função
-- automaticamente, consigam aplicar a migration sem erro
-- "function public.update_updated_at_column() does not exist".
-- IDEMPOTENTE — `create or replace` é safe em re-runs.
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_specs_updated_at on public.component_specs;
create trigger trg_specs_updated_at before update on public.component_specs
  for each row execute function public.update_updated_at_column();

-- ---- 3. RLS -----------------------------------------------------------------
alter table public.component_specs enable row level security;

-- Leitura: qualquer membro da org pode ler os specs dela.
drop policy if exists "specs_select_member" on public.component_specs;
create policy "specs_select_member" on public.component_specs
  for select using (
    exists (
      select 1 from public.memberships m
      where m.organization_id = component_specs.organization_id
        and m.user_id = auth.uid()
    )
  );

-- Insert: qualquer admin/editor da org pode criar.
drop policy if exists "specs_insert_editor" on public.component_specs;
create policy "specs_insert_editor" on public.component_specs
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.organization_id = component_specs.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'editor')
    )
  );

-- Update: mesma regra do insert.
drop policy if exists "specs_update_editor" on public.component_specs;
create policy "specs_update_editor" on public.component_specs
  for update using (
    exists (
      select 1 from public.memberships m
      where m.organization_id = component_specs.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'editor')
    )
  );

-- Delete: só admin.
drop policy if exists "specs_delete_admin" on public.component_specs;
create policy "specs_delete_admin" on public.component_specs
  for delete using (
    exists (
      select 1 from public.memberships m
      where m.organization_id = component_specs.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

-- ---- 4. Comentário ----------------------------------------------------------
comment on table public.component_specs is
  'Componentes customizados ou overrides de builtins. Builtins canônicos ficam em YAML no repo; aqui armazenamos só extensões/customizações por org.';
