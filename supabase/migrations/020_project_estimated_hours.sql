-- =============================================================================
-- FLUXO PLATFORM — Migration 020: Tempo estimado por projeto
-- =============================================================================
-- Coluna pra registrar quantas horas o projeto foi orçado. Designer informa
-- na tela do dashboard. Útil pra comparar orçado vs realizado e pra base
-- de cobrança/relatórios.
--
-- Nullable — projetos sem estimativa ficam NULL (= "não informado").
-- =============================================================================

alter table public.projects
  add column if not exists estimated_hours numeric;

comment on column public.projects.estimated_hours is
  'Horas estimadas pra entregar o projeto. Informado pelo designer/PM no dashboard. NULL = não orçado ainda.';

notify pgrst, 'reload schema';
