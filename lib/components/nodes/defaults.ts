import type { FluxoNodeData, FluxoNodeType } from '@/lib/types';

/**
 * Defaults de cada tipo de node — usado pela paleta ao criar um novo.
 *
 * Mantenha em sincronia com `lib/components/nodes/index.ts` (registry)
 * e `lib/types.ts:FluxoNodeType`.
 */
export const NODE_DEFAULTS: Record<FluxoNodeType, FluxoNodeData> = {
  // ---- ESTRUTURA -----------------------------------------------------------
  // Largura/altura padrão calibradas a partir do output ideal do usuário:
  //  - 656px wide cobre a maioria dos frames lineares (bot/menu/mídia/dir)
  //  - 300px altura inicial; cresce conforme o usuário adiciona blocos
  frame: {
    title: 'Novo frame',
    frameId: 'frame-novo',
    width: 656,
    height: 300,
  },

  // Marcador de "início" — coloque um por frame, conectado ao primeiro main
  'entry-point': {
    label: 'Início',
  },

  // ---- MENSAGENS -----------------------------------------------------------
  'bubble-bot': { text: 'Olá! Texto da mensagem BOT.', time: '9.41 AM' },
  'bubble-user': { text: 'Resposta do usuário', time: '9.41 AM' },
  'btn-short': { label: 'Opção' },
  'btn-long': { label: 'Botão longo descritivo' },
  menu: {
    header: 'Selecione uma opção',
    options: ['Opção 1', 'Opção 2', 'Opção 3'],
    footer: 'Enviar',
  },

  // ---- EVENTOS -------------------------------------------------------------
  tracking: { label: 'tracking_evento' },
  excecao: { label: 'Exceção / Fallback' },
  direcionamento: {
    label: 'Ir para frame...',
    targetFrameId: '',
    clickable: false,
  },

  // ---- LINK EXTERNO --------------------------------------------------------
  link: {
    sender: 'bot',
    url: 'https://exemplo.com',
    linkTitle: 'Acessar link',
    linkDescription: '',
  },

  // ---- CONDICIONAL (decisão if/else - varal) -------------------------------
  condicional: {
    condition: 'Condição?',
    trueLabel: 'Verdadeiro',
    falseLabel: 'Falso',
    width: 320,
    height: 44,
  },

  // ---- ATENDIMENTO HUMANO (transbordo terminal) ----------------------------
  'atendimento-humano': {
    label: 'Atendimento humano',
  },

  // ---- INTEGRAÇÕES ---------------------------------------------------------
  'integracao-api': {
    title: 'Integração',
    headerColor: '#6F2DBD',
    headerIcon: '💲',
    fields: [
      { key: 'api', label: 'API', value: '{nome_api}' },
      {
        key: 'funcionalidade',
        label: 'Funcionalidade',
        value: 'Validação automática por IA para conferência de campos obrigatórios.',
      },
      { key: 'metodo', label: 'Método', value: '{metodo}' },
      { key: 'endpoint', label: 'Endpoint', value: '{endpoint}' },
      { key: 'link_documentacao', label: 'Link documentação', value: '{link_documentacao}' },
    ],
  },
  'integracao-planilha': {
    title: 'Integração com planilha',
    headerColor: '#0F5132',
    headerIcon: '▦',
    fields: [
      { key: 'nome_planilha', label: 'Nome', value: '{nome_planilha}' },
      { key: 'funcionalidade', label: 'Funcionalidade', value: '{funcionalidade}' },
      { key: 'metodo', label: 'Método', value: '{metodo}' },
      { key: 'link', label: 'Link', value: '{endpoint}' },
    ],
  },

  // ---- IA GENERATIVA -------------------------------------------------------
  'iag-entrada': {
    title: 'Ponto de entrada da IAG',
    headerColor: '#6F2DBD',
    headerIcon: '🤖',
    fields: [{ key: 'skill', label: 'Skill', value: '{nome_skill}' }],
  },
  'iag-reentrada': {
    title: 'Ponto de reentrada da IAG',
    headerColor: '#1E1B4B',
    headerIcon: '↪',
    fields: [
      { key: 'skill', label: 'Skill', value: '{nome_skill}' },
      { key: 'rule', label: 'Regra de reentrada', value: '{rule}' },
    ],
  },
  'iag-saida': {
    title: 'Ponto de saída da IAG',
    headerColor: '#EC4899',
    headerIcon: '↗',
    fields: [
      { key: 'skill', label: 'Skill', value: '{nome_skill}' },
      { key: 'gatilho', label: 'Tipo de gatilho', value: '{regex/middleware}' },
      { key: 'input', label: 'Input de gatilho', value: '{input}' },
    ],
  },

  // ---- MÍDIAS --------------------------------------------------------------
  'midia-imagem-bot': {
    sender: 'bot',
    mediaKind: 'imagem',
    caption: 'Descrição da imagem',
    time: '9.41 AM',
  },
  'midia-imagem-user': {
    sender: 'user',
    mediaKind: 'imagem',
    caption: 'Descrição da imagem',
    time: '9.41 AM',
  },
  'midia-documento-bot': {
    sender: 'bot',
    mediaKind: 'documento',
    filename: 'document.pdf',
    meta: '1 page · 262 KB · pdf',
    time: '9.41',
  },
  'midia-documento-user': {
    sender: 'user',
    mediaKind: 'documento',
    filename: 'document.pdf',
    meta: '1 page · 262 KB · pdf',
    time: '9.41 AM',
  },
  'midia-video-bot': {
    sender: 'bot',
    mediaKind: 'video',
    caption: 'Vídeo enviado pelo bot',
    time: '9.41',
  },
  'midia-video-user': {
    sender: 'user',
    mediaKind: 'video',
    caption: 'Vídeo enviado pelo usuário',
    time: '9.41 AM',
  },

  // ---- LEGADO --------------------------------------------------------------
  block: {},
  sep: {},
};

