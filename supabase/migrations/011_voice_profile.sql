-- =============================================================================
-- FLUXO PLATFORM — Migration 011: Voice & Tone profile global
-- =============================================================================
-- Adiciona coluna `voice_profile_default` em `profiles` pra armazenar o
-- preset de Voice & Tone padrão que o usuário escolheu em
-- /dashboard/settings.
--
-- Antes: profile guardado em localStorage (`fluxo-voice-profile-default`),
-- por dispositivo. Limitação real: se o usuário troca de máquina/browser,
-- perde o profile. Pra time, cada membro tinha que reconfigurar.
--
-- Agora: profile fica no banco, acessível de qualquer dispositivo.
--
-- Formato da coluna (jsonb):
--   {
--     "preset": "casual-proximo" | "formal-tecnico" | ... | "custom",
--     "description": "Tom casual e amistoso...",
--     "examples": ["Olá! 👋", "Pronto! ✓"]
--   }
--
-- IDEMPOTENTE — usa `add column if not exists`.
-- =============================================================================

alter table public.profiles
  add column if not exists voice_profile_default jsonb;

-- Refresh schema cache
notify pgrst, 'reload schema';
