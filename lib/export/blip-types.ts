/**
 * Tipos do JSON Blip — refletem EXATAMENTE a estrutura que o cliente
 * exportou em `tmp/json/*.json` (Saudação, Ofertas, etc.).
 *
 * Filosofia: campos são tipados o mínimo necessário pra não engessar
 * mas pegar erros óbvios. `settings` e `$cardContent` ficam `unknown`
 * pq variam muito conforme o tipo da action.
 *
 * Convenções de naming:
 *  - `$<key>`: campo de metadata do editor visual da Blip (com $)
 *  - `<key>`: campo de runtime do bot Blip
 */

export interface BlipPosition {
  top: string; // ex: "120px"
  left: string; // ex: "644px"
}

export interface BlipTag {
  id: string;
  label: string;
  background: string; // hex color
  canChangeBackground: boolean;
}

// =============================================================================
// CONDIÇÕES (usadas em conditionOutputs e em custom actions condicionais)
// =============================================================================

export type BlipConditionSource = 'input' | 'context';
export type BlipConditionComparison =
  | 'equals'
  | 'exists'
  | 'notExists'
  | 'matches'
  | 'notMatches'
  | 'startsWith'
  | 'endsWith'
  | 'contains'
  | 'notContains';

export interface BlipCondition {
  source: BlipConditionSource;
  comparison: BlipConditionComparison;
  values: string[];
  /** Quando `source: "context"`, nome da variável a comparar. */
  variable?: string;
}

// =============================================================================
// CONDITION OUTPUTS — edges entre states
// =============================================================================

export interface BlipConditionOutput {
  stateId: string;
  typeOfStateId?: 'state';
  $connId?: string;
  $id?: string;
  /** Quando referencia um content action específico (ex: select-immediate). */
  $contentId?: string;
  conditions: BlipCondition[];
  $isBuilderDefaultOutput?: boolean;
  $isDeskOutput?: boolean;
  $isDeskDefaultOutput?: boolean;
  $invalid?: boolean;
}

// =============================================================================
// CUSTOM ACTIONS — TrackEvent, ExecuteScript, SetVariable, Redirect, etc.
// =============================================================================

export type BlipCustomActionType =
  | 'TrackEvent'
  | 'ExecuteScript'
  | 'SetVariable'
  | 'Redirect'
  | 'ForwardToDesk'
  | 'LeavingFromDesk'
  | 'ProcessHttp';

export interface BlipCustomAction {
  $id: string;
  $typeOfContent?: string;
  $description?: string;
  $inputSchema?: { type: string; properties: Record<string, unknown>; required: string[] };
  type: BlipCustomActionType;
  $title?: string;
  $invalid?: boolean;
  settings: Record<string, unknown>;
  conditions?: BlipCondition[];
}

// =============================================================================
// CONTENT ACTIONS — SendMessage / SendRawMessage / Input
// =============================================================================

export interface BlipSendMessageAction {
  action: {
    $id: string;
    $typeOfContent?: string;
    $description?: string;
    $inputSchema?: { type: string; properties: Record<string, unknown>; required: string[] };
    type: 'SendMessage' | 'SendRawMessage';
    settings: Record<string, unknown>;
    $cardContent?: Record<string, unknown>;
  };
  $invalid: boolean;
}

export interface BlipInputAction {
  input: {
    bypass: boolean;
    $cardContent: Record<string, unknown>;
    conditions?: BlipCondition[];
    $invalid: boolean;
  };
  $invalid: boolean;
}

export type BlipContentAction = BlipSendMessageAction | BlipInputAction;

// =============================================================================
// STATE
// =============================================================================

export interface BlipState {
  $contentActions: BlipContentAction[];
  $conditionOutputs: BlipConditionOutput[];
  $enteringCustomActions: BlipCustomAction[];
  $leavingCustomActions: BlipCustomAction[];
  $inputSuggestions: string[];
  $defaultOutput: {
    stateId: string;
    $invalid: boolean;
    typeOfStateId?: 'state';
  };
  $localCustomActions: BlipCustomAction[];
  isAiGenerated: boolean;
  $tags: BlipTag[];
  id: string;
  root?: boolean;
  $title: string;
  $position: BlipPosition;
  $invalidContentActions: boolean;
  $invalidOutputs: boolean;
  $invalidCustomActions: boolean;
  $invalid: boolean;
  /** Específico de states `desk:UUID` (atendimento humano). */
  deskStateVersion?: string;
  /** Específico de states `desk:UUID` — ações que rodam após mudança de state. */
  $afterStateChangedActions?: BlipCustomAction[];
}

// =============================================================================
// FLOW (1 arquivo .json)
// =============================================================================

export interface BlipFlow {
  flow: Record<string, BlipState>;
  globalActions: BlipState;
}
