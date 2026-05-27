'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { updateUserRole } from '@/lib/actions/access';
import { ROLE_LABELS, type PlatformRole } from '@/lib/auth/role-constants';
import type { PlatformUser } from '@/lib/actions/access';

const ROLE_COLORS: Record<PlatformRole, string> = {
  editor: 'bg-gray-100 text-gray-700',
  admin: 'bg-blue-100 text-blue-700',
  superAdmin: 'bg-blip-purple/10 text-blip-purple font-semibold',
};

interface Props {
  users: PlatformUser[];
  myRole: PlatformRole;
  myId: string;
}

/**
 * Seção de Gerenciamento de Acessos.
 * Visível apenas para admin e superAdmin.
 * Apenas superAdmin pode alterar roles.
 */
export default function AccessManagement({ users, myRole, myId }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isSuperAdmin = myRole === 'superAdmin';

  function handleRoleChange(userId: string, newRole: PlatformRole) {
    setFeedback(null);
    setPendingId(userId);
    startTransition(async () => {
      const res = await updateUserRole(userId, newRole);
      setFeedback({
        id: userId,
        ok: res.ok,
        msg: res.ok ? 'Perfil atualizado.' : (res.error ?? 'Erro desconhecido.'),
      });
      setPendingId(null);
    });
  }

  return (
    <section className="border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          👥 Gerenciamento de Acessos
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Todos os usuários cadastrados na plataforma.
          {isSuperAdmin
            ? ' Como Super Admin, você pode alterar o perfil de qualquer usuário.'
            : ' Apenas Super Admins podem alterar perfis.'}
        </p>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nenhum usuário encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Usuário</th>
                <th className="pb-2 font-medium">E-mail</th>
                <th className="pb-2 font-medium">Perfil</th>
                {isSuperAdmin && <th className="pb-2 font-medium">Ação</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => {
                const isMe = u.id === myId;
                const isBusy = pendingId === u.id && isPending;
                return (
                  <tr key={u.id} className="group">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        {u.avatar_url ? (
                          <Image
                            src={u.avatar_url}
                            alt={u.display_name ?? u.email}
                            width={28}
                            height={28}
                            className="rounded-full border border-gray-200"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-blip-purple/10 flex items-center justify-center text-xs font-semibold text-blip-purple shrink-0">
                            {(u.display_name ?? u.email)[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-gray-900 truncate max-w-[140px]">
                          {u.display_name ?? u.email.split('@')[0]}
                          {isMe && (
                            <span className="ml-1 text-[10px] text-gray-400">(você)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-500 truncate max-w-[200px]">
                      {u.email}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${ROLE_COLORS[u.platform_role as PlatformRole]}`}
                      >
                        {ROLE_LABELS[u.platform_role as PlatformRole] ?? u.platform_role}
                      </span>
                    </td>

                    {isSuperAdmin && (
                      <td className="py-3">
                        {isMe ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : (
                          <RoleSelect
                            currentRole={u.platform_role as PlatformRole}
                            disabled={isBusy}
                            onChange={(r) => handleRoleChange(u.id, r)}
                          />
                        )}
                        {feedback?.id === u.id && (
                          <p
                            className={`text-[11px] mt-1 ${feedback.ok ? 'text-emerald-600' : 'text-red-600'}`}
                          >
                            {feedback.msg}
                          </p>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          <strong>Novos usuários:</strong> compartilhe o link de acesso{' '}
          <code className="bg-gray-100 px-1 rounded">
            {typeof window !== 'undefined' ? window.location.origin : ''}/login
          </code>{' '}
          para que entrem com o Google. Eles aparecem aqui com perfil{' '}
          <strong>Edição</strong> e podem ser promovidos por um Super Admin.
        </p>
      </div>
    </section>
  );
}

function RoleSelect({
  currentRole,
  disabled,
  onChange,
}: {
  currentRole: PlatformRole;
  disabled: boolean;
  onChange: (r: PlatformRole) => void;
}) {
  const roles: PlatformRole[] = ['editor', 'admin', 'superAdmin'];
  return (
    <select
      value={currentRole}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as PlatformRole)}
      className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 hover:border-blip-purple focus:border-blip-purple focus:outline-none disabled:opacity-40 cursor-pointer"
    >
      {roles.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}
