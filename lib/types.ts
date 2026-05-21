// =============================================================================
// FLUXO PLATFORM — Type definitions
// =============================================================================

import type { Node, Edge, Viewport } from '@xyflow/react';

// ============== DOMAIN ENTITIES (matches Supabase tables) ==============

export type MemberRole = 'admin' | 'editor' | 'viewer';
export type ProjectVisibility = 'private' | 'org' | 'public';
export type SharePermission = 'view' | 'comment' | 'edit';

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
  // Mídias (3 tipos × 2 senders)
  | 'midia-imagem-bot'
  | 'midia-imagem-user'
  | 'midia-documento-bot'
  | 'midia-documento-user'
  | 'midia-video-bot'
  | 'midia-video-user';

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

  // MediaNode (imagem, documento, vídeo)
  sender?: 'bot' | 'user';
  mediaKind?: 'imagem' | 'documento' | 'video';
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
}

export type FluxoNode = Node<FluxoNodeData, FluxoNodeType>;

// ============== UI STATE ==============

export interface EditorState {
  selectedNodeIds: string[];
  isPanelOpen: boolean;
  zoom: number;
}
