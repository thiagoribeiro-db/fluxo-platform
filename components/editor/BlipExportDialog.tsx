'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { listPages } from '@/lib/actions/pages';
import type { ProjectPage } from '@/lib/types';
import {
  exportProjectToBlip,
  type ExportFrameResult,
  type PageState,
} from '@/lib/export/blip-exporter';
import { buildBlipZip, triggerDownload } from '@/lib/export/blip-zip';

interface BlipExportDialogProps {
  projectId: string;
  projectName: string;
  /** Estado atual da página aberta (pra refletir mudanças não-salvas). */
  currentPageId?: string;
  currentNodes?: PageState['nodes'];
  currentEdges?: PageState['edges'];
  onClose: () => void;
}

/**
 * Modal de export pra Blip:
 *  1. Lista todas as pages do projeto com checkbox (selecionar quais incluir).
 *  2. Pre-validação: lista warnings (frames vazios, direcionamentos sem target, etc.).
 *  3. Botão "Exportar .zip" → gera zip client-side e baixa.
 *
 * O frame PRINCIPAL é o primeiro frame da primeira page selecionada (regra
 * combinada com o usuário).
 */
export default function BlipExportDialog({
  projectId,
  projectName,
  currentPageId,
  currentNodes,
  currentEdges,
  onClose,
}: BlipExportDialogProps) {
  const [pages, setPages] = useState<ProjectPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{
    files: ExportFrameResult[];
    warnings: string[];
  } | null>(null);

  // Carrega pages
  useEffect(() => {
    setLoading(true);
    listPages(projectId)
      .then((list) => {
        setPages(list);
        // Default: TODAS marcadas
        setSelectedPageIds(new Set(list.map((p) => p.id)));
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  function togglePage(id: string) {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedPageIds(new Set(pages.map((p) => p.id)));
  }
  function selectNone() {
    setSelectedPageIds(new Set());
  }

  /** Pages como `PageState[]` (estrutura aceita pelo exporter), refletindo mudanças não-salvas da page atual. */
  const pagesToExport = useMemo<PageState[]>(() => {
    return pages
      .filter((p) => selectedPageIds.has(p.id))
      .map((p) => {
        if (p.id === currentPageId && currentNodes && currentEdges) {
          // Use current state em memória (pode ter edits não salvos)
          return {
            id: p.id,
            title: p.name,
            nodes: currentNodes,
            edges: currentEdges,
          };
        }
        const state = p.state ?? { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
        return {
          id: p.id,
          title: p.name,
          nodes: state.nodes,
          edges: state.edges,
        };
      });
  }, [pages, selectedPageIds, currentPageId, currentNodes, currentEdges]);

  function handlePreview() {
    if (pagesToExport.length === 0) {
      alert('Selecione pelo menos 1 page pra exportar.');
      return;
    }
    startTransition(() => {
      const result = exportProjectToBlip(pagesToExport);
      setPreview(result);
    });
  }

  async function handleDownload() {
    if (!preview) return;
    try {
      const blob = await buildBlipZip(preview.files, true);
      const date = new Date().toISOString().slice(0, 10);
      const safeName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      triggerDownload(blob, `blip-${safeName}-${date}.zip`);
    } catch (e) {
      alert(
        'Falha ao gerar .zip: ' + (e instanceof Error ? e.message : String(e))
      );
    }
  }

  // Stats do preview
  const totalFrames = preview?.files.length ?? 0;
  const totalWarnings = preview?.warnings.length ?? 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              📦 Exportar pra Blip
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Gera um .zip com 1 arquivo .json por frame, pronto pra importar
              na plataforma Blip.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {/* Lista de pages */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Pages do projeto
              </h3>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-blip-purple hover:underline"
                >
                  Marcar todas
                </button>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-blip-purple hover:underline"
                >
                  Desmarcar todas
                </button>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500 py-4 text-center">Carregando…</p>
            ) : pages.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                Nenhuma page no projeto.
              </p>
            ) : (
              <div className="space-y-1 border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto">
                {pages.map((p, idx) => {
                  const checked = selectedPageIds.has(p.id);
                  const frameCount =
                    (p.state?.nodes ?? []).filter((n) => n.type === 'frame').length;
                  const isFirst = idx === 0 && checked;
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePage(p.id)}
                        className="accent-blip-purple"
                      />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-xs text-gray-400">
                        {frameCount} frame{frameCount === 1 ? '' : 's'}
                      </span>
                      {isFirst && (
                        <span className="text-[10px] uppercase font-semibold bg-blip-purple/10 text-blip-purple px-1.5 py-0.5 rounded">
                          principal
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              🏠 O <strong>primeiro frame</strong> da primeira page marcada vira
              o <strong>bot principal</strong> (com Requirements + Redirect-To-Services).
            </p>
          </section>

          {/* Preview / warnings */}
          {preview && (
            <section className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Preview do export
              </h3>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <Stat
                  label="Arquivos .json"
                  value={totalFrames}
                  tone="purple"
                />
                <Stat
                  label="Avisos"
                  value={totalWarnings}
                  tone={totalWarnings > 0 ? 'amber' : 'gray'}
                />
              </div>

              {/* Lista de arquivos */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-3 max-h-32 overflow-y-auto">
                {preview.files.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">
                    Nenhum frame nas pages selecionadas.
                  </p>
                ) : (
                  <ul className="text-xs text-gray-700 font-mono space-y-0.5">
                    {preview.files.map((f) => (
                      <li key={f.filename}>📄 {f.filename}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Warnings */}
              {totalWarnings > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-amber-900 mb-1.5">
                    ⚠️ Avisos (não bloqueiam o export)
                  </h4>
                  <ul className="text-xs text-amber-800 space-y-1 max-h-32 overflow-y-auto">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {selectedPageIds.size} page{selectedPageIds.size === 1 ? '' : 's'}{' '}
            marcadas
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            {!preview ? (
              <button
                type="button"
                onClick={handlePreview}
                disabled={isPending || selectedPageIds.size === 0}
                className="bg-blip-purple hover:bg-blip-purple-dark text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                {isPending ? 'Processando…' : 'Pré-visualizar'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  ← Voltar
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={totalFrames === 0}
                  className="bg-blip-purple hover:bg-blip-purple-dark text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
                >
                  📥 Baixar .zip
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'purple' | 'amber' | 'gray';
}) {
  const toneCls: Record<typeof tone, string> = {
    purple: 'bg-blip-purple/10 text-blip-purple',
    amber: 'bg-amber-50 text-amber-900',
    gray: 'bg-gray-50 text-gray-600',
  };
  return (
    <div className={`rounded-lg p-2 ${toneCls[tone]}`}>
      <div className="text-xs uppercase tracking-wide opacity-75">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
