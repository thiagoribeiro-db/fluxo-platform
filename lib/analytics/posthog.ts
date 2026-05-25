/**
 * PostHog — analytics de uso.
 *
 * Setup defensivo: só carrega/identifica usuário se a env var
 * `NEXT_PUBLIC_POSTHOG_KEY` estiver setada. Sem ela, vira no-op total
 * (sem rede, sem JS extra carregado).
 *
 * USO:
 *   import { track, identify } from '@/lib/analytics/posthog';
 *   track('frame_added', { type: 'frame', count: 5 });
 *   identify(user.id, { email: user.email });
 *
 * Inicialização: chamado uma vez no `app/layout.tsx` via `<PostHogBootstrap />`.
 */

import posthog from 'posthog-js';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog(): void {
  if (initialized) return;
  if (!KEY || typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'production') return; // só prod
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false, // só eventos explícitos — evita ruído
    person_profiles: 'identified_only',
  });
  initialized = true;
}

/**
 * Eventos canônicos que vale a pena rastrear pra entender uso do produto.
 * Centralizado aqui pra ter um único catálogo (sem nomes inconsistentes
 * espalhados).
 */
export type FluxoEvent =
  | 'project_created'
  | 'project_opened'
  | 'frame_added'
  | 'node_added'
  | 'template_applied'
  | 'ai_parse_used'
  | 'export_blip'
  | 'export_visual'
  | 'playback_started'
  | 'playback_finished'
  | 'version_created'
  | 'version_restored'
  | 'command_palette_used'
  | 'organize_layout'
  | 'shared_link_created'
  | 'skill_inserted'
  | 'user_skill_saved'
  | 'user_skill_inserted'
  | 'voice_tone_analyzed'
  | 'voice_tone_accepted'
  | 'voice_tone_rejected';

/**
 * Track um evento. No-op se PostHog não inicializado.
 */
export function track(event: FluxoEvent, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* silencia falhas de analytics */
  }
}

/**
 * Identifica o usuário logado pra associar eventos. Chame após login.
 */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    posthog.identify(userId, traits);
  } catch {
    /* silencia */
  }
}

/**
 * Reset — chamar no logout pra desassociar.
 */
export function resetIdentity(): void {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch {
    /* silencia */
  }
}
