'use client';

import { useTransition } from 'react';
import { deleteProject } from '@/lib/actions/projects';
import { confirmDialog } from '@/lib/utils/dialog';
import { toast } from '@/lib/utils/errors';

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
}

export default function DeleteProjectButton({
  projectId,
  projectName,
}: DeleteProjectButtonProps) {
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    const ok = await confirmDialog({
      title: `Deletar "${projectName}"?`,
      message:
        'Isso é permanente — todos os nós, comentários e versões serão perdidos.',
      confirmText: 'Deletar',
      variant: 'danger',
    });
    if (!ok) return;

    startTransition(async () => {
      try {
        await deleteProject(projectId);
      } catch (err) {
        toast({
          level: 'error',
          message: err instanceof Error ? err.message : 'Erro ao deletar',
        });
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
