-- =============================================================================
-- FLUXO PLATFORM — Migration 022: Log de uso da IA (tokens + custo)
-- =============================================================================
-- Cada chamada à API Anthropic vira uma row. Métricas armazenadas:
--   - feature: qual feature usou (parse, voice-tone, ai-chat, etc.)
--   - model: modelo invocado
--   - input/output tokens + cache (read + creation)
--   - cost_usd calculado no client (tabela de preços fica no código)
--
-- Útil pra:
--   - Painel de "Uso IA" por projeto (heatmap diário)
--   - Identificar features que consomem mais
--   - Auditoria de custo por org
--
-- RLS: members da org dona do projeto leem; INSERT só via server action interna.
-- =============================================================================

create table if not exists public.ia_usage (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  -- Cost em USD com 6 casas (tipo decimal evita float drift)
  cost_usd numeric(10, 6) not null default 0,
  -- Latência total da chamada em ms — útil pra ver performance
  latency_ms integer,
  -- Erro opcional — se a chamada falhou (registra mesmo assim pra ver trend)
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ia_usage_project on public.ia_usage(project_id, created_at desc);
create index if not exists idx_ia_usage_feature on public.ia_usage(feature, created_at desc);

comment on table public.ia_usage is
  'Log de cada chamada à API Anthropic com tokens + custo calculado. Alimenta painel /dashboard/ia-usage e relatórios de custo.';

-- ---- RLS --------------------------------------------------------------------
alter table public.ia_usage enable row level security;

drop policy if exists "Org members can read ia_usage" on public.ia_usage;
create policy "Org members can read ia_usage"
  on public.ia_usage for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = ia_usage.project_id
        and public.is_org_member(p.organization_id)
    )
  );

drop policy if exists "Org members can insert ia_usage" on public.ia_usage;
create policy "Org members can insert ia_usage"
  on public.ia_usage for insert
  with check (
    (user_id is null or user_id = auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = ia_usage.project_id
        and public.is_org_member(p.organization_id)
    )
  );

notify pgrst, 'reload schema';
