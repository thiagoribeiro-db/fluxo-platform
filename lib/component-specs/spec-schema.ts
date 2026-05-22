/**
 * Schema de "Component Spec" — a fonte ÚNICA de verdade sobre cada componente
 * do Fluxo Platform.
 *
 * Um spec descreve TUDO sobre um componente:
 *  - Identificação (id, displayName, ícone, categoria)
 *  - Como renderizar no canvas (nodeType do React Flow)
 *  - Como a IA deve detectar e gerar (descriptionn, rules, cues, examples)
 *  - Como o builder deterministico deve construir (autoChildren, edgeRules)
 *  - Como o editor de UI (Phase B) deve renderizar formulários (fields metadata)
 *
 * Specs builtins ficam em `lib/component-specs/builtins/*.yaml` (versionados
 * no git, autoritativos). Specs custom serão salvos no DB (Phase B).
 *
 * O `generateAIVocabulary()` em `prompt-generator.ts` lê todos os specs e gera
 * o trecho de system prompt que ensina a IA a usar os componentes.
 */

import type { FluxoNodeType } from '@/lib/types';

// =============================================================================
// SPEC PRINCIPAL
// =============================================================================

export interface ComponentSpec {
  /** ID único do `kind` emitido pela IA. Ex: "bot", "user", "menu", "media". */
  id: string;

  /** Nome humano exibido na UI. Ex: "Mensagem do Bot". */
  displayName: string;

  /** Emoji ou char usado como ícone na UI. */
  icon: string;

  /** Categoria pra agrupar na UI. */
  category:
    | 'messaging'      // bubbles bot/user
    | 'navigation'     // menu, buttons, btn-long, direcionamento
    | 'media'          // imagem, documento, video
    | 'integration'    // api, planilha
    | 'ai'             // iag entrada/reentrada/saida
    | 'structure'      // frame, sep
    | 'auto';          // tracking, excecao (auto-gerados)

  /** Tipo de node correspondente no React Flow. Pode ser ARRAY se um kind mapeia pra múltiplos tipos (ex: media → midia-imagem-bot/user/documento/video/...). */
  nodeType: FluxoNodeType | FluxoNodeType[];

  /**
   * Como esse componente se comporta no fluxo sequencial:
   * - `linear`: bloco normal, conecta do anterior e atualiza o cursor
   * - `parallel`: cria branches (ex: buttons-row) — não atualiza cursor
   * - `leaf`: terminal (ex: direcionamento isolado) — não atualiza cursor
   * - `none`: não participa do fluxo (ex: tracking, excecao são children)
   */
  flowControl: 'linear' | 'parallel' | 'leaf' | 'none';

  /** Descrição rica (markdown ok) — explica o que é e quando usar. */
  description: string;

  /** Regras de uso — bullets que a IA segue ao decidir o que emitir. */
  usageRules?: string[];

  /** Pistas pra IA detectar esse componente no texto. */
  detectionCues?: string[];

  /** Erros comuns que a IA deve EVITAR — bullets em tom de "não faça X". */
  commonMistakes?: string[];

  /** Campos do bloco (semânticos, que a IA preenche). Não inclui metadata derivada. */
  fields?: Record<string, ComponentField>;

  /** Regras de construção pro builder determinístico. */
  builderRules?: BuilderRules;

  /** Exemplos few-shot pra a IA aprender o padrão. */
  examples?: ComponentExample[];

  /** Texto livre de instruções extras pra IA. Concatenado no prompt no final do bloco. */
  aiInstructions?: string;
}

// =============================================================================
// CAMPOS
// =============================================================================

export interface ComponentField {
  /** Tipo do campo. Strings: text livre. Number: numérico. Array/object: complexos. */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';

  /** Item type quando type='array'. */
  itemType?: 'string' | 'number' | 'object';

  /** Se obrigatório. Default false. */
  required?: boolean;

  /** Descrição humana do campo. Usado tanto no prompt quanto no editor UI. */
  description: string;

  /** Dica adicional pra IA (vai pro prompt mas não pra UI). */
  aiHint?: string;

  /** Valor default (usado quando IA não preenche). */
  default?: unknown;

  /** Se false, o campo é interno (não exibido em UI, default usado). */
  visible?: boolean;

  /** Para `type: 'string'`: valores permitidos (vira enum no JSON schema). */
  enum?: string[];

  /** Para `type: 'array'` ou `type: 'object'`: campos do subschema (recursivo). */
  fields?: Record<string, ComponentField>;
}

// =============================================================================
// BUILDER RULES
// =============================================================================

export interface BuilderRules {
  /**
   * Crianças (children) auto-criadas a partir desse bloco.
   * Tipico: bubble-bot gera 1 tracking_exibicao; menu gera 3 trackings;
   * bubble-user gera 1 excecao + adiciona tracking_input no bot anterior.
   */
  autoChildren?: AutoChild[];

  /** Se cria edge animada do `lastFlowId` anterior pro novo bloco. Default: true. */
  edgeFromPrevious?: boolean;

  /** Se atualiza `lastFlowId` (próximo bloco vai conectar daqui). Default: true. */
  updatesLastFlowId?: boolean;

  /**
   * "Side effect" no bloco anterior. Tipico: bubble-user adiciona um
   * tracking_input no bubble-bot/menu anterior.
   */
  sideEffectOnPrevious?: {
    /** Tipos de previous nodes onde o side effect roda. */
    whenPreviousIsKind: string[];
    /** Tipo do node a adicionar como child do previous. */
    addChild: AutoChild;
  };
}

export interface AutoChild {
  /** Tipo de child. Usa `FluxoNodeType`. */
  nodeType: FluxoNodeType;

  /**
   * Template do label/text com placeholders:
   *  - `{{slug(text)}}` → slug do campo `text` do parent
   *  - `{{slug(header)}}` → slug do campo `header` do parent
   *  - `_exibicao`, `_selecao`, `_input`, `_inesperado` (sufixos comuns)
   *
   * Ex: `{{slug(text)}}_exibicao` → `oi_sou_o_assistente_exibicao`
   */
  labelTemplate: string;

  /** Posição relativa ao parent. */
  relativePosition?: { x: number; y: number };

  /** Descrição humana (pra UI mostrar "esse tracking é auto-gerado"). */
  description?: string;
}

// =============================================================================
// EXAMPLES (few-shots)
// =============================================================================

export interface ComponentExample {
  /** Descrição curta do que esse exemplo demonstra. */
  description: string;

  /** Trecho do escopo (texto que a IA vai receber como input). */
  input: string;

  /**
   * Output esperado da IA. Pode ser um bloco único OU array (quando o input
   * gera múltiplos blocos sequenciais).
   */
  output: unknown;

  /** Nota explicativa sobre o exemplo (vai junto no prompt). */
  note?: string;
}

// =============================================================================
// HELPER: validador defensivo (caso YAML venha quebrado)
// =============================================================================
// Delega pro schema Zod em `@/lib/schemas/component-spec` — mais robusto
// e mantém compat de assinatura type-guard.

import { ComponentSpecSchema } from '@/lib/schemas/component-spec';

export function isValidSpec(spec: unknown): spec is ComponentSpec {
  return ComponentSpecSchema.safeParse(spec).success;
}
