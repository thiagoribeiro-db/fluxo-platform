/**
 * Persistência do Voice Profile no localStorage.
 *
 * Hierarquia:
 *  1. Profile POR PROJETO — `fluxo-voice-profile-<projectId>` (override local)
 *  2. Profile GLOBAL/DEFAULT — `fluxo-voice-profile-default` (configurado no
 *     Dashboard → Configurações, aplica como base pra todos os projetos novos)
 *  3. DEFAULT_PROFILE hardcoded (fallback final — Casual próximo)
 *
 * `loadVoiceProfile(projectId)` faz fallback automático: se o projeto não
 * tem profile salvo, retorna o global; se nem global existe, retorna o
 * default hardcoded.
 *
 * Decisão: localStorage em vez de DB pra evitar migration. Quando virar
 * feature consolidada, dá pra migrar pro Supabase (coluna `preferences jsonb`
 * em `profiles` ou tabela própria).
 */
import { DEFAULT_PROFILE } from './presets';
import type { VoiceProfile } from './types';

function storageKey(projectId: string): string {
  return `fluxo-voice-profile-${projectId}`;
}

const GLOBAL_KEY = 'fluxo-voice-profile-default';

function isValidProfile(p: unknown): p is VoiceProfile {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  return typeof obj.description === 'string' && typeof obj.preset === 'string';
}

/**
 * Carrega o profile do projeto. Fallback: global → default hardcoded.
 */
export function loadVoiceProfile(projectId: string): VoiceProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidProfile(parsed)) return parsed;
    }
  } catch {
    /* ignora — tenta fallback */
  }
  // Fallback 1: profile global do user
  return loadGlobalDefaultProfile();
}

export function saveVoiceProfile(projectId: string, profile: VoiceProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(profile));
  } catch {
    // localStorage cheio ou bloqueado — ignora silenciosamente
  }
}

export function clearVoiceProfile(projectId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(projectId));
  } catch {
    /* ignora */
  }
}

// ===========================================================================
// PROFILE GLOBAL/DEFAULT — configurado no Dashboard → Configurações
// ===========================================================================

/**
 * Carrega o profile default global do usuário. Se não houver, retorna o
 * DEFAULT_PROFILE hardcoded.
 */
export function loadGlobalDefaultProfile(): VoiceProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(GLOBAL_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    if (isValidProfile(parsed)) return parsed;
    return DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveGlobalDefaultProfile(profile: VoiceProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(profile));
  } catch {
    /* ignora */
  }
}

export function clearGlobalDefaultProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GLOBAL_KEY);
  } catch {
    /* ignora */
  }
}

/**
 * Verifica se há um profile global configurado (distinto do hardcoded default).
 */
export function hasGlobalDefaultProfile(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(GLOBAL_KEY) !== null;
  } catch {
    return false;
  }
}
