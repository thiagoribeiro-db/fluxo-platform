'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import {
  addProjectCollaborator,
  removeProjectCollaborator,
  type ProjectCollaborator,
} from '@/lib/actions/project-collaborators';

interface Props {
  projectId: string;
  projectName: string;
  collaborators: ProjectCollaborator[];
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog para compartilhar um projeto com outros usuários da plataforma.
 * Permite adicionar por e-mail e remover colaboradores existentes.
 */
export default function ShareByEmailDialog({
  projectId,
  projectName,
  collaborators: initialCollaborators,
  open,
  onClose,
}: Props) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('edit');
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await addProjectCollaborator(projectId, email, permission);
      if (res.ok) {
        setSuccess(`✅ ${email} agora tem acesso ao projeto.`);
        setEmail('');
        // Recarrega lista (simplificado: só mostra feedback)
      } else {
        setError(res.error ?? 'Erro ao adicionar colaborador.');
      }
    });
  }

  async function handleRemove(collabId: string, userEmail: string) {
    const res = await removeProjectCollaborator(collabId, projectId);
    if (res.ok) {
      setCollaborators((prev) => prev.filter((c) => c.id !== collabId));
      setSuccess(`${userEmail} removido do projeto.`);
    } else {
      setError(res.error ?? 'Erro ao remover colaborador.');
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              🔗 Compartilhar projeto
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
              {projectName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Add by email */}
          <form onSubmit={handleAdd} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Adicionar pessoa por e-mail
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
                required
                disabled={isPending}
                className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg focus:border-blip-purple focus:outline-none focus:ring-1 focus:ring-blip-purple/30 disabled:opacity-50"
              />
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
                disabled={isPending}
                className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white text-gray-700 focus:border-blip-purple focus:outline-none cursor-pointer disabled:opacity-50"
              >
                <option value="edit">Pode editar</option>
                <option value="view">Só visualizar</option>
              </select>
              <button
                type="submit"
                disabled={isPending || !email.trim()}
                className="px-4 py-2 bg-blip-purple text-white text-sm font-medium rounded-lg hover:bg-blip-purple-dark disabled:opacity-40 transition-colors shrink-0"
              >
                {isPending ? '…' : 'Convidar'}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                {success}
              </p>
            )}
            <p className="text-xs text-gray-400">
              A pessoa precisa ter feito login na plataforma pelo menos uma vez.
            </p>
          </form>

          {/* Existing collaborators */}
          {collaborators.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Acessos ativos ({collaborators.length})
              </p>
              <ul className="space-y-2">
                {collaborators.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {c.profile?.avatar_url ? (
                        <Image
                          src={c.profile.avatar_url}
                          alt={c.profile.email}
                          width={24}
                          height={24}
                          className="rounded-full border border-gray-200 shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-blip-purple/10 flex items-center justify-center text-[10px] font-semibold text-blip-purple shrink-0">
                          {(c.profile?.display_name ?? c.profile?.email ?? '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {c.profile?.display_name ?? c.profile?.email}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {c.profile?.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-gray-500 bg-white border border-gray-200 rounded px-2 py-0.5">
                        {c.permission === 'edit' ? 'Edição' : 'Visualização'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(c.id, c.profile?.email ?? '')}
                        className="text-gray-400 hover:text-red-500 text-sm leading-none transition-colors"
                        title="Remover acesso"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
