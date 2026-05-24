'use client';

/**
 * VersionDiffDialog — modal que mostra o diff entre uma versão (snapshot
 * histórico) e o estado atual do canvas.
 *
 * Aberto pelo botão "Comparar" no VersionsPanel. Renderiza:
 *   • Header: nome da versão + timestamp + sumário (X adicionados, Y
 *     removidos, Z modificados)
 *   • Lista de nodes agrupados por status (added/modified/removed)
 *   • Lista de edges (separada — geralmente menos importante visualmente)
 *   • Click numa linha jumpa pro bloco no canvas (depois de fechar)
 *
 * Sem visualização lado-a-lado de canvas — seria muito complexo e a lista
 * textual cobre 95% dos casos. Pode evoluir depois pra split-screen.
 */
import { useMemo } from 'react';
import {
  ArrowRight,
  Diff,
  GitCommit,
  Minus,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { diffStates, type NodeDiff, type DiffStatus } from '@/lib/versions/diff';
import type { PageVersion } from '@/lib/actions/page-versions';
import type { ProjectState } from '@/lib/types';

interface VersionDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Versão antiga (snapshot). */
  version: PageVersion | null;
  /** Estado atual do canvas. */
  currentState: ProjectState;
  /** Click numa linha → jumpa pro nó no canvas (fecha modal antes). */
  onJumpToNode?: (nodeId: string) => void;
}

const statusConfig: Record<
  DiffStatus,
  { label: string; icon: typeof Plus; color: string; bg: string }
> = {
  added: {
    label: 'Adicionados',
    icon: Plus,
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  },
  removed: {
    label: 'Removidos',
    icon: Minus,
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  },
  modified: {
    label: 'Modificados',
    icon: Pencil,
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  },
  unchanged: {
    label: '',
    icon: GitCommit,
    color: '',
    bg: '',
  },
};