/**
 * Item da paleta. type === FluxoNodeType.
 */
export interface PaletteItem {
  type: FluxoNodeType;
  label: string;
  icon: string;
  description: string;
}

/**
 * Grupo de itens na paleta — exibido com header colapsável.
 */
export interface PaletteGroup {
  id: string;
  title: string;
  items: PaletteItem[];
}

export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: 'estrutura',
    title: 'Estrutura',
    items: [
      { type: 'frame', label: 'Frame', icon: '📦', description: 'Container nomeado (agrupa nós)' },
      { type: 'entry-point', label: 'Início', icon: '▶', description: 'Marca o início do fluxo dentro do frame' },
    ],
  },
  {
    id: 'mensagens',
    title: 'Mensagens',
    items: [
      { type: 'bubble-bot', label: 'Bubble BOT', icon: '🤖', description: 'Mensagem recebida (BOT)' },
      { type: 'bubble-user', label: 'Bubble USER', icon: '👤', description: 'Mensagem enviada (USER)' },
      { type: 'menu', label: 'Menu', icon: '☰', description: 'Modal com opções + Enviar' },
      { type: 'btn-short', label: 'Botão curto', icon: '🔘', description: 'Aceitar, Recusar, etc.' },
      { type: 'btn-long', label: 'Botão longo', icon: '▭', description: 'Falar com atendente, etc.' },
    ],
  },
  {
    id: 'midias',
    title: 'Mídias',
    items: [
      { type: 'midia-imagem-bot', label: 'Imagem (BOT)', icon: '🖼️', description: 'Imagem enviada pelo bot' },
      { type: 'midia-imagem-user', label: 'Imagem (USER)', icon: '🖼️', description: 'Imagem enviada pelo usuário' },
      { type: 'midia-documento-bot', label: 'Documento (BOT)', icon: '📄', description: 'PDF/doc enviado pelo bot' },
      { type: 'midia-documento-user', label: 'Documento (USER)', icon: '📄', description: 'PDF/doc enviado pelo usuário' },
      { type: 'midia-video-bot', label: 'Vídeo (BOT)', icon: '🎬', description: 'Vídeo enviado pelo bot' },
      { type: 'midia-video-user', label: 'Vídeo (USER)', icon: '🎬', description: 'Vídeo enviado pelo usuário' },
    ],
  },
  {
    id: 'integracoes',
    title: 'Integrações',
    items: [
      { type: 'integracao-api', label: 'Integração API', icon: '🔌', description: 'Chamada a sistema externo' },
      { type: 'integracao-planilha', label: 'Integração Planilha', icon: '▦', description: 'Conexão com planilha' },
    ],
  },
  {
    id: 'iag',
    title: 'IA Generativa',
    items: [
      { type: 'iag-entrada', label: 'Entrada IAG', icon: '🤖', description: 'Ponto de entrada da IA' },
      { type: 'iag-reentrada', label: 'Reentrada IAG', icon: '↪', description: 'Reentrada no fluxo de IA' },
      { type: 'iag-saida', label: 'Saída IAG', icon: '↗', description: 'Ponto de saída da IA' },
    ],
  },
  {
    id: 'eventos',
    title: 'Eventos',
    items: [
      { type: 'tracking', label: 'Tracking', icon: '📊', description: 'Evento analítico' },
      { type: 'excecao', label: 'Exceção', icon: '⚠️', description: 'Caminho de erro/fallback' },
      { type: 'direcionamento', label: 'Direcionamento', icon: '➡️', description: 'Link para outro frame' },
      { type: 'condicional', label: 'Condicional', icon: '🔀', description: 'Decisão if/else (varal com 2 saídas)' },
      { type: 'atendimento-humano', label: 'Atendimento humano', icon: '👤', description: 'Transbordo: bot → humano (terminal)' },
      { type: 'link', label: 'Link externo', icon: '🔗', description: 'Card de URL externa (site, app, doc)' },
    ],
  },
];

/**
 * Lista flat (legado) — usada por código que ainda não migrou pra grupos.
 */
export const PALETTE_ITEMS: PaletteItem[] = PALETTE_GROUPS.flatMap((g) => g.items);
