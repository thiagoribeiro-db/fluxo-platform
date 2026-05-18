'use client';

import { useTransition } from 'react';
import { deleteProject } from '@/lib/actions/projects';

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
}

export default function DeleteProjectButton({
  projectId,
  projectName,
}: DeleteProjectButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const ok = window.confirm(
      `Deletar "${projectName}"?\n\nIsso é permanente — todos os nós, comentários e versões serão perdidos.`
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        await deleteProject(projectId);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao deletar');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="text-xs text-gray-400 hover:text-red-600 transition disabled:opacity-50"
      title="Deletar projeto"
    >
      {isPending ? 'Deletando…' : '🗑️'}
    </button>
  );
}
