/**
 * Constantes de LAYOUT do editor — dimensões e gaps usados pra:
 *  - Estimar tamanhos de nodes antes do React Flow medi-los (organize
 *    inicial roda ANTES do render, então não tem `getBoundingClientRect`
 *    disponível ainda)
 *  - Posicionar nodes adjacentes (trackings, exceções, btn rows)
 *  - Calcular larguras e alturas mínimas de frames
 *
 * Valores CALIBRADOS a partir do CSS real dos componentes (globals.css)
 * e do padrão visual do snapshot Masterboi 2026-05.
 *
 * REGRA: ao mudar um valor aqui, validar que:
 *  - O organize ainda agrupa direito (frames não se sobrepõem)
 *  - Os bubbles cabem dentro dos frames (max-w-[360px] pra bubble-bot)
 *  - O export PDF/PNG não corta nada
 */

// =============================================================================
// LARGURAS DE NODES (px) — usadas como APPROX quando measured não está pronto
// =============================================================================
export const W = {
  /** Largura "lógica" do bubble-bot pra cálculo (CSS real: max-w-[360px]) */
  BUBBLE_BOT: 380,
  /** Largura "lógica" do bubble-user pra cálculo */
  BUBBLE_USER: 380,
  /** Botão curto (Sim/Não, PE/PB) */
  BTN_SHORT: 120,
  /** Botão longo (single CTA) */
  BTN_LONG: 240,
  /** Menu modal do WhatsApp */
  MENU: 320,
  /** Pílula condicional (varal horizontal) */
  CONDICIONAL: 320,
  /** Pílula atendimento humano (transbordo) */
  ATENDIMENTO_HUMANO: 200,
  /** Card de link externo */
  LINK: 280,
  /** Mídia (imagem/documento/vídeo) */
  MEDIA: 240,
  /** Card de integração API/planilha (NotificationNode) */
  INTEGRACAO: 300,
  /** Card de IAG (reusa NotificationNode) */
  IAG: 300,
  /** Direcionamento (pílula → frame) */
  DIRECIONAMENTO: 240,
  /** Tracking — width "âncora" pra o `translateX(calc(240px - 100%))` do CSS */
  TRACKING: 240,
  /** Exceção (badge curto do USER) */
  EXCECAO: 240,
  /** Frame container default (640 + 16px de margem) */
  FRAME: 540,
} as const;

// =============================================================================
// ALTURAS APROXIMADAS DE NODES (px) — APPROX pra estimar avanço de cursor Y
// =============================================================================
export const H = {
  BUBBLE_BOT: 80,
  BUBBLE_USER: 70,
  BTN_SHORT: 50,
  BTN_LONG: 50,
  MENU: 310,
  CONDICIONAL: 60,
  ATENDIMENTO_HUMANO: 44,
  LINK: 110,
  MEDIA_IMAGEM: 200,
  MEDIA_DOC: 80,
  MEDIA_VIDEO: 200,
  INTEGRACAO: 150,
  IAG: 150,
  DIRECIONAMENTO: 50,
  TRACKING: 50,
  EXCECAO: 50,
  FRAME: 400,
} as const;

// =============================================================================
// GAPS, PADDINGS, OFFSETS
// =============================================================================
export const GAP = {
  /** Gap padrão entre componentes */
  DEFAULT: 24,
  /** Gap pequeno entre cards do organize (mais denso) */
  LAYOUT_VERTICAL: 12,
  /** Margem direita do frame */
  LAYOUT_RIGHT_MARGIN: 16,
  /** Padding topo do frame (cabe o header roxo) */
  LAYOUT_TOP_PADDING: 50,
  /** Padding inferior do frame */
  LAYOUT_BOTTOM_PADDING: 40,
  /** Espaço entre tracking e o bubble pai */
  TRACKING_GAP_X: 16,
  /** Espaço entre bubble-user e exceção (dupla horizontal). Tem que bater
   *  com `EXCECAO_GAP_X` em `lib/components/nodes/helpers.ts` — o organize
   *  usa a constante de lá. Se quiser mudar, atualize OS DOIS. */
  EXCECAO_GAP_X: 8,
  /** Distância horizontal entre colunas no layout em DIAMANTE */
  DIAMOND_COLUMN_SPACING: 420,
} as const;

// =============================================================================
// OFFSETS RELATIVOS
// =============================================================================
export const OFFSET = {
  /** X relativo da exceção (à direita do bubble-user). Aproximado — o organize
   * recalcula dinamicamente baseado em `measuredBox(user).w + EXCECAO_GAP_X`. */
  EXCECAO_REL_X: 240,
  /** Y relativo da exceção (mesma linha do bubble-user) */
  EXCECAO_REL_Y: 0,
  /** X relativo do tracking (à esquerda do parent), em coordenada do node child */
  TRACKING_REL_X: -256,
} as const;
