-- =============================================================================
-- FLUXO PLATFORM — Migration 013: GRANTs em tabelas pras roles do Supabase
-- =============================================================================
-- Em projetos NOVOS do Supabase, GRANT em tabelas pras roles `authenticated`
-- e `anon` NÃO é automático. RLS policies sozinhas não bastam — Postgres
-- bloqueia o acesso ANTES de RLS rodar se a role não tem GRANT na tabela.
-- Erro típico:
--   "permission denied for table projects"
--   "HINT: Grant the required privileges to the current role with:
--    GRANT SELECT, INSERT ON public.projects TO authenticated;"
--
-- Em projetos ANTIGOS (pré-2024), o Supabase setava esses GRANTs
-- automaticamente, daí o schema 001 funcionava sem grants explícitos.
-- Em projetos NOVOS, precisa GRANT na hora da criação.
--
-- Esta migration aplica os GRANTs padrão recomendados pelo Supabase:
--   - authenticated: SELECT, INSERT, UPDATE, DELETE em todas tabelas
--     (RLS continua filtrando por user — RLS é a segurança real, GRANT é
--      só "pode tocar nessa tabela")
--   - anon: SELECT (via policies de sharing público)
--   - default privileges: garantir que tabelas FUTURAS criadas em public
--     também tenham os mesmos grants (sem precisar repetir)
--
-- IDEMPOTENTE — `grant` é seguro re-aplicar.
-- =============================================================================

-- ---- 1. Usage no schema -----------------------------------------------------
grant usage on schema public to authenticated, anon;

-- ---- 2. Grants em TABELAS existentes ----------------------------------------
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

-- ---- 3. Grants em SEQUENCES (pra colunas serial/bigserial) -------------------
grant usage, select on all sequences in schema public to authenticated;

-- ---- 4. Default privileges pra tabelas FUTURAS -------------------------------
-- Se criarmos novas tabelas em migrations futuras, elas herdam os grants
-- corretos automaticamente — sem precisar lembrar de adicionar à mão.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

notify pgrst, 'reload schema';
