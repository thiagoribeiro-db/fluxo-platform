'use client';

import { useState, useTransition } from 'react';
import type { ProjectPage } from '@/lib/types';
import {
  createPage,
  renamePage,
  deletePage,
  setActivePage,
  duplicatePage,
} from '@/lib/actions/pages';

interface PagesSidebarProps {
  projectId: string;
  pages: ProjectPage[];
  activePageId: string | null;
  /** Chamado quando o usuário troca de página — pai deve salvar atual + carregar nova. */
  onSwitchPage: (pageId: string) => void;
  /** Refetch lista de pages após mutação. */
  onPagesChanged: () => void;
}

/**
 * Sidebar superior esquerda — lista de páginas/versões do projeto
 * (ex: dev, hmg, prd, ou nomes custom).
 *
 * Ações:
 *  - Click → troca página ativa
 *  - + Nova → cria página em branco
 *  - ✎ → renomeia inline
 *  - ⎘ → duplica
 *  - ✕ → apaga (com confirm; não permite apagar última)
 */
export default function PagesSidebar({
  projectId,
  pages,
  activePageId,
  onSwitchPage,
  onPagesChanged,
}: PagesSidebarProps) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  function handleCreate() {
    const name = window.prompt(
      'Nome da nova página (ex: dev, hmg, prd):',
      'Nova página'
    );
    if (!name) return;
    startTransition(async () => {
      try {
        const newPage = await createPage(projectId, name);
        onPagesChanged();
        onSwitchPage(newPage.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao criar página');
      }
    });
  }

  function startEditing(page: ProjectPage) {
    setEditingId(page.id);
    setEditName(page.name);
  }

  function handleSaveRename() {
    if (!editingId || !editName.trim()) {
      setEditingId(null);
      return;
    }
    const id = editingId;
    const name = editName.trim();
    setEditingId(null);
    startTransition(async () => {
      try {
        await renamePage(id, name);
        onPagesChanged();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao renomear');
      }
    });
  }

  function handleDuplicate(pageId: string) {
    startTransition(async () => {
      try {
        const newPage = await duplicatePage(pageId);
        onPagesChanged();
        onSwitchPage(newPage.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao duplicar');
      }
    });
  }

  function handleDelete(page: ProjectPage) {
    if (pages.length <= 1) {
      alert('Não é possível apagar a última página do projeto.');
      return;
    }
    if (
      !window.confirm(
        `Apagar a página "${page.name}"?\n\nIsso vai deletar todos os nós e conexões dessa página. Não pode ser desfeito.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deletePage(page.id);
        onPagesChanged();
        // Se apagamos a ativa, o pai vai trocar pra outra (via reload da lista)
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao apagar');
      }
    });
  }

  function handleSwitch(page: ProjectPage) {
    if (page.id === activePageId) return;
    startTransition(async () => {
      try {
        await setActivePage(projectId, page.id);
        onSwitchPage(page.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao trocar página');
      }
    });
  }

  return (
    <aside className="w-full bg-white border-r border-gray-200 border-b flex flex-col shrink-0">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">Páginas</h2>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending}
          className="text-xs font-medium text-blip-purple hover:text-blip-purple-dark disabled:opacity-50"
          title="Criar nova página"
        >
          + Nova
        </button>
      </header>

      <ul className="overflow-y-auto py-1 max-h-48">
        {pages.map((page) => {
          const isActive = page.id === activePageId;
          const isEditing = editingId === page.id;

          if (isEditing) {
            return (
              <li key={page.id} className="px-2 py-1">
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleSaveRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    else if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="w-full text-sm px-2 py-1 border border-blip-purple rounded focus:outline-none focus:ring-1 focus:ring-blip-purple/30"
                />
              </li>
            );
          }

          return (
            <li key={page.id}>
              <div
                className={`group flex items-center gap-1 px-2 py-1.5 mx-1 rounded cursor-pointer ${
                  isActive
                    ? 'bg-blip-purple/10 text-blip-purple'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={() => handleSwitch(page)}
                title={page.name}
              >
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  {page.is_default && (
                    <span className="text-[9px] uppercase font-bold text-gray-400 shrink-0">
                      MAIN
                    </span>
                  )}
                  <span className="truncate text-sm font-medium">
                    {page.name}
                  </span>
                </div>

                {/* Ações — só aparecem ao hover */}
                <div className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(page);
                    }}
                    className="text-[11px] text-gray-400 hover:text-blip-purple px-1"
                    title="Renomear"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(page.id);
                    }}
                    className="text-[11px] text-gray-400 hover:text-blip-purple px-1"
                    title="Duplicar"
                  >
                    ⎘
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(page);
                    }}
                    className="text-[11px] text-gray-400 hover:text-red-600 px-1"
                    title="Apagar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
