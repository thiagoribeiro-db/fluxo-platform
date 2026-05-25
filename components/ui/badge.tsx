'use client';

/**
 * Badge — pill colorido reutilizável.
 *
 * Substitui patterns Tailwind duplicados que apareciam em vários
 * componentes (ProjectStatusBadge, EditorToolbar, ContentTableDialog).
 *
 * Variantes:
 *  - default | primary | success | warning | danger | muted
 *  - size: sm (10px) | md (12px) | lg (14px)
 *
 * Props extras:
 *  - icon: ReactNode renderizado antes do label
 *  - count: número exibido depois do label (badge dentro de badge)
 *
 * Uso:
 *   <Badge variant="success">✓ Aprovado</Badge>
 *   <Badge variant="warning" size="sm" count={3}>Pendentes</Badge>
 */

import { type ReactNode } from 'react';

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  count?: number;
  className?: string;
  title?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  primary:
    'bg-blip-purple/15 text-blip-purple-dark dark:bg-blip-purple/25 dark:text-blip-purple',
  success:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  warning:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  danger:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  muted: 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-[11px] px-2 py-0.5 gap-1',
  lg: 'text-xs px-2.5 py-1 gap-1.5',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon,
  count,
  className = '',
  title,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full font-semibold ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
    >
      {icon && <span className="shrink-0 leading-none">{icon}</span>}
      <span>{children}</span>
      {typeof count === 'number' && (
        <span className="ml-0.5 rounded-full bg-white/30 px-1 text-[9px] tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </span>
  );
}
