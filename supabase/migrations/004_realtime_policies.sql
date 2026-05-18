-- =============================================================================
-- FLUXO PLATFORM — Migration 004: Realtime Authorization policies
-- =============================================================================
-- Necessária APENAS se Realtime Authorization estiver habilitada no projeto
-- Supabase (introduzido em 2024). Quando ON, anon não pode subscribe/broadcast
-- em canais a menos que existam policies em realtime.messages.
--
-- Rode SE OS LOGS MOSTRAREM 'subscribe status: CHANNEL_ERROR'.
-- =============================================================================

-- ---- Permite TODOS (anon e authenticated) lerem/enviarem mensagens ---------
-- Se a tabela realtime.messages não existir, esse bloco é no-op.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'realtime' and table_name = 'messages'
  ) then

    -- SELECT: lê broadcasts e presence
    drop policy if exists "Allow public to read realtime messages" on realtime.messages;
    create policy "Allow public to read realtime messages"
      on realtime.messages
      for select
      to anon, authenticated
      using (true);

    -- INSERT: envia broadcast e atualiza presence
    drop policy if exists "Allow public to send realtime messages" on realtime.messages;
    create policy "Allow public to send realtime messages"
      on realtime.messages
      for insert
      to anon, authenticated
      with check (true);

  end if;
end $$;

-- ---- Refresh schema cache --------------------------------------------------
notify pgrst, 'reload schema';
