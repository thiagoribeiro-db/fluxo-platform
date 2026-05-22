'use client';

import { useState, useTransition } from 'react';
import { createProject } from '@/lib/actions/projects';
import { track } from '@/lib/analytics/posthog';

export default function NewProjectButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createProject(formData);
        track('project_created');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-blip-purple text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blip-purple-dark transition shadow-sm"
      >
        + Novo projeto
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-1">Criar projeto</h2>
            <p className="text-sm text-gray-500 mb-4">
              Um nome curto e descritivo ajuda a achar depois.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nome
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex.: Chatbot MOK Generali"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blip-purple focus:outline-none focus:ring-2 focus:ring-blip-purple/20"
                  disabled={isPending}
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Descrição <span className="text-gray-400">(opcional)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  placeholder="Para que serve este fluxo?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blip-purple focus:outline-none focus:ring-2 focus:ring-blip-purple/20 resize-none"
                  disabled={isPending}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-blip-purple text-white px-5 py-2 text-sm font-semibold rounded-lg hover:bg-blip-purple-dark transition disabled:opacity-50"
                >
                  {isPending ? 'Criando…' : 'Criar e abrir editor →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
