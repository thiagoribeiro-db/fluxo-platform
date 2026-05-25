'use client';

/**
 * Toolbar central do editor — ações de projeto/página.
 *
 * Layout: agrupado por categoria em dropdowns (padrão Linear/Figma/Notion):
 *
 *  [Compartilhar] | [✨ IA] | [Editar ▾] [Visualizar ▾] [Exportar ▾] | [Tracking auto] | [? ] [🐛]
 *
 * Compartilhar  → CTA primário, sempre visível
 * IA            → atalho rápido pro Chat IA (resolve "muito escondido")
 * Editar ▾      → Buscar/substituir, Organizar layout, Reordenar IDs, Resetar
 * Visualizar ▾  → Comentários, Problemas, Testar, Versões (com badges/active states)
 * Exportar ▾    → Blip, Imagem, Template
 * Tracking auto → Toggle visível (setting, fica em destaque)
 * ?             → Cheatsheet de atalhos
 * 🐛            → Dump JSON (dev only)
 *
 * Dropdown custom (sem dependência Radix DropdownMenu — não instalado):
 * fecha em click fora + ESC. Pré-fecha ao clicar num item pra evitar
 * flash visual antes do handler executar.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  Bug,
  ChevronDown,
  Eraser,
  Hash,
  History,
  Image as ImageIcon,
  Keyboard,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  ListTree,
  Package,
  Play,
  Puzzle,
  Search,
  Share2,
  Sparkles,
  Sprout,
  Table2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export interface EditorToolbarProps {
  commentsCount: number;
  commentsOpen: boolean;
  autoTracking: boolean;
  /** Contagem de problemas do linter (errors+warnings+info). */
  problemsCount: number;
  /** Severidade da pior categoria — define cor do badge. */
  problemsWorstSeverity: 'error' | 'warning' | 'info' | null;
  problemsOpen: boolean;
  /** Estado do Test Playground (panel aberto ou não). */
  playbackOpen: boolean;
  /** Estado do painel Versões. */
  versionsOpen: boolean;
  /** Estado do Chat IA. */
  aiChatOpen?: boolean;
  /** Estado do Outline (painel à esquerda). */
  outlineOpen?: boolean;
  /** Toggle do Outline. */
  onToggleOutline?: () => void;
  onShare: () => void;
  onToggleComments: () => void;
  onToggleProblems: () => void;
  onTogglePlayback: () => void;
  onToggleVersions: () => void;
  onToggleAIChat?: () => void;
  onOrganizeLayout: () => void;
  onReorganizeCodes: () => void;
  onExportBlip: () => void;
  onExportVisual: () => void;
  onLoadTemplate: () => void;
  onResetPage: () => void;
  onOpenFindReplace?: () => void;
  onOpenCheatsheet?: () => void;
  /** Abre dialog de Skills (sub-fluxos reutilizáveis). */
  onOpenSkills?: () => void;
  /** Abre tabela de conteúdo (modo planilha). */
  onOpenContentTable?: () => void;
  /** Abre Voice & Tone (análise IA de consistência do tom). */
  onOpenVoiceTone?: () => void;
  onAutoTrackingChange: (next: boolean) => void;
  onDumpJson: () => void;
  /** Se false, esconde botões de export. */
  canExport?: boolean;
}

