/**
 * Registry de comandos do Command Palette (Cmd+K).
 *
 * O registry é DINÂMICO — depende dos handlers do FlowEditor (que tem
 * acesso a state). Por isso `buildCommands(ctx)` recebe um contexto com
 * callbacks e retorna a lista de comandos disponíveis no momento.
 *
 * Pra adicionar um novo comando:
 *   1. Adicione um item em `buildCommands` (ou crie um group novo se
 *      semanticamente diferente)
 *   2. Use `id` único e `keywords` pra ajudar fuzzy search
 *   3. `perform` executa a ação (geralmente um handler do ctx)
 */
import type { FluxoNodeType } from '@/lib/types';

export type CommandGroup =
  | 'create' // criar nó
  | 'navigate' // ir até frame
  | 'panels' // abrir painéis (comentários, problemas, testar)
  | 'actions' // organizar, reordenar, resetar
  | 'export' // export Blip/imagem
  | 'general'; // voltar dashboard, settings

export interface CommandFrame {
  id: string;
  title: string;
  frameId?: string;
}

export interface CommandContext {
  /** Frames do projeto atual — pra gerar comandos "Ir até frame X". */
  frames: CommandFrame[];
  /** Cria um novo nó do tipo informado. */
  onCreateNode: (type: FluxoNodeType) => void;
  /** Centraliza o canvas num frame específico. */
  onJumpToFrame: (frameId: string) => void;
  /** Ações de layout. */
  onOrganize: () => void;
  onReorder: () => void;
  onReset: () => void;
  /** Abrir modais/painéis. */
  onOpenShare: () => void;
  onOpenBlipExport: () => void;
  onOpenVisualExport: () => void;
  onOpenTemplate: () => void;
  onOpenComments: () => void;
  onOpenProblems: () => void;
  onOpenPlayback: () => void;
  onOpenVersions: () => void;
  onOpenFindReplace: () => void;
  onOpenCheatsheet: () => void;
  onOpenAIChat: () => void;
  /** Abrir dialog de inserir Skill (sub-fluxo reutilizável). */
  onOpenSkills: () => void;
  /** Abrir painel Outline (lista hierárquica navegável). */
  onOpenOutline: () => void;
  /** Abrir tabela de conteúdo (modo planilha pra editar textos em massa). */
  onOpenContentTable: () => void;
  /** Abrir Voice & Tone (análise IA de consistência do tom). */
  onOpenVoiceTone: () => void;
  /** Navegação. */
  onBackToDashboard: () => void;
  /** Habilita opcionalmente. */
  canExport?: boolean;
}

export interface Command {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  group: CommandGroup;
  /** Texto que aparece no canto direito (atalho ou hint). */
  shortcut?: string;
  perform: () => void | Promise<void>;
}

const GROUP_LABEL: Record<CommandGroup, string> = {
  create: 'Criar',
  navigate: 'Ir até',
  panels: 'Painéis',
  actions: 'Ações',
  export: 'Exportar',
  general: 'Geral',
};

export function commandGroupLabel(g: CommandGroup): string {
  return GROUP_LABEL[g];
}

// =============================================================================
// CREATE — atalhos pra adicionar nós principais
// =============================================================================

const CREATE_NODE_ITEMS: Array<{
  type: FluxoNodeType;
  label: string;
  keywords: string[];
}> = [
  { type: 'frame', label: 'Frame', keywords: ['container', 'grupo'] },
  { type: 'entry-point', label: 'Início', keywords: ['entry', 'start', 'inicio'] },
  { type: 'bubble-bot', label: 'Bubble Bot', keywords: ['mensagem', 'bot', 'fala'] },
  { type: 'bubble-user', label: 'Bubble User', keywords: ['usuario', 'resposta'] },
  { type: 'menu', label: 'Menu', keywords: ['opcoes', 'lista'] },
  { type: 'btn-short', label: 'Botão curto', keywords: ['button', 'short'] },
  { type: 'btn-long', label: 'Botão longo', keywords: ['button', 'long'] },
  { type: 'direcionamento', label: 'Direcionamento', keywords: ['link', 'goto', 'navegar'] },
  { type: 'condicional', label: 'Condicional', keywords: ['if', 'else', 'decisao'] },
  { type: 'atendimento-humano', label: 'Atendimento humano', keywords: ['transbordo', 'humano'] },
  { type: 'link', label: 'Link externo', keywords: ['url', 'web'] },
  { type: 'integracao-api', label: 'Integração API', keywords: ['api', 'http'] },
  { type: 'integracao-planilha', label: 'Integração Planilha', keywords: ['sheet', 'planilha'] },
  { type: 'iag-entrada', label: 'IAG Entrada', keywords: ['ia', 'ai', 'skill'] },
  { type: 'iag-saida', label: 'IAG Saída', keywords: ['ia', 'ai', 'skill'] },
  { type: 'midia-imagem-bot', label: 'Imagem (Bot)', keywords: ['midia', 'imagem'] },
  { type: 'midia-documento-bot', label: 'Documento (Bot)', keywords: ['midia', 'pdf', 'arquivo'] },
  { type: 'midia-video-bot', label: 'Vídeo (Bot)', keywords: ['midia', 'video'] },
];

