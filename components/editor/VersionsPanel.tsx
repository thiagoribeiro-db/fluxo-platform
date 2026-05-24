'use client';

/**
 * Painel "Versões" — sidebar à direita com histórico de snapshots da página.
 *
 * Cada versão é um snapshot do `state` (nodes/edges/viewport) em um
 * momento. São criadas automaticamente antes de operações destrutivas
 * (template/IA) e podem ser criadas manualmente pelo user via botão.
 *
 * UX:
 *  - Lista mais recentes primeiro
 *  - Timestamp relativo ("há 5 min", "ontem às 14:30")
 *  - Label da versão + autor
 *  - Resumo: X frames, Y nodes
 *  - Click expande detalhes; botão Restaurar mostra confirm
 *  - Botão "Criar snapshot agora" no header
 */

import { useCallback, useEffect, useState } from 'react';
import { Clock, Diff, FileText, History, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import {
  createVersion,
  deleteVersion,
  listVersions,
  restoreVersion,
  type PageVersion,
} from '@/lib/actions/page-versions';
import { confirmDialog, promptDialog } from '@/lib/utils/dialog';
import { handleError, toast } from '@/lib/utils/errors';
import { track } from '@/lib/analytics/posthog';
import type { ProjectState } from '@/lib/types';
import VersionDiffDialog from './VersionDiffDialog';

interface VersionsPanelProps {
  pageId: string;
  onClose: () => void;
  /** Chamado após restore bem-sucedido — pai recarrega state da page. */
  onRestored: () => void;
  /**
   * Callback que retorna o ESTADO ATUAL do canvas (nodes/edges/viewport).
   * Passado pro `createVersion` como `explicitState` — garante que o
   * snapshot reflita exatamente o que o usuário vê, independente do
   * autosave ter rodado ou não. Sem isso, a action lê do banco e pode
   * pegar versão desatualizada (ou vazia, se a página é nova).
   */
  getCurrentState: () => ProjectState;
  /** Click numa linha do diff → centraliza câmera no nó. Opcional. */
  onJumpToNode?: (nodeId: string) => void;
}

export default function VersionsPanel({
  pageId,
  onClose,
  onRestored,
  getCurrentState,
  onJumpToNode,
}: VersionsPanelProps) {
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [loading, setLoading] = useState(true);
  // Substituímos useTransition pelo busy state direto. Motivo: as actions
  // server (createVersion/restoreVersion/deleteVersion) são async; o
  // `startTransition(async () => ...)` do React 18 trata APENAS a parte
  // síncrona como transition — o await fica fora, e erros/Promise pending
  // podem ser "engolidos" silenciosamente. Com useState normal e try/catch
  // direto, o erro sempre chega no handleError e o usuário vê o toast.
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Versão sendo comparada (diff dialog aberto). null = fechado. */
  const [diffVersion, setDiffVersion] = useState<PageVersion | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listVersions(pageId);
      setVersions(list);
    } catch (err) {
      handleError(err, { context: 'list-versions' });
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleCreateSnapshot() {
    if (busy) return;
    const label = await promptDialog({
      title: 'Criar snapshot agora',
      message: 'Descreva esta versão (opcional):',
      placeholder: 'ex: antes de mexer no menu',
      required: false,
    });
    if (label === null) return;

    // Pega o state ATUAL do canvas (client) — não confia no autosave
    const currentState = getCurrentState();
    // Debug — útil se algo der errado o user pode mandar o log
    // eslint-disable-next-line no-console
    console.log('[VersionsPanel] createSnapshot', {
      pageId,
      nodesCount: currentState.nodes?.length ?? 0,
      edgesCount: currentState.edges?.length ?? 0,
      label: label || 'Manual',
    });

    if (!currentState.nodes || currentState.nodes.length === 0) {
      toast({
        level: 'warn',
        message: 'Página vazia',
        detail:
          'Adicione ao menos um nó (frame, bubble, etc.) antes de criar um snapshot.',
      });
      return;
    }

    setBusy(true);
    try {
      const result = await createVersion(
        pageId,
        label || 'Manual',
        currentState
      );
      if (result) {
        track('version_created', { manual: true });
        toast({ level: 'success', message: 'Versão criada' });
        await reload();
      } else {
        // Não deve cair aqui — guarda só por segurança
        toast({
          level: 'warn',
          message: 'Nada pra salvar',
          detail: `Servidor rejeitou: ${currentState.nodes.length} nós no client, mas a action retornou null.`,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VersionsPanel] createVersion error', err);
      handleError(err, { context: 'create-version' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(version: PageVersion) {
    if (busy) return;
    const ok = await confirmDialog({
      title: 'Restaurar esta versão?',
      message: `Vai sobrescrever o conteúdo atual da página. Um snapshot do estado atual será criado automaticamente antes — você pode desfazer pelo mesmo painel.\n\nVersão: ${version.label ?? 'sem label'}\nCriada: ${formatDate(version.created_at)}`,
      confirmText: 'Restaurar',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await restoreVersion(version.id);
      track('version_restored', { versionId: version.id });
      toast({ level: 'success', message: 'Versão restaurada' });
      await reload();
      onRestored();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VersionsPanel] restoreVersion error', err);
      handleError(err, { context: 'restore-version' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(version: PageVersion) {
    if (busy) return;
    const ok = await confirmDialog({
      title: 'Apagar esta versão?',
      message:
        'A versão será removida permanentemente. Esta ação não afeta o estado atual da página.',
      confirmText: 'Apagar',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteVersion(version.id);
      toast({ level: 'success', message: 'Versão apagada' });
      await reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VersionsPanel] deleteVersion error', err);
      handleError(err, { context: 'delete-version' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="fixed top-0 right-0 h-full w-[340px] bg-white dark:bg-gray-900 border-l border-gray-300 dark:border-gray-700 shadow-2xl flex flex-col z-30">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-2 shrink-0">
        <History size={18} className="text-blip-purple shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Versões</h2>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {versions.length} snapshot{versions.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateSnapshot}
          disabled={busy}
          className="text-xs font-medium text-blip-purple hover:bg-blip-purple/10 px-2 py-1.5 rounded flex items-center gap-1 disabled:opacity-50"
          title="Criar snapshot do estado atual"
        >
          <Plus size={14} /> Novo
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded p-1.5"
          title="Fechar"
        >
          <X size={16} />
        </button>
      </header>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Carregando…
          </div>
        ) : versions.length === 0 ? (
          <EmptyState onCreate={handleCreateSnapshot} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {versions.map((v) => (
              <VersionRow
                key={v.id}
                version={v}
                expanded={expandedId === v.id}
                onToggle={() =>
                  setExpandedId((cur) => (cur === v.id ? null : v.id))
                }
                onRestore={() => handleRestore(v)}
                onDelete={() => handleDelete(v)}
                onCompare={() => setDiffVersion(v)}
                busy={busy}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <footer className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
        Snapshots automáticos antes de templates/IA · Máx 50 por página
      </footer>

      {/* Diff dialog — aberto via botão "Comparar" em cada versão */}
      <VersionDiffDialog
        open={diffVersion !== null}
        onOpenChange={(open) => {
          if (!open) setDiffVersion(null);
        }}
        version={diffVersion}
        currentState={getCurrentState()}
        onJumpToNode={onJumpToNode}
      />
    </aside>
  );
}

// =============================================================================
// Sub-componentes
// =============================================================================

interface VersionRowProps {
  version: PageVersion;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onCompare: () => void;
}

function VersionRow({
  version,
  expanded,
  busy,
  onToggle,
  onRestore,
  onDelete,
  onCompare,
}: VersionRowProps) {
  const nodes = version.state.nodes?.length ?? 0;
  const edges = version.state.edges?.length ?? 0;
  const frames =
    version.state.nodes?.filter((n) => n.type === 'frame').length ?? 0;
  const author = version.author_name || version.author_email?.split('@')[0] || 'Usuário';

  return (
    <li className="px-3 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-start gap-2"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900 truncate font-medium">
            {version.label || 'Snapshot'}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> {formatRelative(version.created_at)}
            </span>
            <span className="truncate">por {author}</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {frames} frame{frames === 1 ? '' : 's'} · {nodes} nodes · {edges} edges
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 flex items-center gap-1.5 ml-1">
          <button
            type="button"
            onClick={onCompare}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
            title="Mostra o que mudou entre esta versão e o estado atual"
          >
            <Diff size={12} /> Comparar
          </button>
          <button
            type="button"
            onClick={onRestore}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blip-purple hover:bg-blip-purple-dark rounded disabled:opacity-50"
          >
            <RotateCcw size={12} /> Restaurar
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
            title="Apagar versão"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </li>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="px-6 py-10 text-center">
      <FileText size={32} className="mx-auto text-gray-300 mb-2" />
      <p className="text-sm text-gray-700 font-medium">Nenhuma versão ainda</p>
      <p className="text-xs text-gray-500 mt-1 mb-4">
        Crie um snapshot manual ou aplique um template — versões são criadas automaticamente.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1 text-xs font-medium bg-blip-purple text-white px-3 py-1.5 rounded hover:bg-blip-purple-dark"
      >
        <Plus size={12} /> Criar primeiro snapshot
      </button>
    </div>
  );
}

// =============================================================================
// Helpers de data
// =============================================================================

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (sec < 30) return 'agora há pouco';
  if (sec < 60) return `${sec}s atrás`;
  if (min < 60) return `${min} min atrás`;
  if (hour < 24) return `${hour}h atrás`;
  if (day < 7) return `${day}d atrás`;
  return d.toLocaleDateString('pt-BR');
}
