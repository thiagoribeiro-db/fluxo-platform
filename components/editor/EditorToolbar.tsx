'use client';

/**
 * Toolbar central do editor — ações de projeto/página.
 *
 * Design: minimalista e profissional, com:
 *  - Ícones SVG via lucide-react (consistente em tamanho e tracejado)
 *  - Botão CTA primário "Compartilhar" destacado
 *  - Grupos separados por linhas verticais sutis
 *  - Hover/active states suaves
 *  - Toggle moderno pro Tracking auto
 *
 * Mantém a UX original (mesmos handlers, mesmos tooltips).
 */
import { type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  Bug,
  Eraser,
  Hash,
  History,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquare,
  Package,
  Play,
  Share2,
  Sprout,
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
  onShare: () => void;
  onToggleComments: () => void;
  onToggleProblems: () => void;
  onTogglePlayback: () => void;
  onToggleVersions: () => void;
  onOrganizeLayout: () => void;
  onReorganizeCodes: () => void;
  onExportBlip: () => void;
  onExportVisual: () => void;
  onLoadTemplate: () => void;
  onResetPage: () => void;
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
    onShare,
    onToggleComments,
    onToggleProblems,
    onTogglePlayback,
    onToggleVersions,
    onOrganizeLayout,
    onReorganizeCodes,
    onExportBlip,
    onExportVisual,
    onLoadTemplate,
    onResetPage,
    onAutoTrackingChange,
    onDumpJson,
    canExport = true,
  } = props;

  return (
    <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur px-1.5 py-1 rounded-xl shadow-md ring-1 ring-gray-200/80 dark:ring-gray-700/80 flex items-center gap-0.5">
      {/* Compartilhar — CTA primário */}
      <PrimaryButton
        icon={<Share2 size={14} strokeWidth={2.5} />}
        label="Compartilhar"
        onClick={onShare}
        title="Gerar link de compartilhamento do projeto"
      />

      <Divider />

      {/* Comentários */}
      <IconButton
        icon={<MessageSquare size={15} />}
        label="Comentários"
        active={commentsOpen}
        badge={commentsCount > 0 ? commentsCount : undefined}
        onClick={onToggleComments}
        title="Abrir painel de comentários"
      />

      {/* Problems */}
      <IconButton
        icon={<AlertCircle size={15} />}
        label="Problemas"
        active={problemsOpen}
        badge={problemsCount > 0 ? problemsCount : undefined}
        tone={
          problemsWorstSeverity === 'error'
            ? 'danger'
            : problemsWorstSeverity === 'warning'
              ? 'amber'
              : problemsWorstSeverity === 'info'
                ? 'primary'
                : 'subtle'
        }
        onClick={onToggleProblems}
        title="Validações automáticas do fluxo"
      />

      {/* Test playground */}
      <IconButton
        icon={<Play size={15} />}
        label="Testar"
        active={playbackOpen}
        tone="primary"
        onClick={onTogglePlayback}
        title="Simular uma conversa no fluxo (sem exportar pro Blip)"
      />

      {/* Versões / histórico */}
      <IconButton
        icon={<History size={15} />}
        label="Versões"
        active={versionsOpen}
        onClick={onToggleVersions}
        title="Histórico de snapshots da página (restaurar versões anteriores)"
      />

      <Divider />

      {/* Layout / IDs */}
      <IconButton
        icon={<LayoutGrid size={15} />}
        label="Organizar"
        onClick={onOrganizeLayout}
        title="Alinha os componentes principais em coluna vertical dentro de cada frame"
      />
      <IconButton
        icon={<Hash size={15} />}
        label="Reordenar IDs"
        onClick={onReorganizeCodes}
        title="Renumera todos os IDs em sequência pela posição vertical"
      />

      {canExport && (
        <>
          <Divider />

          {/* Exportações */}
          <IconButton
            icon={<Package size={15} />}
            label="Exportar Blip"
            tone="primary"
            onClick={onExportBlip}
            title="Exporta o projeto como .zip de JSONs compatível com a plataforma Blip"
          />
          <IconButton
            icon={<ImageIcon size={15} />}
            label="Imagem"
            onClick={onExportVisual}
            title="Exporta o canvas como PNG / PDF / HTML"
          />
        </>
      )}

      <Divider />

      {/* Template / Tracking */}
      <IconButton
        icon={<Sprout size={15} />}
        label="Template"
        tone="amber"
        onClick={onLoadTemplate}
        title="Subir escopo, colar texto ou usar exemplo"
      />
      <Toggle
        checked={autoTracking}
        onChange={onAutoTrackingChange}
        icon={<Activity size={14} />}
        label="Tracking auto"
        title="Quando ativo, cria tracking automaticamente ao adicionar bubbles"
      />

      <Divider />

      {/* Destrutivos / Dev */}
      <IconButton
        icon={<Eraser size={15} />}
        label="Resetar"
        tone="danger"
        onClick={onResetPage}
        title="Apaga TODOS os nodes e edges desta página"
      />
      {process.env.NODE_ENV !== 'production' && (
        <IconButton
          icon={<Bug size={15} />}
          label="Dump"
          tone="subtle"
          onClick={onDumpJson}
          title="DEV: exporta estado atual pra tmp/state-snapshot.json"
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
