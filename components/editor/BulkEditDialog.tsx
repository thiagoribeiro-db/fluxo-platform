'use client';

/**
 * BulkEditDialog — edita os campos de texto dos N nodes selecionados em
 * massa, num lugar só. Pega `selectedIds`, extrai todos os campos editáveis
 * via `extractContentRows`, e apresenta uma lista de textareas. Salvar
 * aplica todos os patches numa única operação (1 pushHistory).
 *
 * Ações no header:
 *  - Travar todos / Destravar todos (data.locked)
 *  - Aplicar prefixo (acrescenta texto no início de cada label/text)
 *
 * Diferente da Tabela de Conteúdo geral, este é ESCOPADO aos selecionados
 * — útil pra editar 5 mensagens de um cenário sem distrair com o resto.
 */

import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { FluxoNode } from '@/lib/types';
import {
  extractContentRows,
  applyFieldPatch,
  type ContentRow,
} from '@/lib/content-table/extract-rows';
import { toast } from '@/lib/utils/errors';

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: FluxoNode[];
  selectedIds: string[];
  onApply: (
    patches: Array<{ nodeId: string; data: Record<string, unknown> }>
  ) => void;
}

export default function BulkEditDialog({
  open,
  onOpenChange,
  nodes,
  selectedIds,
  onApply,
}: BulkEditDialogProps) {
  // Linhas editáveis dos selecionados. Filtramos via Set pra O(1).
  const rows = useMemo<ContentRow[]>(() => {
    if (!open) return [];
    const idSet = new Set(selectedIds);
    return extractContentRows(nodes).filter((r) => idSet.has(r.nodeId));
  }, [open, nodes, selectedIds]);

  // Edições locais — chave = `${nodeId}:${fieldPath}`, valor = novo texto
  const [edits, setEdits] = useState<Record<string, string>>({});

  // Prefixo a adicionar aos labels (UX comum: "REVISAR: " ou emoji)
  const [prefix, setPrefix] = useState('');

  function rowKey(r: ContentRow) {
    return `${r.nodeId}:${r.fieldPath}`;
  }

  function getValue(r: ContentRow): string {
    const k = rowKey(r);
    return edits[k] !== undefined ? edits[k] : r.value;
  }

  function setRowValue(r: ContentRow, value: string) {
    setEdits((prev) => ({ ...prev, [rowKey(r)]: value }));
  }

  function applyPrefixToAll() {
    if (!prefix.trim()) return;
    setEdits((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        const cur = next[rowKey(r)] !== undefined ? next[rowKey(r)] : r.value;
        next[rowKey(r)] = `${prefix}${cur}`;
      }
      return next;
    });
    toast({ level: 'success', message: `Prefixo aplicado a ${rows.length} campos.` });
  }

  function clearEdits() {
    setEdits({});
  }

  // Constrói patches finais — agrupados por nodeId pra um único setNodes.
  function buildPatches() {
    // groupBy nodeId
    const byNode = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      const k = rowKey(r);
      if (edits[k] === undefined) continue;
      const existing = byNode.get(r.nodeId) ?? {};
      const orig = nodes.find((n) => n.id === r.nodeId)!.data as Record<
        string,
        unknown
      >;
      // Aplica patch acumulando — começa do data original do node, vai
      // sobrescrevendo a cada field path editado.
      const base = existing.__inited
        ? existing
        : ({ ...orig, __inited: true } as Record<string, unknown>);
      const patched = applyFieldPatch(base, r.fieldPath, edits[k]);
      byNode.set(r.nodeId, patched);
    }
    // Remove o sentinel __inited do data final
    const patches: Array<{ nodeId: string; data: Record<string, unknown> }> = [];
    for (const [nodeId, data] of byNode.entries()) {
      const cleaned = { ...data };
      delete cleaned.__inited;
      patches.push({ nodeId, data: cleaned });
    }
    return patches;
  }

  // Trava/destrava todos os selecionados (operação separada das edits de texto)
  function toggleLockAll(locked: boolean) {
    const patches = selectedIds
      .map((id) => {
        const n = nodes.find((nn) => nn.id === id);
        if (!n) return null;
        return {
          nodeId: id,
          data: { ...(n.data as Record<string, unknown>), locked },
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    onApply(patches);
    toast({
      level: 'success',
      message: `${patches.length} bloco(s) ${locked ? 'travado(s)' : 'destravado(s)'}.`,
    });
    onOpenChange(false);
  }

  function handleSave() {
    const patches = buildPatches();
    if (patches.length === 0) {
      toast({ level: 'info', message: 'Nada pra salvar — você não editou nenhum campo.' });
      return;
    }
    onApply(patches);
    toast({ level: 'success', message: `Aplicado em ${patches.length} bloco(s).` });
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(900px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Editar em massa — {selectedIds.length} bloco(s) · {rows.length} campo(s)
              </Dialog.Title>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Edite os textos abaixo. Salvar aplica tudo numa operação (Undo
                reverte de uma vez).
              </p>
            </div>
            <Dialog.Close
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Fechar"
            >
              ✕
            </Dialog.Close>
          </div>

          {/* Ações em massa */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="prefixo (ex: REVISAR: )"
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={applyPrefixToAll}
                disabled={!prefix.trim()}
                className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Aplicar prefixo
              </button>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => toggleLockAll(true)}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                title="Trava os blocos selecionados (impede edição/apagar)"
              >
                🔒 Travar todos
              </button>
              <button
                type="button"
                onClick={() => toggleLockAll(false)}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                🔓 Destravar todos
              </button>
            </div>
          </div>

          {/* Lista de campos editáveis */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhum campo editável nos blocos selecionados.
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div
                    key={rowKey(r)}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono">{r.code ?? r.nodeId.slice(0, 8)}</span>
                      <span>·</span>
                      <span>{r.nodeType}</span>
                      <span>·</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {r.fieldLabel}
                      </span>
                    </div>
                    <textarea
                      value={getValue(r)}
                      onChange={(e) => setRowValue(r, e.target.value)}
                      rows={2}
                      className="w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
            <button
              type="button"
              onClick={clearEdits}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Limpar edições
            </button>
            <Dialog.Close className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">
              Cancelar
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSave}
              disabled={Object.keys(edits).length === 0}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Salvar {Object.keys(edits).length > 0 ? `(${Object.keys(edits).length})` : ''}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
