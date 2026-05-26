/**
 * Catálogo + factories dos componentes do WhatsApp Flow.
 *
 * Cada entrada do `FLOW_COMPONENT_CATALOG` define:
 *  - metadata pra UI (label PT, ícone, categoria)
 *  - factory que cria uma instância com defaults sensíveis
 *  - limites Meta (chars, etc) pra validação no inspector
 *
 * Mantém alinhado com Flow JSON v7.1:
 *   https://developers.facebook.com/docs/whatsapp/flows/reference/components
 */

import type {
  WhatsAppFlowComponent,
  WhatsAppFlowComponentType,
} from '@/lib/types';

/** Limites de chars por componente (Meta Flow JSON v7.1). */
export const FLOW_COMPONENT_LIMITS = {
  TextHeading: { text: 80 },
  TextSubheading: { text: 80 },
  TextBody: { text: 4096 },
  TextCaption: { text: 409 },
  TextInput: { label: 50, helperText: 80, maxCharsMax: 80 },
  TextArea: { label: 50, helperText: 80, maxLength: 600 },
  Dropdown: { label: 80, choiceTitle: 30, choiceDescription: 80, maxChoices: 200 },
  RadioButtonsGroup: { label: 80, choiceTitle: 30, choiceDescription: 80, maxChoices: 20 },
  CheckboxGroup: { label: 80, choiceTitle: 30, choiceDescription: 80, maxChoices: 20 },
  DatePicker: { label: 80, helperText: 80 },
  OptIn: { label: 120 },
  Footer: { label: 35, caption: 35 },
  Image: { alt: 100 },
  EmbeddedLink: { text: 35 },
} as const;

/** Categorias da paleta (agrupamento visual). */
export type FlowComponentCategory = 'text' | 'visual' | 'input' | 'control';

export interface FlowComponentCatalogEntry {
  type: WhatsAppFlowComponentType;
  label: string;          // nome PT exibido na paleta
  description: string;    // 1 frase explicativa
  icon: string;           // emoji
  category: FlowComponentCategory;
  /** Cria nova instância com defaults sensíveis. ID precisa ser injetado. */
  factory: (id: string) => WhatsAppFlowComponent;
}

/** Pseudo-id estável local (evita coleção no mesmo render). */
let nextLocalId = 0;
export function genComponentId(type: WhatsAppFlowComponentType): string {
  nextLocalId += 1;
  const rand = Math.random().toString(36).slice(2, 6);
  return `c_${type.toLowerCase().slice(0, 4)}_${rand}_${nextLocalId}`;
}

