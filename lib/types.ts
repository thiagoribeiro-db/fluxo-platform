// =============================================================================
// FLUXO PLATFORM — Type definitions
// =============================================================================

import type { Node, Edge, Viewport } from '@xyflow/react';

// ============== DOMAIN ENTITIES (matches Supabase tables) ==============

export type MemberRole = 'admin' | 'editor' | 'viewer';
export type ProjectVisibility = 'private' | 'org' | 'public';
export type SharePermission = 'view' | 'comment' | 'edit';

/**
 * Ciclo de vida do projeto:
 *  - draft: em construção (default)
 *  - review: enviado pro cliente revisar
 *  - approved: cliente aprovou, pronto pra deploy
 *  - archived: concluído ou parado
 */
export type ProjectStatus = 'draft' | 'review' | 'approved' | 'archived';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Membership {
  id: string;
  user_id: string;
  organization_id: string;
  role: MemberRole;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string;
  visibility: ProjectVisibility;
  state: ProjectState;
  thumbnail_url: string | null;
  active_page_id: string | null;
  status: ProjectStatus;
  /** Horas estimadas pra entregar o projeto. NULL = não orçado. */
  estimated_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectPage {
  id: string;
  project_id: string;
  name: string;
  state: ProjectState;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectState {
  nodes: FluxoNode[];
  edges: Edge[];
  viewport: Viewport;
}

export interface Comment {
  id: string;
  project_id: string;
  node_id: string | null;
  position_x: number | null;
  position_y: number | null;
  parent_id: string | null;
  body: string;
  author_id: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============== FLUXO NODE TYPES (custom React Flow nodes) ==============

export type FluxoNodeType =
  | 'frame'              // Container/agrupador (header roxo + body)
  | 'entry-point'        // Marcador de "início" do fluxo dentro de um frame
  | 'block'              // Bloco completo (trackings + bubbles + right)
  | 'bubble-bot'         // BOT bubble (recebida)
  | 'bubble-user'        // USER bubble (enviada)
  | 'btn-short'          // Botão curto
  | 'btn-long'           // Botão longo
  | 'menu'               // Menu modal completo
  | 'tracking'           // Tracking tag
  | 'excecao'            // Exceção badge
  | 'direcionamento'     // Direcionamento (verde, clicável)
  | 'condicional'        // Decisão if/else (varal horizontal com 2 saídas)
  | 'atendimento-humano' // Transbordo: bot → humano (terminal do fluxo automático)
  | 'link'               // Referência a URL externa (card de link)
  | 'sep'                // Separador (varal tracejado)
  // Integrações
  | 'integracao-api'
  | 'integracao-planilha'
  // IA Generativa
  | 'iag-entrada'
  | 'iag-reentrada'
  | 'iag-saida'
  // Mídias (4 tipos × 2 senders)
  | 'midia-imagem-bot'
  | 'midia-imagem-user'
  | 'midia-documento-bot'
  | 'midia-documento-user'
  | 'midia-video-bot'
  | 'midia-video-user'
  | 'midia-audio-bot'
  | 'midia-audio-user'
  // WhatsApp Flow (mini-app multi-screen dentro do WhatsApp)
  | 'whatsapp-flow';

export interface FluxoNodeData extends Record<string, unknown> {
  // Comuns
  label?: string;
  code?: string;            // ID auto-gerado, ex: "B001", "U002", "M001"

  // bubble-bot, bubble-user
  text?: string;
  time?: string;

  // btn-short, btn-long
  buttonText?: string;
  variant?: 'default' | 'numbered';

  // menu (novo formato — usado pelos nodes atuais)
  header?: string;
  options?: string[];          // labels das opções
  footer?: string;             // texto do botão final, ex. "Enviar"

  // menu (formato antigo — mantido p/ compat.)
  menuTitle?: string;
  menuOptions?: Array<{ id: string; text: string; selected?: boolean }>;

  // tracking
  trackingText?: string;
  trackingSub?: string;

  // excecao
  excecaoTitle?: string;
  excecaoSub?: string;

  // direcionamento
  targetFrameId?: string;      // (legado/anchor) frameId humano do destino
  targetNodeId?: string;       // (preferido) node.id ESTÁVEL do frame destino — não muda em rename/reorganize
  clickable?: boolean;
  destination?: string;        // (compat.) ID de outro node/frame
  destinationLabel?: string;
  external?: boolean;          // (compat.) se aponta pra outro card

  // block (composto)
  blockId?: string;            // ex: "S.0.0.4"
  blockTitle?: string;
  trackings?: Array<{ kind: 'exibicao' | 'selecao' | 'inesperado'; sub?: string }>;

  // frame (container)
  title?: string;              // título exibido no header
  frameId?: string;            // id de navegação (anchor)
  prefix?: string;             // prefixo dos códigos dos blocos contidos (ex: "S", "O", "T", "E")
  width?: number;
  height?: number;
  locked?: boolean;            // se true: não pode mover/redimensionar/deletar
  frameName?: string;          // (compat.)
  frameCode?: string;          // (compat.)
  frameIcon?: string;
  frameColor?: string;

  // NotificationNode (integrações, IAG)
  headerColor?: string;        // cor do header (hex)
  headerIcon?: string;         // emoji ou char do ícone do header
  fields?: Array<{ label: string; key: string; value: string }>;

  // MediaNode (imagem, documento, vídeo, áudio)
  sender?: 'bot' | 'user';
  mediaKind?: 'imagem' | 'documento' | 'video' | 'audio';
  caption?: string;            // descrição/legenda
  meta?: string;               // metadata (1 page · 262 KB · pdf)
  filename?: string;           // documento.pdf
  thumbnailUrl?: string;       // URL futura da thumb

  // LinkNode (referência a URL externa)
  url?: string;                // URL alvo do link
  linkTitle?: string;          // título do card (ex: "Documentação Oficial")
  linkDescription?: string;    // descrição curta opcional
  linkDomain?: string;         // domínio extraído pra exibir abaixo do título

  // ConditionalNode (decisão if/else - varal horizontal)
  condition?: string;          // pergunta/condição avaliada (ex: "Cliente é VIP?")
  trueLabel?: string;          // texto da saída TRUE (default "Verdadeiro")
  falseLabel?: string;         // texto da saída FALSE (default "Falso")

  // WhatsAppFlowNode (mini-app multi-screen do WhatsApp)
  flowName?: string;           // nome do Flow (ex: "Agendamento", "Cadastro")
  flowCategory?: WhatsAppFlowCategory;
  screens?: WhatsAppFlowScreen[]; // até 10 screens
  flowJsonVersion?: string;    // versão do Flow JSON spec (default "7.1")
  dataApiVersion?: string;     // versão da Data API (default "3.0")
  triggerLabel?: string;       // texto do botão que abre o Flow (max 20 chars)
  /**
   * URL do endpoint do cliente pra `data_exchange` (config opcional no
   * Flow JSON: `data_channel_uri`). Quando preenchido, actions
   * `data_exchange` POSTAM dados pra essa URL e usam a resposta pra
   * decidir próxima screen. Sem isso, Flow só suporta `navigate` e
   * `complete` (modo "client-only").
   */
  dataChannelUri?: string;
  /**
   * Timestamp ISO da última edição do Flow (sub-editor). Usado pra:
   *  - Badge "atualizado há X" no node
   *  - Pulse visual de "novidade" no canvas
   *  - Dot indicator "não visto" comparando contra lastSeen no localStorage
   */
  flowUpdatedAt?: string;
}

/**
 * Categorias oficiais Meta pro Flow JSON (campo `categories` do Flow).
 * Exigido na publicação — define o "intent" do Flow.
 */
export type WhatsAppFlowCategory =
  | 'SIGN_UP'
  | 'SIGN_IN'
  | 'APPOINTMENT_BOOKING'
  | 'LEAD_GENERATION'
  | 'CONTACT_US'
  | 'CUSTOMER_SUPPORT'
  | 'SURVEY'
  | 'SHOPPING'
  | 'OTHER';

/**
 * Tela individual de um WhatsApp Flow. Cada Flow tem 1..10 screens
 * empilhadas com navegação via Footer.action.
 *
 * Componentes ficam num array; tipos específicos definidos em #207/#208.
 * Por enquanto o `components` aceita qualquer shape — vai ser refinado
 * com discriminated union nas próximas tasks.
 */
export interface WhatsAppFlowScreen {
  /** ID estável da screen (usado em routing). Auto-gerado, ex: "screen_a1b2". */
  id: string;
  /** Título exibido no topo da screen (até 80 chars). */
  title: string;
  /** Componentes empilhados verticalmente (TextHeading, TextInput, etc). */
  components: WhatsAppFlowComponent[];
  /** Se true, é a screen inicial (entry point do Flow). Exatamente 1 por Flow. */
  isEntry?: boolean;
  /** Se true, é screen terminal (action = complete). Pode ter mais de 1. */
  isTerminal?: boolean;
}

/**
 * Action executada quando um Footer/EmbeddedLink/OptIn é tocado.
 * Mapeia 1:1 pro Flow JSON spec (Meta v7.1).
 *
 *  - navigate:     pula pra próxima screen (refere-se por id)
 *  - data_exchange: envia dados ao backend; resposta define próxima screen
 *  - complete:     encerra o Flow, retornando dados ao chat
 */
export type WhatsAppFlowAction =
  | { name: 'navigate'; next: { name: string } } // next.name = screen id
  | { name: 'data_exchange'; payload?: Record<string, unknown> }
  | { name: 'complete'; payload?: Record<string, unknown> };

/**
 * Item de uma lista de seleção (RadioButtonsGroup, CheckboxGroup, Dropdown).
 * Mapeia pro `data-source` do Flow JSON.
 */
export interface WhatsAppFlowChoice {
  id: string;
  title: string;
  description?: string;
}

/**
 * Discriminated union dos componentes de uma screen do Flow.
 *
 * Cada variant corresponde 1:1 ao schema do Flow JSON (Meta v7.1):
 *   https://developers.facebook.com/docs/whatsapp/flows/reference/components
 *
 * O campo `id` é estável e usado pra ordenar/referenciar no editor; ele NÃO
 * vai pro export final (o Flow JSON usa `name` como ID interno).
 */
export type WhatsAppFlowComponent =
  // ---- Texto (não-interativos) ----------------------------------------
  | { id: string; type: 'TextHeading'; text: string }
  | { id: string; type: 'TextSubheading'; text: string }
  | { id: string; type: 'TextBody'; text: string }
  | { id: string; type: 'TextCaption'; text: string }
  // ---- Visual ---------------------------------------------------------
  | {
      id: string;
      type: 'Image';
      src: string;              // URL ou base64
      alt?: string;
      width?: number;
      height?: number;
      scaleType?: 'contain' | 'cover';
    }
  | {
      id: string;
      type: 'EmbeddedLink';
      text: string;
      onClickAction: WhatsAppFlowAction;
    }
  // ---- Input simples --------------------------------------------------
  | {
      id: string;
      type: 'TextInput';
      name: string;             // identificador no payload final
      label: string;
      inputType?:
        | 'text'
        | 'number'
        | 'email'
        | 'password'
        | 'passcode'
        | 'phone';
      required?: boolean;
      helperText?: string;
      minChars?: number;
      maxChars?: number;
      initValue?: string;
    }
  | {
      id: string;
      type: 'TextArea';
      name: string;
      label: string;
      required?: boolean;
      helperText?: string;
      maxLength?: number;
      initValue?: string;
    }
  // ---- Input com opções ------------------------------------------------
  | {
      id: string;
      type: 'RadioButtonsGroup';
      name: string;
      label: string;
      dataSource: WhatsAppFlowChoice[];
      required?: boolean;
      initValue?: string;
    }
  | {
      id: string;
      type: 'CheckboxGroup';
      name: string;
      label: string;
      dataSource: WhatsAppFlowChoice[];
      required?: boolean;
      minSelectedItems?: number;
      maxSelectedItems?: number;
      initValue?: string[];
    }
  | {
      id: string;
      type: 'Dropdown';
      name: string;
      label: string;
      dataSource: WhatsAppFlowChoice[];
      required?: boolean;
      initValue?: string;
    }
  | {
      id: string;
      type: 'DatePicker';
      name: string;
      label: string;
      required?: boolean;
      minDate?: string;         // YYYY-MM-DD
      maxDate?: string;
      helperText?: string;
      initValue?: string;
    }
  | {
      id: string;
      type: 'OptIn';
      name: string;
      label: string;
      required?: boolean;
      onClickAction?: WhatsAppFlowAction;
    }
  // ---- Footer (action obrigatória; encerra/navega/data-exchange) ------
  | {
      id: string;
      type: 'Footer';
      label: string;            // texto do botão (até 35 chars)
      leftCaption?: string;
      centerCaption?: string;
      rightCaption?: string;
      onClickAction: WhatsAppFlowAction;
    };

/** Helper: discrimina pelo `type` (gera autocomplete melhor que `is`). */
export type WhatsAppFlowComponentType = WhatsAppFlowComponent['type'];

export type FluxoNode = Node<FluxoNodeData, FluxoNodeType>;

// ============== UI STATE ==============

export interface EditorState {
  selectedNodeIds: string[];
  isPanelOpen: boolean;
  zoom: number;
}