// =============================================================================
// MAIN BUILDER
// =============================================================================

export function buildCommands(ctx: CommandContext): Command[] {
  const cmds: Command[] = [];

  // ---- CREATE -----------------------------------------------------------
  for (const item of CREATE_NODE_ITEMS) {
    cmds.push({
      id: `create-${item.type}`,
      group: 'create',
      label: item.label,
      keywords: ['criar', 'novo', 'adicionar', ...item.keywords],
      perform: () => ctx.onCreateNode(item.type),
    });
  }

  // ---- NAVIGATE (dinâmico por frames do projeto) -------------------------
  for (const f of ctx.frames) {
    const title = f.title || f.frameId || f.id.slice(0, 6);
    cmds.push({
      id: `goto-${f.id}`,
      group: 'navigate',
      label: title,
      description: f.frameId ? `Frame: ${f.frameId}` : undefined,
      keywords: ['ir', 'goto', 'navegar', 'frame', title.toLowerCase()],
      perform: () => ctx.onJumpToFrame(f.id),
    });
  }

  // ---- PANELS ------------------------------------------------------------
  cmds.push({
    id: 'open-playback',
    group: 'panels',
    label: 'Testar fluxo',
    description: 'Simula uma conversa no playground',
    keywords: ['test', 'playback', 'simular', 'conversa'],
    perform: ctx.onOpenPlayback,
  });
  cmds.push({
    id: 'open-problems',
    group: 'panels',
    label: 'Problemas',
    description: 'Painel de validações do fluxo',
    keywords: ['lint', 'errors', 'erros', 'avisos'],
    perform: ctx.onOpenProblems,
  });
  cmds.push({
    id: 'open-comments',
    group: 'panels',
    label: 'Comentários',
    description: 'Painel de comentários do projeto',
    keywords: ['discussao', 'review'],
    perform: ctx.onOpenComments,
  });
  cmds.push({
    id: 'open-versions',
    group: 'panels',
    label: 'Ver histórico',
    description: 'Snapshots da página — restaurar versões anteriores',
    keywords: ['versoes', 'versions', 'historico', 'backup', 'snapshot', 'undo'],
    perform: ctx.onOpenVersions,
  });
  cmds.push({
    id: 'open-find-replace',
    group: 'panels',
    label: 'Buscar e substituir',
    description: 'Find & Replace bulk em todos os blocos',
    keywords: ['find', 'replace', 'buscar', 'substituir', 'localizar'],
    shortcut: '⌘F',
    perform: ctx.onOpenFindReplace,
  });
  cmds.push({
    id: 'open-cheatsheet',
    group: 'general',
    label: 'Atalhos do teclado',
    description: 'Cheatsheet com todos os shortcuts disponíveis',
    keywords: ['shortcuts', 'atalhos', 'keyboard', 'teclado', 'ajuda'],
    shortcut: '?',
    perform: ctx.onOpenCheatsheet,
  });
  cmds.push({
    id: 'restart-tour',
    group: 'general',
    label: 'Rever tour de boas-vindas',
    description: 'Tour guiado pelos principais recursos do editor',
    keywords: ['tour', 'onboarding', 'tutorial', 'ajuda', 'iniciar'],
    perform: () => {
      // Import dinâmico pra não carregar driver.js no bundle inicial
      import('@/components/editor/WelcomeTour').then((m) => m.startTour());
    },
  });
  cmds.push({
    id: 'open-ai-chat',
    group: 'panels',
    label: 'Chat com IA',
    description: 'Pergunte sobre o fluxo, peça explicações ou sugestões',
    keywords: ['ai', 'ia', 'chat', 'assistente', 'explicar', 'sugestao'],
    perform: ctx.onOpenAIChat,
  });
  cmds.push({
    id: 'open-skills',
    group: 'create',
    label: 'Inserir Skill',
    description: 'Sub-fluxos prontos: Falar com atendente, Validar CPF, LGPD…',
    keywords: ['skill', 'componente', 'pattern', 'snippet', 'reusar', 'biblioteca'],
    perform: ctx.onOpenSkills,
  });
  cmds.push({
    id: 'open-outline',
    group: 'panels',
    label: 'Outline',
    description: 'Lista hierárquica de frames e blocos — navegue por nome',
    keywords: ['outline', 'lista', 'hierarquia', 'navegar', 'arvore', 'sumario', 'tree'],
    perform: ctx.onOpenOutline,
  });
  cmds.push({
    id: 'open-content-table',
    group: 'panels',
    label: 'Tabela de conteúdo',
    description: 'Edita todos os textos do fluxo em formato planilha',
    keywords: ['conteudo', 'textos', 'planilha', 'tabela', 'copy', 'editar massa', 'spreadsheet'],
    perform: ctx.onOpenContentTable,
  });
  cmds.push({
    id: 'open-voice-tone',
    group: 'actions',
    label: 'Voice & Tone (IA)',
    description: 'IA identifica mensagens que destoam do tom e sugere reescrita',
    keywords: ['voice', 'tone', 'tom', 'voz', 'revisar', 'consistencia', 'copy', 'ia'],
    perform: ctx.onOpenVoiceTone,
  });

  // ---- ACTIONS -----------------------------------------------------------
  cmds.push({
    id: 'organize-layout',
    group: 'actions',
    label: 'Organizar layout',
    description: 'Alinha mains em coluna por frame, cria Início faltando',
    keywords: ['arrumar', 'alinhar', 'auto'],
    perform: ctx.onOrganize,
  });
  cmds.push({
    id: 'reorder-codes',
    group: 'actions',
    label: 'Reordenar IDs',
    description: 'Renumera os blocos pela posição vertical',
    keywords: ['ids', 'codes', 'codigos', 'renumerar'],
    perform: ctx.onReorder,
  });
  cmds.push({
    id: 'reset-page',
    group: 'actions',
    label: 'Resetar página',
    description: '⚠️ Apaga tudo da página atual',
    keywords: ['limpar', 'apagar', 'clear'],
    perform: ctx.onReset,
  });
  cmds.push({
    id: 'load-template',
    group: 'actions',
    label: 'Carregar template',
    description: 'Subir escopo, colar texto ou exemplo',
    keywords: ['importar', 'escopo', 'pdf'],
    perform: ctx.onOpenTemplate,
  });

  // ---- EXPORT ------------------------------------------------------------
  if (ctx.canExport !== false) {
    cmds.push({
      id: 'export-blip',
      group: 'export',
      label: 'Exportar Blip',
      description: '.zip de JSONs compatível com a plataforma Blip',
      keywords: ['blip', 'zip', 'json'],
      perform: ctx.onOpenBlipExport,
    });
    cmds.push({
      id: 'export-visual',
      group: 'export',
      label: 'Exportar imagem',
      description: 'PNG, PDF ou HTML do canvas',
      keywords: ['png', 'pdf', 'imagem', 'screenshot'],
      perform: ctx.onOpenVisualExport,
    });
  }
  cmds.push({
    id: 'share',
    group: 'export',
    label: 'Compartilhar',
    description: 'Gerar link de compartilhamento do projeto',
    keywords: ['link', 'compartilhamento'],
    perform: ctx.onOpenShare,
  });

  // ---- GENERAL -----------------------------------------------------------
  cmds.push({
    id: 'back-to-dashboard',
    group: 'general',
    label: 'Voltar ao dashboard',
    keywords: ['home', 'inicio', 'projetos'],
    perform: ctx.onBackToDashboard,
  });

  return cmds;
}
