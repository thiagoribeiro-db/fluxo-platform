/**
 * Constantes pro sub-projeto WhatsApp Flows.
 *
 * Centraliza:
 *  - categorias Meta com labels PT
 *  - limites do Flow JSON (Meta v7.1, maio 2026)
 *  - factories de screens/components default
 *
 * Mantenha alinhado com a spec oficial:
 *   https://developers.facebook.com/docs/whatsapp/flows/reference
 */

import type {
  WhatsAppFlowCategory,
  WhatsAppFlowScreen,
} from '@/lib/types';

/** Versão default do Flow JSON spec gerado pelo exporter. */
export const FLOW_JSON_VERSION = '7.1';

/** Versão default da Data API (data_api_version). */
export const FLOW_DATA_API_VERSION = '3.0';

/** Limites oficiais Meta (Flow JSON v7.1). */
export const FLOW_LIMITS = {
  /** Máximo de screens por Flow. */
  maxScreens: 10,
  /** Título da screen — até 80 chars. */
  screenTitle: 80,
  /** Trigger label — texto do botão que abre o Flow. */
  triggerLabel: 20,
  /** Flow name interno (não exposto ao usuário). */
  flowName: 50,
};

/** Categorias oficiais Meta com labels PT pra exibir na UI. */
export const FLOW_CATEGORIES: ReadonlyArray<{
  value: WhatsAppFlowCategory;
  label: string;
  description: string;
}> = [
  {
    value: 'SIGN_UP',
    label: 'Cadastro',
    description: 'Criar conta / cadastrar dados pessoais',
  },
  {
    value: 'SIGN_IN',
    label: 'Login',
    description: 'Entrar em conta existente',
  },
  {
    value: 'APPOINTMENT_BOOKING',
    label: 'Agendamento',
    description: 'Marcar horário/consulta/visita',
  },
  {
    value: 'LEAD_GENERATION',
    label: 'Captura de lead',
    description: 'Coletar informações pra contato comercial',
  },
  {
    value: 'CONTACT_US',
    label: 'Fale conosco',
    description: 'Canal de contato com a empresa',
  },
  {
    value: 'CUSTOMER_SUPPORT',
    label: 'Suporte',
    description: 'Atendimento técnico ou pós-venda',
  },
  {
    value: 'SURVEY',
    label: 'Pesquisa',
    description: 'Formulário NPS, feedback, opinião',
  },
  {
    value: 'SHOPPING',
    label: 'Compra',
    description: 'Fluxo de seleção/checkout de produtos',
  },
  {
    value: 'OTHER',
    label: 'Outro',
    description: 'Use quando nenhuma categoria acima encaixar',
  },
];

/** Cria uma screen vazia pronta pra preencher. */
export function createBlankScreen(opts?: {
  title?: string;
  isEntry?: boolean;
}): WhatsAppFlowScreen {
  // Pseudo-random id estável (não precisa de nanoid aqui — escopo local)
  const id = `screen_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title: opts?.title ?? 'Nova tela',
    components: [],
    isEntry: opts?.isEntry,
  };
}