export default function EditorToolbar(props: EditorToolbarProps) {
  const {
    commentsCount,
    commentsOpen,
    autoTracking,
    problemsCount,
    problemsWorstSeverity,
    problemsOpen,
    playbackOpen,
    versionsOpen,
    aiChatOpen = false,
    outlineOpen = false,
    onToggleOutline,
    onShare,
    onToggleComments,
    onToggleProblems,
    onTogglePlayback,
    onToggleVersions,
    onToggleAIChat,
    onOrganizeLayout,
    onReorganizeCodes,
    onExportBlip,
    onExportVisual,
    onLoadTemplate,
    onResetPage,
    onOpenFindReplace,
    onOpenCheatsheet,
    onOpenSkills,
    onOpenContentTable,
    onOpenVoiceTone,
    onAutoTrackingChange,
    onDumpJson,
    canExport = true,
  } = props;

  // Contagem global "tem algo aberto em Visualizar?" — pinta o dropdown ativo
  const anyVisualOpen =
    commentsOpen || problemsOpen || playbackOpen || versionsOpen || outlineOpen;

  return (
    <div
      data-tour="toolbar"
      className="bg-white/95 dark:bg-gray-900/95 backdrop-blur px-1.5 py-1 rounded-xl shadow-md ring-1 ring-gray-200/80 dark:ring-gray-700/80 flex items-center gap-0.5"
    >
      {/* Compartilhar — CTA primário */}
      <PrimaryButton
        icon={<Share2 size={14} strokeWidth={2.5} />}
        label="Compartilhar"
        onClick={onShare}
        title="Gerar link de compartilhamento do projeto"
      />

      <Divider />

      {/* IA — botão standalone (não fica escondido em dropdown) */}
      {onToggleAIChat && (
        <IconButton
          icon={<Sparkles size={15} />}
          label="IA"
          active={aiChatOpen}
          tone="primary"
          onClick={onToggleAIChat}
          title="Chat IA — pergunte sobre o fluxo, peça sugestões"
        />
      )}

      <Divider />

      {/* Editar ▾ */}
      <DropdownButton
        label="Editar"
        title="Ações de edição do fluxo"
        items={[
          ...(onOpenSkills
            ? [
                {
                  key: 'skills',
                  icon: <Puzzle size={15} />,
                  label: 'Inserir Skill',
                  description: 'Sub-fluxos prontos (Falar com atendente, Validar CPF, LGPD…)',
                  tone: 'primary' as const,
                  onClick: onOpenSkills,
                },
              ]
            : []),
          ...(onOpenVoiceTone
            ? [
                {
                  key: 'voice-tone',
                  icon: <Sparkles size={15} />,
                  label: 'Voice & Tone (IA)',
                  description: 'IA revisa consistência do tom e sugere reescritas',
                  tone: 'primary' as const,
                  onClick: onOpenVoiceTone,
                },
              ]
            : []),
          ...(onOpenFindReplace
            ? [
                {
                  key: 'find',
                  icon: <Search size={15} />,
                  label: 'Buscar e substituir',
                  shortcut: 'Cmd+F',
                  onClick: onOpenFindReplace,
                },
              ]
            : []),
          {
            key: 'organize',
            icon: <LayoutGrid size={15} />,
            label: 'Organizar layout',
            description: 'Alinha componentes em coluna vertical por frame',
            onClick: onOrganizeLayout,
          },
          {
            key: 'reorder',
            icon: <Hash size={15} />,
            label: 'Reordenar IDs',
            description: 'Renumera blocos pela posição vertical',
            onClick: onReorganizeCodes,
          },
          { key: '__sep1' },
          {
            key: 'reset',
            icon: <Eraser size={15} />,
            label: 'Resetar página',
            description: 'Apaga TODOS os nodes e edges desta página',
            tone: 'danger' as const,
            onClick: onResetPage,
          },
        ]}
      />

      {/* Visualizar ▾ */}
      <DropdownButton
        label="Visualizar"
        title="Painéis e ferramentas de inspeção"
        active={anyVisualOpen}
        items={[
          ...(onToggleOutline
            ? [
                {
                  key: 'outline',
                  icon: <ListTree size={15} />,
                  label: 'Outline',
                  description: 'Lista hierárquica de frames e blocos',
                  active: outlineOpen,
                  onClick: onToggleOutline,
                },
              ]
            : []),
          ...(onOpenContentTable
            ? [
                {
                  key: 'content-table',
                  icon: <Table2 size={15} />,
                  label: 'Tabela de conteúdo',
                  description: 'Edita textos em massa (modo planilha)',
                  onClick: onOpenContentTable,
                },
              ]
            : []),
          {
            key: 'comments',
            icon: <MessageSquare size={15} />,
            label: 'Comentários',
            active: commentsOpen,
            badge: commentsCount > 0 ? commentsCount : undefined,
            onClick: onToggleComments,
          },
          {
            key: 'problems',
            icon: <AlertCircle size={15} />,
            label: 'Problemas',
            active: problemsOpen,
            badge: problemsCount > 0 ? problemsCount : undefined,
            tone:
              problemsWorstSeverity === 'error'
                ? ('danger' as const)
                : problemsWorstSeverity === 'warning'
                  ? ('amber' as const)
                  : problemsWorstSeverity === 'info'
                    ? ('primary' as const)
                    : undefined,
            onClick: onToggleProblems,
          },
          {
            key: 'playback',
            icon: <Play size={15} />,
            label: 'Testar fluxo',
            description: 'Simula uma conversa (Playback)',
            tone: 'primary' as const,
            active: playbackOpen,
            onClick: onTogglePlayback,
          },
          {
            key: 'versions',
            icon: <History size={15} />,
            label: 'Versões',
            description: 'Histórico de snapshots — restaurar versões anteriores',
            active: versionsOpen,
            onClick: onToggleVersions,
          },
        ]}
      />

      {/* Exportar ▾ */}
      {canExport && (
        <DropdownButton
          label="Exportar"
          title="Exportações e templates"
          items={[
            {
              key: 'blip',
              icon: <Package size={15} />,
              label: 'Exportar Blip',
              description: '.zip de JSONs compatível com Blip/Digitalbot',
              tone: 'primary' as const,
              onClick: onExportBlip,
            },
            {
              key: 'visual',
              icon: <ImageIcon size={15} />,
              label: 'Imagem',
              description: 'PNG, PDF ou HTML do canvas',
              onClick: onExportVisual,
            },
            { key: '__sep2' },
            {
              key: 'template',
              icon: <Sprout size={15} />,
              label: 'Carregar template',
              description: 'Subir escopo, colar texto ou usar exemplo',
              tone: 'amber' as const,
              onClick: onLoadTemplate,
            },
          ]}
        />
      )}

      <Divider />

      {/* Tracking auto — toggle direto (é setting, não ação) */}
      <Toggle
        checked={autoTracking}
        onChange={onAutoTrackingChange}
        icon={<Activity size={14} />}
        label="Tracking"
        title="Quando ativo, cria tracking automaticamente ao adicionar bubbles"
      />

      <Divider />

      {/* Cheatsheet — ícone compacto à direita */}
      {onOpenCheatsheet && (
        <IconOnly
          icon={<Keyboard size={15} />}
          onClick={onOpenCheatsheet}
          title="Ver atalhos de teclado (?)"
        />
      )}

      {/* Dump dev */}
      {process.env.NODE_ENV !== 'production' && (
        <IconOnly
          icon={<Bug size={15} />}
          onClick={onDumpJson}
          title="DEV: exporta estado atual pra tmp/state-snapshot.json"
          tone="subtle"
        />
      )}
    </div>
  );
}

