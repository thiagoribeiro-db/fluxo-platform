/**
 * Exporter: estado interno (FluxoNodeData) → Flow JSON Meta v7.1.
 *
 * Spec oficial:
 *   https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson
 *
 * Pipeline:
 *  1. Coleta `screens[]`, `flowCategory`, versões do node
 *  2. Constrói routing_model (qual screen pode ir pra qual)
 *  3. Mapeia cada screen pra { id, title, terminal, data?, layout }
 *  4. Mapeia cada component pro shape oficial Meta
 *  5. Retorna objeto pronto pra POST no /flows endpoint da Cloud API
 *
 * Não faz I/O — só transformação pura. É testável.
 */

import type {
  FluxoNode,
  WhatsAppFlowAction,
  WhatsAppFlowCategory,
  WhatsAppFlowComponent,
  WhatsAppFlowScreen,
} from '@/lib/types';
import {
  FLOW_DATA_API_VERSION,
  FLOW_JSON_VERSION,
} from './constants';

/** Shape do Flow JSON oficial (parcial — só os campos que geramos). */
export interface FlowJson {
  version: string;
  data_api_version?: string;
  /**
   * URL do endpoint que recebe `data_exchange`. Quando ausente, Flow é
   * "client-only" (só `navigate` e `complete` funcionam).
   */
  data_channel_uri?: string;
  routing_model: Record<string, string[]>;
  screens: FlowJsonScreen[];
  /** Metadado nosso (não-oficial Meta) — útil pra rastreio interno. */
  _meta?: {
    flow_name: string;
    flow_category: WhatsAppFlowCategory;
    generated_at: string;
    generator: 'fluxo-platform';
  };
}

export interface FlowJsonScreen {
  id: string;
  title: string;
  terminal?: boolean;
  layout: {
    type: 'SingleColumnLayout';
    children: FlowJsonComponent[];
  };
}

export type FlowJsonComponent = Record<string, unknown>;

/** Constrói o Flow JSON a partir do node. */
export function buildFlowJson(nodeData: FluxoNode['data']): FlowJson {
  const screens = (nodeData.screens as WhatsAppFlowScreen[] | undefined) ?? [];
  const flowName = (nodeData.flowName as string | undefined) ?? 'Flow';
  const flowCategory =
    (nodeData.flowCategory as WhatsAppFlowCategory | undefined) ?? 'OTHER';
  const version = (nodeData.flowJsonVersion as string | undefined) ?? FLOW_JSON_VERSION;
  const dataApiVersion =
    (nodeData.dataApiVersion as string | undefined) ?? FLOW_DATA_API_VERSION;
  const dataChannelUri = (nodeData.dataChannelUri as string | undefined)?.trim();

  const routing_model = buildRoutingModel(screens);

  return {
    version,
    data_api_version: dataApiVersion,
    ...(dataChannelUri && { data_channel_uri: dataChannelUri }),
    routing_model,
    screens: screens.map((s) => mapScreen(s)),
    _meta: {
      flow_name: flowName,
      flow_category: flowCategory,
      generated_at: new Date().toISOString(),
      generator: 'fluxo-platform',
    },
  };
}

// ============================================================================
// Routing model — mapa screenId → [nextScreenIds]
// ============================================================================

function buildRoutingModel(
  screens: WhatsAppFlowScreen[]
): Record<string, string[]> {
  const model: Record<string, string[]> = {};
  for (const s of screens) {
    const targets = new Set<string>();
    for (const c of s.components) {
      const action = getAction(c);
      if (action?.name === 'navigate') {
        targets.add(action.next.name);
      }
    }
    model[s.id] = Array.from(targets);
  }
  return model;
}

// ============================================================================
// Screen mapping
// ============================================================================

function mapScreen(s: WhatsAppFlowScreen): FlowJsonScreen {
  return {
    id: s.id,
    title: s.title,
    terminal: s.isTerminal ?? undefined,
    layout: {
      type: 'SingleColumnLayout',
      children: s.components.map((c) => mapComponent(c)),
    },
  };
}

// ============================================================================
// Component mapping — discriminated switch pra cada tipo
// ============================================================================

