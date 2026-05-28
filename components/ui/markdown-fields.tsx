'use client';

/**
 * Conjunto de componentes compartilhados pra UI estruturada com markdown:
 *   - `SectionCard` — card bordado com header colorido + slot extra (toggle)
 *   - `AutoGrowTextarea` — textarea que cresce conforme conteúdo
 *   - `MarkdownTextField` — section completa com toggle Editar/Preview + bullets
 *
 * Usado em:
 *   - `app/dashboard/ComponentsSection.tsx` (catálogo de specs)
 *   - `app/dashboard/settings/VoiceToneSettings.tsx` (perfil de voz padrão)
 */

import { useRef, useState, type ReactNode } from 'react';
import {
  renderBulletMarkdown,
  markdownToBullets,
} from '@/lib/utils/bullet-markdown';

// ============================================================================
// Estilos por tom
// ============================================================================

export const TONE_STYLES = {
  emerald: {
    headerBg: 'bg-emerald-50/60',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    accent: 'text-emerald-700',
    numberBg: 'bg-emerald-100 text-emerald-800',
    itemBorder: 'border-emerald-100 hover:border-emerald-200',
  },
  purple: {
    headerBg: 'bg-blip-purple/5',
    border: 'border-blip-purple/20',
    badge: 'bg-blip-purple/10 text-blip-purple-dark',
    accent: 'text-blip-purple-dark',
    numberBg: 'bg-blip-purple/10 text-blip-purple-dark',
    itemBorder: 'border-blip-purple/10 hover:border-blip-purple/30',
  },
  amber: {
    headerBg: 'bg-amber-50/60',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    accent: 'text-amber-800',
    numberBg: 'bg-amber-100 text-amber-800',
    itemBorder: 'border-amber-100 hover:border-amber-200',
  },
  rose: {
    headerBg: 'bg-rose-50/60',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-800',
    accent: 'text-rose-800',
    numberBg: 'bg-rose-100 text-rose-800',
    itemBorder: 'border-rose-100 hover:border-rose-200',
  },
  blue: {
    headerBg: 'bg-blue-50/60',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    accent: 'text-blue-800',
    numberBg: 'bg-blue-100 text-blue-800',
    itemBorder: 'border-blue-100 hover:border-blue-200',
  },
  gray: {
    headerBg: 'bg-gray-50',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-700',
    accent: 'text-gray-700',
    numberBg: 'bg-gray-100 text-gray-700',
    itemBorder: 'border-gray-200 hover:border-gray-300',
  },
} as const;

export type Tone = keyof typeof TONE_STYLES;

export const inputCls =
  'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blip-purple focus:outline-none focus:ring-1 focus:ring-blip-purple/30';

// ============================================================================
// SectionCard
// ============================================================================

export function SectionCard({
  icon,
  title,
  hint,
  tone = 'gray',
  badge,
  children,
  collapsibleDefaultOpen,
  headerExtra,
}: {
  icon: string;
  title: string;
  hint?: string;
  tone?: Tone;
  badge?: string;
  children: ReactNode;
  /** Quando definido, a seção é colapsável e abre/fecha com esse default. */
  collapsibleDefaultOpen?: boolean;
  /** Slot opcional no canto direito do header (ex: toggle Editar/Preview). */
  headerExtra?: ReactNode;
}) {
  const s = TONE_STYLES[tone];
  const [open, setOpen] = useState(collapsibleDefaultOpen ?? true);
  const collapsible = collapsibleDefaultOpen !== undefined;

  return (
    <section className={`bg-white border ${s.border} rounded-lg overflow-hidden`}>
      <header
        className={`${s.headerBg} px-4 py-2.5 border-b ${s.border} flex items-center justify-between gap-3 ${
          collapsible ? 'cursor-pointer select-none' : ''
        }`}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none">{icon}</span>
          <h3 className={`text-sm font-semibold ${s.accent} truncate`}>{title}</h3>
          {badge && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${s.badge}`}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hint && (
            <span className="text-[11px] text-gray-500 hidden md:block">{hint}</span>
          )}
          {headerExtra}
          {collapsible && (
            <span
              className={`text-xs ${s.accent} transition-transform ${
                open ? 'rotate-90' : ''
              }`}
            >
              ▶
            </span>
          )}
        </div>
      </header>
      {open && <div className="p-4">{children}</div>}
    </section>
  );
}

// ============================================================================
// AutoGrowTextarea
// ============================================================================

export function AutoGrowTextarea({
  value,
  onChange,
  minRows = 1,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        if (el) resize(el);
      }}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        resize(e.currentTarget);
      }}
      rows={minRows}
      placeholder={placeholder}
      disabled={disabled}
      className={(className ?? '') + ' resize-none overflow-hidden'}
    />
  );
}

// ============================================================================
// MarkdownTextField
// ============================================================================

export function MarkdownTextField({
  icon,
  label,
  hint,
  value,
  onChange,
  placeholder,
  tone = 'gray',
  kind = 'list',
  collapsibleDefaultOpen,
  forceMode,
}: {
  icon: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  tone?: Tone;
  /** 'list' conta bullets e exibe hint de lista; 'paragraph' é texto livre. */
  kind?: 'list' | 'paragraph';
  /** Quando definido, a seção é colapsável. */
  collapsibleDefaultOpen?: boolean;
  /** Override do estado local — usado pelo toggle global Edit/Read da modal. */
  forceMode?: 'edit' | 'preview';
}) {
  const s = TONE_STYLES[tone];
  const [localMode, setLocalMode] = useState<'edit' | 'preview'>('edit');
  const mode: 'edit' | 'preview' = forceMode ?? localMode;
  const setMode = (next: 'edit' | 'preview') => {
    if (forceMode !== undefined) return;
    setLocalMode(next);
  };
  const toggleLocked = forceMode !== undefined;
  const count = kind === 'list' ? markdownToBullets(value).length : 0;

  return (
    <SectionCard
      icon={icon}
      title={label}
      hint={hint}
      tone={tone}
      badge={kind === 'list' && count > 0 ? String(count) : undefined}
      collapsibleDefaultOpen={collapsibleDefaultOpen}
      headerExtra={
        toggleLocked ? null : (
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded p-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMode('edit');
              }}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition ${
                mode === 'edit' ? `${s.numberBg}` : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMode('preview');
              }}
              disabled={!value.trim()}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === 'preview' ? `${s.numberBg}` : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Preview
            </button>
          </div>
        )
      }
    >
      {mode === 'edit' ? (
        <>
          <AutoGrowTextarea
            value={value}
            onChange={onChange}
            minRows={kind === 'list' ? 3 : 4}
            placeholder={placeholder}
            className={
              inputCls + ' font-mono text-[12px] leading-relaxed text-gray-800'
            }
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            {kind === 'list' && (
              <>
                Use <code className="font-mono text-gray-500">- item</code> pra bullets.{' '}
              </>
            )}
            Markdown:{' '}
            <code className="font-mono text-gray-500">**bold**</code>,{' '}
            <code className="font-mono text-gray-500">*italic*</code>,{' '}
            <code className="font-mono text-gray-500">`code`</code>,{' '}
            <code className="font-mono text-gray-500">[link](url)</code>.
          </p>
        </>
      ) : (
        <div className="prose prose-sm max-w-none text-sm text-gray-800 leading-relaxed bg-white border border-gray-200 rounded-md p-3 min-h-[80px]">
          {value.trim() ? (
            renderBulletMarkdown(value)
          ) : (
            <p className="text-xs text-gray-400 italic">Vazio.</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
