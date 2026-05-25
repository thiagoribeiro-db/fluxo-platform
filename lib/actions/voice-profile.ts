'use server';

/**
 * Server actions pra Voice & Tone profile GLOBAL — persiste no banco em vez
 * de localStorage. Permite o profile acompanhar o user entre dispositivos.
 *
 * Coluna `profiles.voice_profile_default jsonb` (migration 011).
 *
 * Profile do PROJETO (override) continua em localStorage por enquanto —
 * é escopo mais granular e mudança rara, não justifica round-trip ao banco.
 */
import { createClient } from '@/lib/supabase/server';
import type { VoiceProfile } from '@/lib/voice-tone/types';

/**
 * Carrega o profile default do user autenticado. Retorna `null` se nada
 * configurado ainda (o client pode fallback pro DEFAULT_PROFILE hardcoded).
 */
export async function loadGlobalVoiceProfileDB(): Promise<VoiceProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('voice_profile_default')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[voice-profile] load error:', error);
    return null;
  }

  const profile = data?.voice_profile_default as VoiceProfile | null;
  if (!profile || typeof profile.description !== 'string' || !profile.preset) {
    return null;
  }
  return profile;
}

/**
 * Salva (upsert) o profile default do user autenticado.
 */
export async function saveGlobalVoiceProfileDB(
  profile: VoiceProfile
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { error } = await supabase
    .from('profiles')
    .update({ voice_profile_default: profile })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Falha ao salvar Voice & Tone: ${error.message}`);
  }
}

/**
 * Apaga o profile default (volta pro DEFAULT_PROFILE hardcoded).
 */
export async function clearGlobalVoiceProfileDB(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { error } = await supabase
    .from('profiles')
    .update({ voice_profile_default: null })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Falha ao limpar Voice & Tone: ${error.message}`);
  }
}
