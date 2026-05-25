-- =============================================================================
-- FLUXO PLATFORM — Migration 018: Permite admin/editor resolver comments externos
-- =============================================================================
-- A policy UPDATE de comments (migration 005) só permite o autor original
-- editar:
--   using (author_id = auth.uid())
--
-- Comments externos (criados via share link) têm `author_id = NULL`, então
-- ninguém consegue marcar como resolvido. Owner do projeto precisa fazer
-- triagem.
--
-- Fix: amplia a policy pra também permitir membros admin/editor da org dona
-- do projeto. Author continua podendo editar próprio comment; admin/editor
-- consegue resolver/reabrir qualquer um (inclusive externos).
--
-- IDEMPOTENTE.
-- =============================================================================

drop policy if exists "Authors can update own comments" on public.comments;

create policy "Authors or org editors can update comments"
  on public.comments for update
  using (
    -- Autor original (members internos)
    author_id = auth.uid()
    -- OU admin/editor da org dona do projeto (cobre resolver comments externos)
    or exists (
      select 1 from public.projects p
      where p.id = comments.project_id
        and public.user_role_in_org(p.organization_id) in ('admin', 'editor')
    )
  );

notify pgrst, 'reload schema';
