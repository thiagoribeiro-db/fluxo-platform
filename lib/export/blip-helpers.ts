/**
 * Helpers pra geração do JSON Blip.
 *
 * Funções puras, sem side-effects, testáveis isoladamente.
 */

import type {
  BlipConditionOutput,
  BlipContentAction,
  BlipCustomAction,
  BlipPosition,
  BlipState,
  BlipTag,
} from './blip-types';

// =============================================================================
// UUID (v4 simples sem deps externas)
// =============================================================================

export function uuid(): string {
  // Crypto.randomUUID se disponível (Node 19+, browsers modernos)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: pseudo-random hex v4-compatível
  const hex = (n: number) =>
    Math.floor(Math.random() * 16 ** n)
      .toString(16)
      .padStart(n, '0');
  // formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (y = 8/9/a/b)
  const y = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)];
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${y}${hex(3)}-${hex(12)}`;
}

// =============================================================================
// CONNECTION ID (con_3, con_8, con_13... múltiplos de 5 começando em 3)
// =============================================================================

/**
 * Padrão observado nos JSONs Blip: `$connId` segue uma sequência fixa
 * `con_3, con_8, con_13, con_18, con_23, ...` (incremento de 5).
 * Não é validado pela Blip, mas mantemos o padrão por compatibilidade visual.
 */
export function createConnIdGenerator(): () => string {
  let seq = 3;
  return () => {
    const id = `con_${seq}`;
    seq += 5;
    return id;
  };
}

// =============================================================================
// CONVERSÃO de frame_id (kebab/snake) → address Blip (camelCase)
// =============================================================================

/**
 * `algo-mais` → `algoMais`
 * `cartao-credito` → `cartaoCredito`
 * `comprar_site_app` → `comprarSiteApp`
 * `saudacao` → `saudacao` (single word fica)
 */
export function toBlipAddress(frameId: string): string {
  if (!frameId) return '';
  return frameId
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part, idx) =>
      idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join('');
}

// =============================================================================
// MATCH ENTRE option de menu e label de direcionamento
// =============================================================================

const MATCH_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'um', 'uma',
  'e', 'ou', 'no', 'na', 'em', 'com', 'para', 'por', 'sobre',
]);

/**
 * Heurística pra decidir se uma `option` do menu (ex: "Cartão de crédito")
 * "casa" com o `label` de um direcionamento (ex: "Cartão de crédito Masterboi").
 *
 * Estratégia em camadas:
 *  1. Match exato (case-insensitive)
 *  2. startsWith (label começa com option, ou vice-versa)
 *  3. Overlap de palavras-chave (≥60% das palavras significativas da option)
 *
 * Isso resolve casos comuns:
 *  - "Cartão de crédito" vs "Cartão de crédito Masterboi" → startsWith ✓
 *  - "Comprar no site/app" vs "Comprar no site ou app" → overlap ✓
 *  - "Canal de ética" vs "Canal de ética e conduta" → startsWith ✓
 */
export function optionMatchesLabel(option: string, label: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const o = norm(option);
  const l = norm(label);
  if (!o || !l) return false;
  if (o === l) return true;
  if (l.startsWith(o) || o.startsWith(l)) return true;
  // Overlap de tokens
  const tokens = (s: string) =>
    s
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !MATCH_STOPWORDS.has(w));
  const optTokens = tokens(o);
  const labTokens = new Set(tokens(l));
  if (optTokens.length === 0) return false;
  let overlap = 0;
  for (const t of optTokens) {
    if (labTokens.has(t)) overlap++;
  }
  return overlap / optTokens.length >= 0.6;
}

// =============================================================================
// POSITION — converte coords do Fluxo Platform pro formato Blip "Xpx"
// =============================================================================

/**
 * Coords do Fluxo Platform são números (px no canvas React Flow).
 * Blip usa string `"Xpx"`. Aplico um offset/escala suave pra ficar
 * agrupado no canvas Blip (que parece preferir top:120-1000, left:400-1300).
 *
 * Como cada frame vira UM ARQUIVO separado, normalizamos pro origin do frame
 * (subtraindo a coord do frame node) — assim o welcome cai em ~top:240/left:644
 * igual aos exemplos.
 */
export function toBlipPosition(
  nodePos: { x: number; y: number },
  frameOrigin: { x: number; y: number }
): BlipPosition {
  // Normaliza pra coords RELATIVAS ao frame, depois aplica offset Blip
  const relX = Math.max(0, nodePos.x - frameOrigin.x);
  const relY = Math.max(0, nodePos.y - frameOrigin.y);
  // Offset base: o welcome típico fica em (644, 240) — referência visual
  const left = Math.round(400 + relX * 0.5);
  const top = Math.round(120 + relY * 0.5);
  return { top: `${top}px`, left: `${left}px` };
}

/**
 * Position fixo pra states padrão (onboarding, fallback, error) — replica
 * exatamente os exemplos do cliente.
 */
export const FIXED_POSITIONS = {
  onboarding: { top: '120px', left: '644px' } as BlipPosition,
  fallback: { top: '120px', left: '877px' } as BlipPosition,
  error: { top: '240px', left: '877px' } as BlipPosition,
} as const;

// =============================================================================
// FACTORIES de actions canônicas
// =============================================================================

/**
 * Chat-state composing (efeito "digitando…"). Sempre precede um SendMessage
 * de texto/mídia/web-link/select nos JSONs Blip.
 *
 * `hardcodedId`: quando true, usa UUID `00000000-0000-0000-0000-000000000000`
 * — só nos states `welcome` (primeiro composing) e `error` (id 0002).
 */
export function chatStateAction(hardcodedId?: string): BlipContentAction {
  const id = hardcodedId ?? uuid();
  return {
    action: {
      $id: uuid(),
      $typeOfContent: hardcodedId ? '' : 'chat-state',
      $description: '',
      $inputSchema: { type: 'object', properties: {}, required: [] },
      type: 'SendMessage',
      settings: {
        id,
        type: 'application/vnd.lime.chatstate+json',
        content: { state: 'composing', interval: 1000 },
      },
      $cardContent: {
        document: {
          id,
          type: 'application/vnd.lime.chatstate+json',
          content: { state: 'composing', interval: 1000 },
        },
        editable: true,
        deletable: true,
        position: 'left',
        editing: hardcodedId ? false : undefined,
      },
    },
    $invalid: false,
  };
}

/**
 * SendMessage text/plain — o "tijolo" do bubble-bot.
 */
export function textMessageAction(
  text: string,
  hardcodedId?: string
): BlipContentAction {
  const id = hardcodedId ?? uuid();
  return {
    action: {
      $id: uuid(),
      $typeOfContent: hardcodedId ? '' : 'text',
      $description: '',
      $inputSchema: { type: 'object', properties: {}, required: [] },
      type: 'SendMessage',
      settings: {
        id,
        type: 'text/plain',
        content: text,
        metadata: {},
      },
      $cardContent: {
        document: { id, type: 'text/plain', content: text },
        editable: true,
        deletable: true,
        position: 'left',
        editing: hardcodedId ? false : undefined,
      },
    },
    $invalid: false,
  };
}

/**
 * Input action — captura entrada do usuário no state.
 * `bypass: false` = aguarda. `bypass: true` = passa direto.
 */
export function inputAction(bypass: boolean): BlipContentAction {
  return {
    input: {
      bypass,
      $cardContent: {
        document: {
          id: uuid(),
          type: 'text/plain',
          ...(bypass ? {} : { textContent: 'Entrada do usuário' }),
          content: 'Entrada do usuário',
        },
        editable: false,
        deletable: true,
        position: 'right',
        editing: false,
      },
      $invalid: false,
    },
    $invalid: false,
  };
}

/**
 * SendMessage media-link+json — imagem ou documento.
 */
export function mediaMessageAction(opts: {
  mediaType: string; // ex: "image/jpeg" ou "application/pdf"
  uri: string;
  title?: string;
  text?: string;
  aspectRatio?: string;
}): BlipContentAction {
  const id = uuid();
  const content: Record<string, unknown> = {
    title: opts.title ?? '',
    type: opts.mediaType,
    uri: opts.uri,
  };
  if (opts.text !== undefined) content.text = opts.text;
  if (opts.aspectRatio) content.aspectRatio = opts.aspectRatio;
  return {
    action: {
      $id: uuid(),
      $typeOfContent: opts.mediaType.startsWith('image/') ? 'media' : 'media-document',
      $description: '',
      $inputSchema: { type: 'object', properties: {}, required: [] },
      type: 'SendMessage',
      settings: {
        id,
        type: 'application/vnd.lime.media-link+json',
        content,
        metadata: {},
      },
      $cardContent: {
        document: { id, type: 'application/vnd.lime.media-link+json', content },
        editable: true,
        deletable: true,
        position: 'left',
      },
    },
    $invalid: false,
  };
}

/**
 * SendMessage web-link+json — link card.
 */
export function webLinkMessageAction(opts: {
  uri: string;
  title?: string;
  text?: string;
}): BlipContentAction {
  const id = uuid();
  const content = {
    uri: opts.uri,
    target: 'blank',
    title: opts.title ?? 'Weblink title',
    text: opts.text ?? 'Weblink subtitle',
  };
  return {
    action: {
      $id: uuid(),
      $typeOfContent: 'web-link',
      $description: '',
      $inputSchema: { type: 'object', properties: {}, required: [] },
      type: 'SendMessage',
      settings: {
        id,
        type: 'application/vnd.lime.web-link+json',
        content,
      },
      $cardContent: {
        document: { id, type: 'application/vnd.lime.web-link+json', content },
        editable: true,
        deletable: true,
        position: 'left',
      },
    },
    $invalid: false,
  };
}

/**
 * SendMessage select+json — botões inline (Sim/Não, opções 2-3).
 * Quando `scope: "immediate"`, é o `select-immediate`.
 */
export function selectImmediateAction(opts: {
  text: string;
  options: string[];
}): { action: BlipContentAction; contentId: string } {
  const contentId = uuid();
  const optionList = opts.options.map((label, index) => ({
    text: label,
    previewText: label,
    value: null,
    index,
    type: null,
  }));
  const content = {
    text: opts.text,
    scope: 'immediate',
    options: optionList,
    quikReply: false, // typo do Blip — não mudar
  };
  const action: BlipContentAction = {
    action: {
      $id: uuid(),
      $typeOfContent: 'select-immediate',
      $description: '',
      $inputSchema: { type: 'object', properties: {}, required: [] },
      type: 'SendMessage',
      settings: {
        id: contentId,
        type: 'application/vnd.lime.select+json',
        content,
        metadata: {},
      },
      $cardContent: {
        document: { id: contentId, type: 'application/vnd.lime.select+json', content },
        editable: true,
        deletable: true,
        position: 'left',
      },
    },
    $invalid: false,
  };
  return { action, contentId };
}

/**
 * SendRawMessage — usado pra menu lista WhatsApp (consome `{{objMenu@type}}` / `{{objMenu@content}}`).
 */
export function sendRawMessageAction(): BlipContentAction {
  return {
    action: {
      $id: uuid(),
      $typeOfContent: 'raw-content',
      $description: '',
      $inputSchema: { type: 'object', properties: {}, required: [] },
      type: 'SendRawMessage',
      settings: {
        metadata: {},
        type: '{{objMenu@type}}',
        rawContent: '{{objMenu@content}}',
      },
    },
    $invalid: false,
  };
}

// =============================================================================
// CUSTOM ACTIONS
// =============================================================================

/**
 * TrackEvent — evento de rastreio (exibicao, selecao, input, inesperado).
 */
export function trackEventAction(opts: {
  category: string;
  action: string;
  title?: string;
}): BlipCustomAction {
  return {
    $id: uuid(),
    $typeOfContent: '',
    $description: '',
    $inputSchema: { type: 'object', properties: {}, required: [] },
    type: 'TrackEvent',
    $title: opts.title ?? opts.category,
    $invalid: false,
    settings: {
      extras: {},
      category: opts.category,
      action: opts.action,
    },
    conditions: [],
  };
}

/**
 * Redirect — redireciona pra outro bot (frame).
 */
export function redirectAction(opts: {
  contextValue: string;
  address: string;
}): BlipCustomAction {
  return {
    $id: uuid(),
    $typeOfContent: '',
    $description: '',
    $inputSchema: { type: 'object', properties: {}, required: [] },
    type: 'Redirect',
    $title: 'Redirecionar a um serviço',
    $invalid: false,
    settings: {
      context: { type: 'text/plain', value: opts.contextValue },
      address: opts.address,
    },
    conditions: [],
  };
}

/**
 * ExecuteScript — bloco de JavaScript inline.
 */
export function executeScriptAction(opts: {
  title: string;
  source: string;
  inputVariables?: string[];
  outputVariable: string;
}): BlipCustomAction {
  return {
    $id: uuid(),
    $typeOfContent: '',
    type: 'ExecuteScript',
    $title: opts.title,
    $invalid: false,
    settings: {
      function: 'run',
      source: opts.source,
      inputVariables: opts.inputVariables ?? [],
      outputVariable: opts.outputVariable,
      LocalTimeZoneEnabled: false,
    },
    conditions: [],
  };
}

/**
 * SetVariable — atribui valor a uma variável de contexto.
 */
export function setVariableAction(opts: {
  title: string;
  variable: string;
  value: string;
  expiration?: number | null;
  conditions?: BlipCustomAction['conditions'];
}): BlipCustomAction {
  return {
    $id: uuid(),
    $typeOfContent: '',
    $description: '',
    $inputSchema: { type: 'object', properties: {}, required: [] },
    type: 'SetVariable',
    $title: opts.title,
    $invalid: false,
    settings: {
      variable: opts.variable,
      value: opts.value,
      ...(opts.expiration !== undefined ? { expiration: opts.expiration } : {}),
    },
    conditions: opts.conditions ?? [],
  };
}

// =============================================================================
// CONDITION OUTPUTS
// =============================================================================

/**
 * ConditionOutput "exists" (qualquer input).
 */
export function existsOutput(
  stateId: string,
  connId: string,
  contentId?: string
): BlipConditionOutput {
  return {
    stateId,
    typeOfStateId: 'state',
    $connId: connId,
    $id: uuid(),
    ...(contentId ? { $contentId: contentId } : {}),
    conditions: [{ source: 'input', comparison: 'exists', values: [] }],
    $invalid: false,
  };
}

/**
 * ConditionOutput "equals X" — pra botões/menu.
 */
export function equalsOutput(
  stateId: string,
  connId: string,
  value: string,
  contentId?: string
): BlipConditionOutput {
  return {
    stateId,
    typeOfStateId: 'state',
    $connId: connId,
    $id: uuid(),
    ...(contentId ? { $contentId: contentId } : {}),
    conditions: [{ source: 'input', comparison: 'equals', values: [value] }],
    $invalid: false,
  };
}

/**
 * ConditionOutput "matches .*" — captura qualquer coisa, usado em fallback/onboarding.
 */
export function matchesAllOutput(
  stateId: string,
  connId: string
): BlipConditionOutput {
  return {
    stateId,
    $connId: connId,
    $id: uuid(),
    conditions: [{ source: 'input', comparison: 'matches', values: ['.*'] }],
    $invalid: false,
  };
}

// =============================================================================
// TAGS
// =============================================================================

export function redirectTag(): BlipTag {
  return {
    id: `blip-tag-${uuid()}`,
    label: 'Redirect',
    background: '#1EA1FF',
    canChangeBackground: false,
  };
}

// =============================================================================
// SHELL DE UM STATE (frame de um BlipState vazio)
// =============================================================================

/**
 * Cria um state com defaults razoáveis. Usado como base; o caller preenche
 * os arrays específicos (contentActions, conditionOutputs, etc).
 */
export function createState(opts: {
  id: string;
  title: string;
  position: BlipPosition;
  root?: boolean;
  defaultOutputStateId?: string;
}): BlipState {
  return {
    $contentActions: [],
    $conditionOutputs: [],
    $enteringCustomActions: [],
    $leavingCustomActions: [],
    $inputSuggestions: [],
    $defaultOutput: {
      stateId: opts.defaultOutputStateId ?? 'fallback',
      $invalid: false,
    },
    $localCustomActions: [],
    isAiGenerated: false,
    $tags: [],
    id: opts.id,
    ...(opts.root ? { root: true } : {}),
    $title: opts.title,
    $position: opts.position,
    $invalidContentActions: false,
    $invalidOutputs: false,
    $invalidCustomActions: false,
    $invalid: false,
  };
}

/**
 * globalActions — estrutura padrão presente em todo flow (geralmente vazia).
 */
export function createGlobalActions(): BlipState {
  return {
    $contentActions: [],
    $conditionOutputs: [],
    $enteringCustomActions: [],
    $leavingCustomActions: [],
    $inputSuggestions: [],
    $defaultOutput: { stateId: 'fallback', $invalid: false },
    $localCustomActions: [],
    isAiGenerated: false,
    $tags: [],
    id: 'global-actions',
    $title: '',
    $position: { top: '0px', left: '0px' },
    $invalidContentActions: false,
    $invalidOutputs: false,
    $invalidCustomActions: false,
    $invalid: false,
  };
}