function mapComponent(c: WhatsAppFlowComponent): FlowJsonComponent {
  switch (c.type) {
    case 'TextHeading':
    case 'TextSubheading':
    case 'TextBody':
    case 'TextCaption':
      return { type: c.type, text: c.text };

    case 'Image':
      return {
        type: 'Image',
        src: c.src,
        ...(c.alt && { 'alt-text': c.alt }),
        ...(c.width && { width: c.width }),
        ...(c.height && { height: c.height }),
        ...(c.scaleType && { 'scale-type': c.scaleType }),
      };

    case 'EmbeddedLink':
      return {
        type: 'EmbeddedLink',
        text: c.text,
        'on-click-action': mapAction(c.onClickAction),
      };

    case 'TextInput':
      return {
        type: 'TextInput',
        name: c.name,
        label: c.label,
        ...(c.inputType && { 'input-type': c.inputType }),
        ...(c.required !== undefined && { required: c.required }),
        ...(c.helperText && { 'helper-text': c.helperText }),
        ...(c.minChars !== undefined && { 'min-chars': c.minChars }),
        ...(c.maxChars !== undefined && { 'max-chars': c.maxChars }),
        ...(c.initValue !== undefined && { 'init-value': c.initValue }),
      };

    case 'TextArea':
      return {
        type: 'TextArea',
        name: c.name,
        label: c.label,
        ...(c.required !== undefined && { required: c.required }),
        ...(c.helperText && { 'helper-text': c.helperText }),
        ...(c.maxLength !== undefined && { 'max-length': c.maxLength }),
        ...(c.initValue !== undefined && { 'init-value': c.initValue }),
      };

    case 'RadioButtonsGroup':
      return {
        type: 'RadioButtonsGroup',
        name: c.name,
        label: c.label,
        'data-source': c.dataSource.map((opt) => ({
          id: opt.id,
          title: opt.title,
          ...(opt.description && { description: opt.description }),
        })),
        ...(c.required !== undefined && { required: c.required }),
        ...(c.initValue !== undefined && { 'init-value': c.initValue }),
      };

    case 'CheckboxGroup':
      return {
        type: 'CheckboxGroup',
        name: c.name,
        label: c.label,
        'data-source': c.dataSource.map((opt) => ({
          id: opt.id,
          title: opt.title,
          ...(opt.description && { description: opt.description }),
        })),
        ...(c.required !== undefined && { required: c.required }),
        ...(c.minSelectedItems !== undefined && {
          'min-selected-items': c.minSelectedItems,
        }),
        ...(c.maxSelectedItems !== undefined && {
          'max-selected-items': c.maxSelectedItems,
        }),
        ...(c.initValue && { 'init-value': c.initValue }),
      };

    case 'Dropdown':
      return {
        type: 'Dropdown',
        name: c.name,
        label: c.label,
        'data-source': c.dataSource.map((opt) => ({
          id: opt.id,
          title: opt.title,
        })),
        ...(c.required !== undefined && { required: c.required }),
        ...(c.initValue !== undefined && { 'init-value': c.initValue }),
      };

    case 'DatePicker':
      return {
        type: 'DatePicker',
        name: c.name,
        label: c.label,
        ...(c.required !== undefined && { required: c.required }),
        ...(c.minDate && { 'min-date': c.minDate }),
        ...(c.maxDate && { 'max-date': c.maxDate }),
        ...(c.helperText && { 'helper-text': c.helperText }),
        ...(c.initValue && { 'init-value': c.initValue }),
      };

    case 'OptIn':
      return {
        type: 'OptIn',
        name: c.name,
        label: c.label,
        ...(c.required !== undefined && { required: c.required }),
        ...(c.onClickAction && {
          'on-click-action': mapAction(c.onClickAction),
        }),
      };

    case 'Footer':
      return {
        type: 'Footer',
        label: c.label,
        ...(c.leftCaption && { 'left-caption': c.leftCaption }),
        ...(c.centerCaption && { 'center-caption': c.centerCaption }),
        ...(c.rightCaption && { 'right-caption': c.rightCaption }),
        'on-click-action': mapAction(c.onClickAction),
      };
  }
}

function mapAction(a: WhatsAppFlowAction): FlowJsonComponent {
  if (a.name === 'navigate') {
    return { name: 'navigate', next: { type: 'screen', name: a.next.name } };
  }
  if (a.name === 'data_exchange') {
    return {
      name: 'data_exchange',
      ...(a.payload && { payload: a.payload }),
    };
  }
  return {
    name: 'complete',
    ...(a.payload && { payload: a.payload }),
  };
}

function getAction(c: WhatsAppFlowComponent): WhatsAppFlowAction | undefined {
  if (c.type === 'Footer' || c.type === 'EmbeddedLink') return c.onClickAction;
  if (c.type === 'OptIn') return c.onClickAction;
  return undefined;
}
