'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  createShare,
  listShares,
  revokeShare,
  type Share,
} from '@/lib/actions/shares';
import type { SharePermission } from '@/lib/types';
import { confirmDialog } from '@/lib/utils/dialog';
import { track } from '@/lib/analytics/posthog';

interface ShareDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Modal "Compartilhar" — lista shares existentes do projeto, permite criar
 * novos com permissão configurável (view ou edit) e copiar/revogar.
 *
 * 'edit' usa RPC SECURITY DEFINER no save (ver migration 009) — usuário
 * anônimo via link consegue editar mesmo sem login.
 */
export default function ShareDialog({ projectId, open, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Permissão escolhida pro PRÓXIMO link a ser criado
  const [newPermission, setNewPermission] = useState<SharePermission>('view');

  // Carrega a lista quando o modal abre
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listShares(projectId)
      .then(setShares)
      .finally(() => setLoading(false));
  }, [open, projectId]);

  function makeUrl(token: string) {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/share/${token}`;
  }

  function handleCreate() {
    startTransition(async () => {
      const newShare = await createShare(projectId, newPermission);
      setShares((prev) => [newShare, ...prev]);
      track('shared_link_created', { permission: newPermission });
    });
  }

  function handleCopy(token: string, id: string) {
    navigator.clipboard.writeText(makeUrl(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleRevoke(shareId: string) {
    const ok = await confirmDialog({
      title: 'Revogar este link?',
      message: 'Quem tiver o link não conseguirá mais acessar o projeto.',
      confirmText: 'Revogar',
      variant: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      await revokeShare(shareId, projectId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-900">🔗 Compartilhar projeto</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Crie um link público para qualquer pessoa acessar este projeto.
          Não precisa ter conta.
        </p>

        {/* Seletor de permissão + botão de criar */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Permissão do novo link
          </label>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <PermissionPill
              active={newPermission === 'view'}
              onClick={() => setNewPermission('view')}
              icon="👁"
              label="Visualizar"
              desc="Só leitura"
              accent="gray"
            />
            <PermissionPill
              active={newPermission === 'comment'}
              onClick={() => setNewPermission('comment')}
              icon="💬"
              label="Comentar"
              desc="Lê + comenta"
              accent="amber"
            />
            <PermissionPill
              active={newPermission === 'edit'}
              onClick={() => setNewPermission('edit')}
              icon="✏️"
              label="Editar"
              desc="Acesso total"
              accent="purple"
            />
          </div>
          {newPermission === 'comment' && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
              💬 Cliente abre o link, vê o fluxo, comenta em blocos sem editar.
              Útil pra ciclo de revisão com cliente.
            </p>
          )}
          {newPermission === 'edit' && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
              ⚠️ Qualquer pessoa com esse link poderá EDITAR o projeto (mover,
              alterar textos, deletar nodes). Revogue quando não precisar mais.
            </p>
          )}
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="w-full bg-blip-purple text-white py-2 rounded-lg font-semibold hover:bg-blip-purple-dark transition disabled:opacity-50"
          >
            {isPending
              ? 'Criando…'
              : newPermission === 'edit'
                ? '+ Criar link de EDIÇÃO'
                : newPermission === 'comment'
                  ? '+ Criar link de comentário'
                  : '+ Criar link de visualização'}
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Links ativos
          </h3>

          {loading ? (
            <p className="text-sm text-gray-500 py-4 text-center">Carregando…</p>
          ) : shares.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              Nenhum link criado ainda
            </p>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-semibold tracking-wide bg-blip-purple/10 text-blip-purple px-2 py-0.5 rounded">
                      {share.permission === 'view'
                        ? '👁 Visualização'
                        : share.permission === 'comment'
                        ? '💬 Comentário'
                        : '✏️ Edição'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Criado em {new Date(share.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <input
                      readOnly
                      value={makeUrl(share.share_token)}
                      className="flex-1 px-2 py-1.5 text-xs font-mono bg-white border border-gray-200 rounded"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(share.share_token, share.id)}
                      className="px-2 py-1.5 text-xs font-medium bg-blip-purple text-white rounded hover:bg-blip-purple-dark whitespace-nowrap"
                    >
                      {copiedId === share.id ? '✓ Copiado' : 'Copiar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(share.id)}
                      className="px-2 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Revogar"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pill seletor de permissão (view/edit) — usado no header do dialog.
// ----------------------------------------------------------------------------
function PermissionPill({
  active,
  onClick,
  icon,
  label,
  desc,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  desc: string;
  accent: 'gray' | 'purple' | 'amber';
}) {
  const baseCls =
    'flex items-center gap-2 p-2 rounded-md border text-left transition';
  const activeCls =
    accent === 'purple'
      ? 'border-blip-purple bg-blip-purple/10 text-blip-purple'
      : accent === 'amber'
        ? 'border-amber-500 bg-amber-50 text-amber-700'
        : 'border-gray-400 bg-gray-100 text-gray-800';
  const inactiveCls =
    'border-gray-200 bg-white text-gray-600 hover:border-gray-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseCls} ${active ? activeCls : inactiveCls}`}
    >
      <span className="text-base leading-none">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[10px] opacity-75">{desc}</p>
      </div>
    </button>
  );
}
