'use client';

/**
 * Painel "Problems" — estilo VS Code.
 *
 * Lista problemas detectados pelo `flow-linter` no canvas atual.
 * Aparece como drawer fixo no rodapé (entre canvas e BottomToolbar).
 *
 * Recursos:
 *  - Filtro por severity (errors / warnings / info / all)
 *  - Click na linha navega até o node no canvas (callback `onJumpToNode`)
 *  - Agrupado por severity, com cores semânticas
 *  - Resize não implementado (altura fixa 240px) — fácil adicionar depois
 *
 * O painel NÃO calcula os problems sozinho — recebe via prop. Assim
 * `useFlowLint` no FlowEditor centraliza o cálculo e compartilha com
 * outros consumidores (badges nos nodes, count na toolbar).
 */

import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type {
  Problem,
  ProblemSeverity,
} from '@/lib/lint/flow-linter';

interface ProblemsPanelProps {
  problems: Problem[];
  onClose: () => void;
  onJumpToNode: (nodeId: string) => void;
}

type Filter = 'all' | ProblemSeverity;

const severityIcon: Record<ProblemSeverity, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const severityStyles: Record<ProblemSeverity, { icon: string; bg: string; label: string }> = {
  error: {
    icon: 'text-red-600',
    bg: 'hover:bg-red-50',
    label: 'Erro',
  },
  warning: {
    icon: 'text-amber-600',
    bg: 'hover:bg-amber-50',
    label: 'Aviso',
  },
  info: {
    icon: 'text-blue-600',
    bg: 'hover:bg-blue-50',
    label: 'Info',
  },
};

const SEVERITY_ORDER: ProblemSeverity[] = ['error', 'warning', 'info'];

export default function ProblemsPanel({
  problems,
  onClose,
  onJumpToNode,
}: ProblemsPanelProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    return problems.reduce(
      (acc, p) => {
        acc[p.severity]++;
        acc.total++;
        return acc;
      },
      { error: 0, warning: 0, info: 0, total: 0 }
    );
  }, [problems]);

  const visible = useMemo(() => {
    if (filter === 'all') return problems;
    return problems.filter((p) => p.severity === filter);
  }, [problems, filter]);

  // Ordena: errors → warnings → infos; dentro de cada, por código (estável)
  const sorted = useMemo(() => {
    return [...visible].sort((a, b) => {
      const sa = SEVERITY_ORDER.indexOf(a.severity);
      const sb = SEVERITY_ORDER.indexOf(b.severity);
      if (sa !== sb) return sa - sb;
      return a.code.localeCompare(b.code);
    });
  }, [visible]);

  return (
    <div className="absolute bottom-12 left-0 right-0 h-60 bg-white border-t border-gray-200 shadow-lg flex flex-col z-20">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">
            Problemas
          </h2>
          <span className="text-xs text-gray-500">({counts.total})</span>
        </div>

        <div className="flex items-center gap-1">
          <FilterChip
            label="Todos"
            count={counts.total}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterChip
            label="Erros"
            count={counts.error}
            tone="error"
            active={filter === 'error'}
            onClick={() => setFilter('error')}
          />
          <FilterChip
            label="Avisos"
            count={counts.warning}
            tone="warning"
            active={filter === 'warning'}
            onClick={() => setFilter('warning')}
          />
          <FilterChip
            label="Info"
            count={counts.info}
            tone="info"
            active={filter === 'info'}
            onClick={() => setFilter('info')}
          />
          <button
            type="button"
            onClick={onClose}
            className="ml-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded p-1 transition-colors"
            title="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {sorted.map((p, idx) => (
              <ProblemRow
                key={`${p.code}-${p.nodeId ?? 'no-node'}-${idx}`}
                problem={p}
                onJump={p.nodeId ? () => onJumpToNode(p.nodeId!) : undefined}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-componentes
// =============================================================================

interface ProblemRowProps {
  problem: Problem;
  onJump?: () => void;
}

function ProblemRow({ problem, onJump }: ProblemRowProps) {
  const Icon = severityIcon[problem.severity];
  const styles = severityStyles[problem.severity];
  const clickable = Boolean(onJump);

  return (
    <li
      className={`px-3 py-2 flex items-start gap-2.5 text-sm ${styles.bg} ${
        clickable ? 'cursor-pointer' : ''
      }`}
      onClick={onJump}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onJump!();
        }
      }}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <Icon size={16} className={`${styles.icon} shrink-0 mt-0.5`} />
      <div className="min-w-0 flex-1">
        <div className="text-gray-900">{problem.message}</div>
        {problem.hint && (
          <div className="text-xs text-gray-500 mt-0.5">{problem.hint}</div>
        )}
      </div>
      <code className="text-[10px] text-gray-400 font-mono shrink-0 mt-1">
        {problem.code}
      </code>
    </li>
  );
}

interface FilterChipProps {
  label: string;
  count: number;
  tone?: ProblemSeverity;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ label, count, tone, active, onClick }: FilterChipProps) {
  const baseColors = tone ? severityStyles[tone].icon : 'text-gray-600';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors ${
        active
          ? 'bg-gray-200 text-gray-900'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <span className={active ? '' : baseColors}>{label}</span>
      <span
        className={`min-w-[16px] text-center px-1 rounded text-[10px] font-bold ${
          active ? 'bg-white text-gray-700' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
      <div className="text-3xl mb-2">✓</div>
      <p className="text-sm text-gray-600 font-medium">
        {filter === 'all'
          ? 'Nenhum problema detectado'
          : filter === 'error'
            ? 'Nenhum erro detectado'
            : filter === 'warning'
              ? 'Nenhum aviso ativo'
              : 'Sem informações adicionais'}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        O fluxo está pronto pra exportar.
      </p>
    </div>
  );
}