/** Catálogo COMPLETO — 1 entrada por tipo. */
export const FLOW_COMPONENT_CATALOG: ReadonlyArray<FlowComponentCatalogEntry> = [
  // ---- Texto ------------------------------------------------------------
  {
    type: 'TextHeading',
    label: 'Título',
    description: 'Cabeçalho grande no topo da seção',
    icon: 'H₁',
    category: 'text',
    factory: (id) => ({ id, type: 'TextHeading', text: 'Título' }),
  },
  {
    type: 'TextSubheading',
    label: 'Subtítulo',
    description: 'Cabeçalho médio (h2)',
    icon: 'H₂',
    category: 'text',
    factory: (id) => ({ id, type: 'TextSubheading', text: 'Subtítulo' }),
  },
  {
    type: 'TextBody',
    label: 'Corpo',
    description: 'Parágrafo de texto regular (até 4096 chars)',
    icon: '¶',
    category: 'text',
    factory: (id) => ({
      id,
      type: 'TextBody',
      text: 'Texto do corpo. Use pra explicações longas.',
    }),
  },
  {
    type: 'TextCaption',
    label: 'Legenda',
    description: 'Texto pequeno, geralmente abaixo de imagens (até 409 chars)',
    icon: '·',
    category: 'text',
    factory: (id) => ({ id, type: 'TextCaption', text: 'Legenda explicativa' }),
  },

  // ---- Visual -----------------------------------------------------------
  {
    type: 'Image',
    label: 'Imagem',
    description: 'Imagem em base64 ou URL (até 300KB no Flow JSON)',
    icon: '🖼️',
    category: 'visual',
    factory: (id) => ({
      id,
      type: 'Image',
      src: '',
      alt: 'Imagem',
      scaleType: 'contain',
    }),
  },
  {
    type: 'EmbeddedLink',
    label: 'Link embutido',
    description: 'Texto clicável que executa uma action (max 35 chars)',
    icon: '🔗',
    category: 'visual',
    factory: (id) => ({
      id,
      type: 'EmbeddedLink',
      text: 'Saiba mais',
      onClickAction: { name: 'complete' },
    }),
  },

  // ---- Inputs simples ---------------------------------------------------
  {
    type: 'TextInput',
    label: 'Campo de texto',
    description: 'Input single-line (text/email/phone/password/number)',
    icon: '⌨',
    category: 'input',
    factory: (id) => ({
      id,
      type: 'TextInput',
      name: 'campo_texto',
      label: 'Digite aqui',
      inputType: 'text',
      required: false,
    }),
  },
  {
    type: 'TextArea',
    label: 'Texto longo',
    description: 'Input multi-line (até 600 chars)',
    icon: '☰',
    category: 'input',
    factory: (id) => ({
      id,
      type: 'TextArea',
      name: 'campo_longo',
      label: 'Digite aqui',
      required: false,
      maxLength: 600,
    }),
  },

  // ---- Inputs com opções ------------------------------------------------
  {
    type: 'RadioButtonsGroup',
    label: 'Escolha única',
    description: 'Radio buttons — usuário escolhe 1 opção',
    icon: '◉',
    category: 'input',
    factory: (id) => ({
      id,
      type: 'RadioButtonsGroup',
      name: 'escolha',
      label: 'Selecione uma opção',
      required: true,
      dataSource: [
        { id: 'op_1', title: 'Opção 1' },
        { id: 'op_2', title: 'Opção 2' },
      ],
    }),
  },
  {
    type: 'CheckboxGroup',
    label: 'Múltipla escolha',
    description: 'Checkboxes — usuário marca N opções',
    icon: '☑',
    category: 'input',
    factory: (id) => ({
      id,
      type: 'CheckboxGroup',
      name: 'escolhas',
      label: 'Marque as opções',
      required: false,
      dataSource: [
        { id: 'op_1', title: 'Opção 1' },
        { id: 'op_2', title: 'Opção 2' },
      ],
    }),
  },
  {
    type: 'Dropdown',
    label: 'Dropdown',
    description: 'Lista colapsada — boa pra muitas opções',
    icon: '▾',
    category: 'input',
    factory: (id) => ({
      id,
      type: 'Dropdown',
      name: 'selecao',
      label: 'Selecione',
      required: true,
      dataSource: [
        { id: 'op_1', title: 'Opção 1' },
        { id: 'op_2', title: 'Opção 2' },
        { id: 'op_3', title: 'Opção 3' },
      ],
    }),
  },
  {
    type: 'DatePicker',
    label: 'Data',
    description: 'Seletor de data com min/max',
    icon: '📅',
    category: 'input',
    factory: (id) => ({
      id,
      type: 'DatePicker',
      name: 'data',
      label: 'Escolha a data',
      required: true,
    }),
  },
  {
    type: 'OptIn',
    label: 'Aceite (OptIn)',
    description: 'Checkbox de termos/LGPD com action opcional',
    icon: '✓',
    category: 'input',
    factory: (id) => ({
      id,
      type: 'OptIn',
      name: 'aceite',
      label: 'Concordo com os termos',
      required: true,
    }),
  },

  // ---- Controle (Footer = encerra/navega/data-exchange) -----------------
  {
    type: 'Footer',
    label: 'Footer (botão final)',
    description: 'Botão CTA no rodapé. Define action: Continuar/Enviar/Finalizar.',
    icon: '⏎',
    category: 'control',
    factory: (id) => ({
      id,
      type: 'Footer',
      label: 'Continuar',
      onClickAction: { name: 'complete' },
    }),
  },
];

/** Lookup rápido por tipo. */
export const FLOW_COMPONENT_BY_TYPE: Record<
  WhatsAppFlowComponentType,
  FlowComponentCatalogEntry
> = FLOW_COMPONENT_CATALOG.reduce(
  (acc, entry) => {
    acc[entry.type] = entry;
    return acc;
  },
  {} as Record<WhatsAppFlowComponentType, FlowComponentCatalogEntry>
);

/** Cria um component novo a partir do tipo (gera ID e aplica factory). */
export function createComponent(type: WhatsAppFlowComponentType): WhatsAppFlowComponent {
  const entry = FLOW_COMPONENT_BY_TYPE[type];
  if (!entry) throw new Error(`Tipo de componente desconhecido: ${type}`);
  return entry.factory(genComponentId(type));
}
