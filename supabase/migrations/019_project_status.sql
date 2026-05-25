-- =============================================================================
-- FLUXO PLATFORM — Migration 019: Status do projeto (draft/review/approved)
-- =============================================================================
-- Adiciona ciclo de vida visível ao projeto: rascunho → em revisão →
-- aprovado → arquivado. Usado pra filtros no dashboard e pra dar contexto
-- visual no editor.
--
-- IDEMPOTENTE.
-- =============================================================================

alter table public.projects
  add column if not exists status text not null default 'draft'
  check (status in ('draft', 'review', 'approved', 'archived'));

create index if not exists idx_projects_status on public.projects(status);

comment on column public.projects.status is
  'Ciclo de vida do projeto: draft (em construção), review (em revisão), approved (aprovado pelo cliente), archived (concluído/parado).';

notify pgrst, 'reload schema';
