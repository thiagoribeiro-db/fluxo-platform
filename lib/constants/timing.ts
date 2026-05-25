/**
 * Constantes de timing — centralizadas pra evitar magic numbers
 * espalhados pelo código.
 *
 * Uso típico:
 *   setTimeout(() => doX(), TIMING.DIALOG_CLOSE);
 *   setTimeout(() => animate(), TIMING.FOCUS_AFTER_RENDER);
 *
 * Manter unidades em milissegundos — é o que setTimeout/animate usam.
 */

export const TIMING = {
  // ---------------------------------------------------------------------------
  // Foco / render
  // ---------------------------------------------------------------------------
  /**
   * Tick mínimo pra esperar o React terminar o render antes de focar/scrollar.
   * Pequeno (~0-50ms) — só pra sair do current event loop tick.
   */
  FOCUS_AFTER_RENDER: 50,

  /**
   * Delay padrão pra "abrir dialog secundário" depois de fechar primário.
   * Evita race condition de eventos de blur/focus entre dialogs.
   */
  DIALOG_CLOSE: 50,

  // ---------------------------------------------------------------------------
  // Feedback visual (toasts, badges)
  // ---------------------------------------------------------------------------
  /** Quanto tempo o overlay "📋 Copiado" fica visível antes de sumir. */
  COPIED_FEEDBACK: 700,

  /** Duração do estado "✓ Copiado" no botão de share. */
  COPY_BUTTON_FEEDBACK: 2000,

  // ---------------------------------------------------------------------------
  // Câmera / viewport
  // ---------------------------------------------------------------------------
  /**
   * Duração da animação de `setCenter` quando o canvas faz jump (Cmd+K,
   * jumpToNode, jumpToFrame).
   */
  CAMERA_PAN_DURATION: 700,

  /**
   * Delay pra esperar o React Flow montar o node novo antes de animar a
   * câmera pra ele. Sem isso, getInternalNode retorna undefined.
   */
  CAMERA_PAN_AFTER_CREATE: 300,

  // ---------------------------------------------------------------------------
  // Tour / onboarding
  // ---------------------------------------------------------------------------
  /**
   * Delay inicial antes do tour começar a aparecer — dá tempo do canvas
   * renderizar e dos elementos referenciados existirem no DOM.
   */
  TOUR_START_DELAY: 1000,

  /** Stagger entre steps animados (cheatsheet, lista de comandos). */
  STAGGER_ITEM: 150,

  // ---------------------------------------------------------------------------
  // Realtime / autosave
  // ---------------------------------------------------------------------------
  /** Debounce do autosave do projectState (ms). */
  AUTOSAVE_DEBOUNCE: 800,

  /** Throttle pra envio de cursor em realtime collab (50ms = 20Hz). */
  CURSOR_THROTTLE: 50,
} as const;

export type TimingKey = keyof typeof TIMING;