// =============================================================================
// PRIMITIVOS
// =============================================================================

function Divider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5" aria-hidden />;
}

interface PrimaryButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  title?: string;
}

function PrimaryButton({ icon, label, onClick, title }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blip-purple hover:bg-blip-purple-dark active:bg-blip-purple-dark/90 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blip-purple/40"
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

type ButtonTone = 'default' | 'primary' | 'amber' | 'danger' | 'subtle';

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  title?: string;
  active?: boolean;
  tone?: ButtonTone;
  badge?: number;
}

const toneStyles: Record<ButtonTone, { idle: string; active: string }> = {
  default: {
    idle: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
    active: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white',
  },
  primary: {
    idle: 'text-blip-purple hover:bg-blip-purple/10 dark:hover:bg-blip-purple/20',
    active: 'bg-blip-purple/15 dark:bg-blip-purple/25 text-blip-purple-dark dark:text-blip-purple',
  },
  amber: {
    idle: 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
    active: 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200',
  },
  danger: {
    idle: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
    active: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  },
  subtle: {
    idle: 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300',
    active: 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  },
};

function IconButton({
  icon,
  label,
  onClick,
  title,
  active = false,
  tone = 'default',
  badge,
}: IconButtonProps) {
  const styles = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blip-purple/30 ${
        active ? styles.active : styles.idle
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
      {typeof badge === 'number' && (
        <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-blip-purple text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

interface IconOnlyProps {
  icon: ReactNode;
  onClick: () => void;
  title?: string;
  tone?: ButtonTone;
  active?: boolean;
}

/** Botão só com ícone (sem label) — pra cheatsheet e dump no canto direito. */
function IconOnly({ icon, onClick, title, tone = 'default', active = false }: IconOnlyProps) {
  const styles = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blip-purple/30 ${
        active ? styles.active : styles.idle
      }`}
    >
      {icon}
    </button>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  icon: ReactNode;
  label: string;
  title?: string;
}

function Toggle({ checked, onChange, icon, label, title }: ToggleProps) {
  return (
    <label
      className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 text-xs font-medium rounded-lg cursor-pointer select-none text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title={title}
    >
      <span className={`shrink-0 ${checked ? 'text-blip-purple' : 'text-gray-400 dark:text-gray-500'}`}>
        {icon}
      </span>
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

// =============================================================================
// DROPDOWN
// =============================================================================

interface DropdownItem {
  key: string;
  /** Se a key começar com `__sep`, vira um separador. */
  icon?: ReactNode;
  label?: string;
  description?: string;
  shortcut?: string;
  badge?: number;
  tone?: ButtonTone;
  active?: boolean;
  onClick?: () => void;
}

interface DropdownButtonProps {
  label: string;
  title?: string;
  /** Se true, o trigger fica com estilo de "tem painel aberto". */
  active?: boolean;
  items: DropdownItem[];
}

function DropdownButton({ label, title, active = false, items }: DropdownButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fecha em click fora + ESC. Não precisa de focus trap — é menu rápido.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node | null;
      if (t && wrapRef.current && !wrapRef.current.contains(t)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerStyles = active ? toneStyles.default.active : toneStyles.default.idle;

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blip-purple/30 ${triggerStyles}`}
      >
        <span>{label}</span>
        <ChevronDown
          size={13}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1.5 min-w-[260px] bg-white dark:bg-gray-900 rounded-lg shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 py-1 z-50 animate-in fade-in-0 zoom-in-95"
        >
          {items.map((it) => {
            if (it.key.startsWith('__sep')) {
              return (
                <div
                  key={it.key}
                  className="my-1 h-px bg-gray-100 dark:bg-gray-800"
                  aria-hidden
                />
              );
            }
            const styles = toneStyles[it.tone ?? 'default'];
            return (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
                className={`w-full text-left flex items-start gap-2.5 px-3 py-2 transition-colors ${
                  it.active ? styles.active : styles.idle
                }`}
              >
                {it.icon && (
                  <span className="shrink-0 mt-0.5">{it.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{it.label}</span>
                    {typeof it.badge === 'number' && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-blip-purple text-white">
                        {it.badge > 99 ? '99+' : it.badge}
                      </span>
                    )}
                  </div>
                  {it.description && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                      {it.description}
                    </div>
                  )}
                </div>
                {it.shortcut && (
                  <kbd className="shrink-0 ml-2 mt-0.5 text-[10px] font-mono text-gray-400 dark:text-gray-500">
                    {it.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Mantém export do IconButton/MoreHorizontal só pra não quebrar imports antigos
// se alguém estiver usando — não há referências fora deste arquivo no momento.
export { IconButton, MoreHorizontal };