export default function VersionDiffDialog({
  open,
  onOpenChange,
  version,
  currentState,
  onJumpToNode,
}: VersionDiffDialogProps) {
  const diff = useMemo(() => {
    if (!version) return null;
    return diffStates(version.state, currentState);
  }, [version, currentState]);

  if (!version || !diff) return null;

  const totalChanges =
    diff.counts.nodesAdded +
    diff.counts.nodesRemoved +
    diff.counts.nodesModified +
    diff.counts.edgesAdded +
    diff.counts.edgesRemoved +
    diff.counts.edgesModified;

  // Agrupa nodes por status (apenas added/modified/removed — unchanged não entra)
  const grouped = (['added', 'modified', 'removed'] as DiffStatus[]).map((status) => ({
    status,
    items: diff.nodes.filter((n) => n.status === status),
  }));

  function handleJump(nodeId: string) {
    if (!onJumpToNode) return;
    onOpenChange(false);
    setTimeout(() => onJumpToNode(nodeId), 100);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[1100px] h-[90vh] dark:bg-gray-900 flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="flex items-center gap-2 dark:text-white">
            <Diff size={18} className="text-blip-purple" /> Comparação de versões
          </DialogTitle>
          <DialogDescription className="mt-1 dark:text-gray-400">
            Diferença entre{' '}
            <strong className="text-gray-700 dark:text-gray-200">
              {version.label || 'versão sem label'}
            </strong>{' '}
            ({formatDate(version.created_at)}) e o{' '}
            <strong className="text-gray-700 dark:text-gray-200">estado atual</strong> do canvas.
          </DialogDescription>

          {/* Sumário em pílulas */}
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <Pill
              icon={<Plus size={11} />}
              count={diff.counts.nodesAdded}
              label="adicionados"
              status="added"
            />
            <Pill
              icon={<Pencil size={11} />}
              count={diff.counts.nodesModified}
              label="modificados"
              status="modified"
            />
            <Pill
              icon={<Minus size={11} />}
              count={diff.counts.nodesRemoved}
              label="removidos"
              status="removed"
            />
            <Pill
              icon={<ArrowRight size={11} />}
              count={diff.counts.edgesAdded + diff.counts.edgesModified + diff.counts.edgesRemoved}
              label="edges alteradas"
              status="modified"
              muted
            />
            <Pill
              icon={<GitCommit size={11} />}
              count={diff.counts.nodesUnchanged}
              label="inalterados"
              status="unchanged"
              muted
            />
          </div>
        </DialogHeader>

        {/* Lista de mudanças */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {totalChanges === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                <GitCommit size={24} className="text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">
                Sem diferenças
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Esta versão é idêntica ao estado atual.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ status, items }) => {
                if (items.length === 0) return null;
                const cfg = statusConfig[status];
                const Icon = cfg.icon;
                return (
                  <section key={status}>
                    <h3 className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-2 ${cfg.color}`}>
                      <Icon size={12} />
                      {cfg.label}
                      <span className="text-gray-500 dark:text-gray-400 font-normal">
                        ({items.length})
                      </span>
                    </h3>
                    <ul className="space-y-1.5">
                      {items.map((node) => (
                        <NodeDiffItem
                          key={`${status}-${node.id}`}
                          node={node}
                          onJump={() => handleJump(node.id)}
                          canJump={status !== 'removed' && !!onJumpToNode}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}

              {/* Edges section — colapsada em sumário, detalhes opcionais */}
              {(diff.counts.edgesAdded + diff.counts.edgesRemoved + diff.counts.edgesModified) > 0 && (
                <section>
                  <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500 dark:text-gray-400">
                    <ArrowRight size={12} />
                    Conexões alteradas
                    <span className="font-normal">
                      ({diff.counts.edgesAdded + diff.counts.edgesRemoved + diff.counts.edgesModified})
                    </span>
                  </h3>
                  <ul className="space-y-1 text-[11px] font-mono">
                    {diff.edges.map((e) => {
                      const cfg = statusConfig[e.status];
                      const Icon = cfg.icon;
                      return (
                        <li
                          key={`edge-${e.id}`}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded border ${cfg.bg}`}
                        >
                          <Icon size={10} className={cfg.color} />
                          <span className="text-gray-600 dark:text-gray-300">
                            {e.source} → {e.target}
                          </span>
                          {e.changedFields && e.changedFields.length > 0 && (
                            <span className="text-gray-400 dark:text-gray-500 ml-auto">
                              {e.changedFields.join(', ')}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 py-2 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400">
          💡 Click em qualquer linha (exceto removidos) pra navegar até o bloco no canvas.
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// NODE DIFF ITEM
// =============================================================================

interface NodeDiffItemProps {
  node: NodeDiff;
  onJump: () => void;
  canJump: boolean;
}

function NodeDiffItem({ node, onJump, canJump }: NodeDiffItemProps) {
  const cfg = statusConfig[node.status];
  return (
    <li>
      <button
        type="button"
        onClick={canJump ? onJump : undefined}
        disabled={!canJump}
        className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded-md border ${cfg.bg} ${canJump ? 'hover:bg-opacity-70 cursor-pointer' : 'cursor-default'} transition`}
      >
        <span className={`shrink-0 text-xs mt-0.5 ${cfg.color}`}>●</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 uppercase">
              {node.type}
            </span>
            {node.code && (
              <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1 py-0 rounded">
                {node.code}
              </span>
            )}
            {node.frameLabel && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                · {node.frameLabel}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-800 dark:text-gray-100 truncate mt-0.5">
            {node.label}
          </div>
          {node.changeSummary && (
            <div className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5 truncate">
              {node.changeSummary}
            </div>
          )}
        </div>
        {canJump && (
          <span className="shrink-0 text-[10px] text-blip-purple opacity-0 group-hover:opacity-100">
            ↗
          </span>
        )}
      </button>
    </li>
  );
}

// =============================================================================
// PILL
// =============================================================================

interface PillProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  status: DiffStatus;
  muted?: boolean;
}

function Pill({ icon, count, label, status, muted }: PillProps) {
  if (count === 0 && !muted) return null;
  const cfg = statusConfig[status];
  const color = muted
    ? 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800'
    : `${cfg.color} ${cfg.bg.replace(/dark:bg-\S+/g, '').replace(/border-\S+/g, '').trim()}`;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${color}`}
    >
      {icon}
      <span className="tabular-nums">{count}</span>
      <span className="opacity-75">{label}</span>
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Avoid unused import warning
void X;
