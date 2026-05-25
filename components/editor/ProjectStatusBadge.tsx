'use client';

/**
 * Badge clicável do status do projeto (draft/review/approved/archived).
 *
 * Renderiza um pill colorido. Click abre um popover com as 4 opções pra
 * trocar. Salva via server action `updateProject({ status })` e revalida
 * o /dashboard e /editor.
 *
 * Em modo share (read-only externo), o badge é renderizado mas o click
 * fica desabilitado — cliente vê o status mas não muda.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { ProjectStatus } from '@/lib/types';
import { updateProject } from '@/lib/actions/projects';
import { toast } from '@/lib/utils/errors';

interface ProjectStatusBadgeProps {
  projectId: string;
  initialStatus: ProjectStatus;
  /** True quando o usuário não pode editar (modo share view/comment). */
  readOnly?: boolean;
  /** Compacto pra caber em headers densos. */
  compact?: boolean;
}

const STATUSES: Array<{
  key: ProjectStatus;
  label: string;
  icon: string;
  hint: string;
}> = [
  { key: 'draft', label: 'Rascunho', icon: '✏️', hint: 'Em construção' },
  { key: 'review', label: 'Em revisão', icon: '👀', hint: 'Aguardando cliente' },
  { key: 'approved', label: 'Aprovado', icon: '✓', hint: 'Pronto pra deploy' },
  { key: 'archived', label: 'Arquivado', icon: '📦', hint: 'Concluído ou parado' },
];

function styleFor(status: ProjectStatus) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'review':
      return 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300';
    case 'archived':
      return 'bg-gray-200 text-gray-500 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-400';
    case 'draft':
    default:
      return 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300';
  }
}

export default function ProjectStatusBadge({
  projectId,
  initialStatus,
  readOnly = false,
  compact = false,
}: ProjectStatusBadgeProps) {
  const [status, setStatus] = useState<ProjectStatus>(initialStatus);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleChange = useCallback(
    (next: ProjectStatus) => {
      if (next === status) {
        setOpen(false);
        return;
      }
      // Optimistic update — UI mostra novo status imediato; reverte se erro.
      const previous = status;
      setStatus(next);
      setOpen(false);
      startTransition(async () => {
        try {
          await updateProject(projectId, { status: next });
          toast({ level: 'success', message: `Status: ${next}` });
        } catch (err) {
          setStatus(previous);
          toast({
            level: 'error',
            message: err instanceof Error ? err.message : 'Erro ao atualizar status',
          });
        }
      });
    },
    [projectId, status]
  );

  const current = STATUSES.find((s) => s.key === status)!;
  const label = compact ? current.icon : `${current.icon} ${current.label}`;

  if (readOnly) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${styleFor(status)}`}
        title={current.hint}
      >
        {label}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${styleFor(status)} disabled:opacity-60`}
        title="Clique pra mudar o status do projeto"
        aria-expanded={open}
      >
        {pending ? '…' : label}
        <span className="text-[8px] opacity-50">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => handleChange(s.key)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                s.key === status ? 'font-semibold text-blip-purple' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-base">{s.icon}</span>
              <span className="flex-1">
                <div>{s.label}</div>
                <div className="text-[10px] text-gray-400">{s.hint}</div>
              </span>
              {s.key === status && <span className="text-blip-purple">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
