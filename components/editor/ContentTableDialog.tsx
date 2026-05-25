'use client';

/**
 * Tabela de conteúdo — modal full-width que lista TODOS os textos editáveis
 * do fluxo (bubbles, menus, condicionais, etc.) em formato planilha.
 *
 * Caso de uso: copywriter atualiza dezenas de textos sem mexer no canvas.
 * Filtros por tipo e frame ajudam a focar (ex: "só os menus", "só Saudação").
 * Click numa linha jumpa pro bloco no canvas (depois de fechar o modal).
 *
 * Edição: textarea inline com salvamento on blur (ou Enter sem shift em
 * single-line). Empty value é permitido — apaga o texto.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Search, Table2, Upload, X } from 'lucide-react';
import { confirmDialog } from '@/lib/utils/dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  applyFieldPatch,
  extractContentRows,
  type ContentRow,
  TABLE_NODE_TYPES,
} from '@/lib/content-table/extract-rows';
import type { FluxoNode, FluxoNodeData } from '@/lib/types';
import { toast } from '@/lib/utils/errors';

interface ContentTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: FluxoNode[];
  /** Aplica patch parcial em node.data — pai resolve o setNodes. */
  onUpdate: (nodeId: string, patch: Partial<FluxoNodeData>) => void;
  /** Navega pro bloco no canvas (fecha o modal antes). */
  onJumpToNode?: (nodeId: string) => void;
}

export default function ContentTableDialog({
  open,
  onOpenChange,
  nodes,
  onUpdate,
  onJumpToNode,
}: ContentTableDialogProps) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | 'all'>('all');
  const [frameFilter, setFrameFilter] = useState<string | 'all'>('all');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setTypeFilter('all');
      setFrameFilter('all');
    }
  }, [open]);

  // Frames disponíveis pro filtro
  const frames = useMemo(() => {
    return nodes
      .filter((n) => n.type === 'frame')
      .map((f) => ({
        id: (f.data?.frameId as string) || f.id,
        label: (f.data?.title as string) || (f.data?.frameId as string) || 'Frame',
        prefix: f.data?.prefix as string | undefined,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [nodes]);

  const rows = useMemo(
    () =>
      extractContentRows(nodes, {
        query,
        types: typeFilter === 'all' ? undefined : [typeFilter],
        frameId:
          frameFilter === 'all'
            ? undefined
            : frameFilter === 'none'
              ? null
              : frameFilter,
      }),
    [nodes, query, typeFilter, frameFilter]
  );

  function handleCellChange(row: ContentRow, newValue: string) {
    if (newValue === row.value) return; // sem mudança
    // Constrói o patch correto (suporta options[idx])
    const fakeData: Record<string, unknown> = {};
    // Pra arrays, precisamos do array atual completo
    if (row.fieldPath.includes('[')) {
      const node = nodes.find((n) => n.id === row.nodeId);
      const arrKey = row.fieldPath.split('[')[0];
      const currentArr = (node?.data?.[arrKey] as string[]) ?? [];
      fakeData[arrKey] = currentArr;
    }
    const patched = applyFieldPatch(fakeData, row.fieldPath, newValue);
    onUpdate(row.nodeId, patched as Partial<FluxoNodeData>);
  }

  function handleJump(row: ContentRow) {
    if (!onJumpToNode) return;
    onOpenChange(false);
    setTimeout(() => onJumpToNode(row.nodeId), 100);
  }

  function exportCsv() {
    // Exporta colunas estáveis pra round-trip: nodeId + fieldPath são chaves
    // que o import usa pra match exato. Posições adicionais (frame, code, tipo,
    // campo) são pra humano ler.
    const header = ['nodeId', 'fieldPath', 'frame', 'code', 'tipo', 'campo', 'valor'];
    const escape = (v: string) =>
      `"${(v ?? '').replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
    // BOM UTF-8 + separador `;` — Excel BR abre direto com acentos OK.
    const csv = [
      header.join(';'),
      ...rows.map((r) =>
        [r.nodeId, r.fieldPath, r.frameLabel, r.code ?? '', r.nodeType, r.fieldLabel, r.value]
          .map(escape)
          .join(';')
      ),
    ].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conteudo-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ level: 'success', message: `${rows.length} linhas exportadas (CSV)` });
  }

  // Import: aceita .xlsx ou .csv exportado por nós. Match por (nodeId,
  // fieldPath) — colunas obrigatórias no arquivo. Conta diffs antes de aplicar
  // e pede confirmação pro user revisar quantos campos vão mudar.
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(file: File) {
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
        defval: '',
        // header: 1 → array de arrays. Usamos default (objetos com header da 1ª linha).
      });
      if (data.length === 0) {
        toast({ level: 'warn', message: 'Planilha vazia ou sem header.' });
        return;
      }

      // Validar colunas mínimas
      const first = data[0];
      if (!('nodeId' in first) || !('fieldPath' in first) || !('valor' in first)) {
        toast({
          level: 'error',
          message:
            'Planilha sem colunas obrigatórias. Esperado: nodeId, fieldPath, valor (exporte primeiro do botão CSV/Excel).',
        });
        return;
      }

      // Index dos rows atuais pra match rápido
      const currentByKey = new Map<string, ContentRow>();
      for (const r of rows) {
        currentByKey.set(`${r.nodeId}::${r.fieldPath}`, r);
      }

      // Coleta diffs reais (valor mudou)
      const updates: Array<{ row: ContentRow; newValue: string }> = [];
      let skippedUnknown = 0;
      for (const r of data) {
        const key = `${r.nodeId}::${r.fieldPath}`;
        const cur = currentByKey.get(key);
        if (!cur) {
          skippedUnknown++;
          continue;
        }
        const newValue = (r.valor ?? '').toString();
        if (newValue !== cur.value) {
          updates.push({ row: cur, newValue });
        }
      }

      if (updates.length === 0) {
        toast({
          level: 'info',
          message: `Nenhuma diferença encontrada. ${skippedUnknown > 0 ? `${skippedUnknown} linhas não bateram com nenhum bloco do projeto.` : ''}`,
        });
        return;
      }

      const ok = await confirmDialog({
        title: 'Aplicar edições da planilha?',
        message: `${updates.length} campo(s) vão ser atualizado(s).${skippedUnknown > 0 ? ` ${skippedUnknown} linha(s) ignorada(s) (nodeId/fieldPath inexistentes).` : ''} Pode desfazer com Ctrl+Z.`,
        confirmText: `Aplicar ${updates.length} edição(ões)`,
      });
      if (!ok) return;

      // Aplica em batch — uma chamada por nodeId pra não chamar setNodes N×
      // (`onUpdate` faz merge no parent). Mas como podemos ter vários campos
      // por node, mesclamos antes.
      const patchesByNode = new Map<string, Record<string, unknown>>();
      for (const u of updates) {
        const existing = patchesByNode.get(u.row.nodeId) ?? {};
        // Pra arrays (options[N]), precisamos do array atual completo.
        const node = nodes.find((n) => n.id === u.row.nodeId);
        let basis = existing;
        if (u.row.fieldPath.includes('[') && Object.keys(existing).length === 0) {
          const arrKey = u.row.fieldPath.split('[')[0];
          basis = { ...existing, [arrKey]: (node?.data?.[arrKey] as string[]) ?? [] };
        }
        const next = applyFieldPatch(basis, u.row.fieldPath, u.newValue);
        patchesByNode.set(u.row.nodeId, next);
      }
      for (const [nodeId, patch] of patchesByNode.entries()) {
        onUpdate(nodeId, patch as Partial<FluxoNodeData>);
      }

      toast({
        level: 'success',
        message: `${updates.length} campo(s) atualizado(s) em ${patchesByNode.size} bloco(s).`,
      });
    } catch (err) {
      toast({
        level: 'error',
        message: `Falha ao importar: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
      });
    }
  }

  async function exportXlsx() {
    // Dynamic import: `xlsx` é ~600kb minified, só baixa quando usuário clica.
    const XLSX = await import('xlsx');
    const data = [
      ['nodeId', 'fieldPath', 'frame', 'code', 'tipo', 'campo', 'valor'],
      ...rows.map((r) => [
        r.nodeId,
        r.fieldPath,
        r.frameLabel,
        r.code ?? '',
        r.nodeType,
        r.fieldLabel,
        r.value,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Larguras humanas em chars (col widths em "wch")
    ws['!cols'] = [
      { wch: 18 }, // nodeId
      { wch: 16 }, // fieldPath
      { wch: 22 }, // frame
      { wch: 10 }, // code
      { wch: 16 }, // tipo
      { wch: 16 }, // campo
      { wch: 60 }, // valor (cresce com texto longo)
    ];
    // Freeze do header — `!freeze` é uma prop documentada do xlsx mas
    // não está nos types oficiais. Anotamos como Record<string, unknown>
    // pra setar sem forçar o tipo do worksheet inteiro.
    (ws as unknown as Record<string, { xSplit: number; ySplit: number }>)[
      '!freeze'
    ] = { xSplit: 0, ySplit: 1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Conteúdo');
    XLSX.writeFile(wb, `conteudo-${Date.now()}.xlsx`);
    toast({ level: 'success', message: `${rows.length} linhas exportadas (Excel)` });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] sm:w-[96vw] h-[95vh] sm:max-w-[1800px] dark:bg-gray-900 flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 dark:text-white">
            <Table2 size={18} className="text-blip-purple" /> Tabela de conteúdo
          </DialogTitle>
          <DialogDescription className="mt-1 dark:text-gray-400">
            Edita todas as mensagens, menus, labels e títulos do fluxo em formato planilha. Click ↗ navega até o bloco no canvas.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar de filtros — todos na mesma linha, busca cresce */}
        <div className="shrink-0 px-5 pb-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px] border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800">
            <Search size={13} className="text-gray-400 dark:text-gray-500 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar texto, código, frame…"
              className="flex-1 bg-transparent text-sm outline-none dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
                title="Limpar busca"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white shrink-0"
            title="Filtrar por tipo"
          >
            <option value="all">Todos os tipos</option>
            {TABLE_NODE_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.emoji} {t.label}
              </option>
            ))}
          </select>
          <select
            value={frameFilter}
            onChange={(e) => setFrameFilter(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white shrink-0 max-w-[180px]"
            title="Filtrar por frame"
          >
            <option value="all">Todos os frames</option>
            {frames.map((f) => (
              <option key={f.id} value={f.id}>
                {f.prefix ? `[${f.prefix}] ` : ''}{f.label}
              </option>
            ))}
            <option value="none">— Sem frame —</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="text-xs px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1 disabled:opacity-40 shrink-0"
            title="Exportar como CSV (UTF-8 BOM + separador ;, compatível Excel BR)"
          >
            <Download size={13} /> CSV
          </button>
          <button
            type="button"
            onClick={exportXlsx}
            disabled={rows.length === 0}
            className="text-xs px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1 disabled:opacity-40 shrink-0"
            title="Exportar como Excel (.xlsx) com colunas formatadas e header fixo"
          >
            <Download size={13} /> Excel
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1 shrink-0"
            title="Importar planilha (.xlsx ou .csv) — atualiza textos pelo nodeId+fieldPath"
          >
            <Upload size={13} /> Importar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              // Reset pra permitir o mesmo arquivo de novo
              e.target.value = '';
            }}
          />
          <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0 ml-1 tabular-nums">
            {rows.length} {rows.length === 1 ? 'linha' : 'linhas'}
          </span>
        </div>

        {/* Tabela — table-fixed deixa a coluna TEXTO esticar e usar todo
            espaço disponível, enquanto as outras ficam com largura fixa. */}
        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum texto encontrado com esses filtros.
            </div>
          ) : (
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: 180 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 170 }} />
                <col />
                <col style={{ width: 48 }} />
              </colgroup>
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
                <tr className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="text-left px-3 py-2 font-semibold">Frame</th>
                  <th className="text-left px-3 py-2 font-semibold">Código</th>
                  <th className="text-left px-3 py-2 font-semibold">Tipo · Campo</th>
                  <th className="text-left px-3 py-2 font-semibold">Texto</th>
                  <th aria-label="Ações"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ContentRow
                    key={`${row.nodeId}-${row.fieldPath}`}
                    row={row}
                    onChange={(v) => handleCellChange(row, v)}
                    onJump={() => handleJump(row)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 px-5 py-2 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400">
          💡 Edição salva automaticamente ao sair do campo (blur) ou Tab. Esc fecha o modal.
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// LINHA EDITÁVEL
// =============================================================================

interface ContentRowProps {
  row: ContentRow;
  onChange: (newValue: string) => void;
  onJump: () => void;
}

function ContentRow({ row, onChange, onJump }: ContentRowProps) {
  const [draft, setDraft] = useState(row.value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sincroniza se o value externo mudar (ex: undo do user em outro lugar)
  useEffect(() => {
    setDraft(row.value);
  }, [row.value]);

  // Auto-resize do textarea pra caber o conteúdo (cresce até max-h)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [draft]);

  function commit() {
    if (draft !== row.value) {
      onChange(draft);
    }
  }

  // Heurística pra "Enter salva" — só em labels curtos. Campos longos
  // (text, condition, caption) deixam Enter quebrar linha normalmente.
  const isLongField =
    row.fieldPath === 'text' ||
    row.fieldPath === 'condition' ||
    row.fieldPath === 'caption' ||
    row.fieldPath === 'linkDescription';

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 group">
      <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 align-top">
        <div className="flex items-center gap-1.5 min-w-0">
          {row.framePrefix && (
            <span className="inline-flex items-center justify-center text-[9px] font-mono font-bold text-white bg-blip-purple px-1 py-0 rounded shrink-0 min-w-[22px]">
              {row.framePrefix}
            </span>
          )}
          <span className="truncate" title={row.frameLabel}>
            {row.frameLabel}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-[11px] font-mono text-gray-500 dark:text-gray-400 align-top">
        {row.code ?? '—'}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 align-top">
        <div className="flex items-baseline gap-1">
          <span className="shrink-0">{row.emoji}</span>
          <span className="truncate text-gray-500 dark:text-gray-400" title={row.fieldLabel}>
            {row.fieldLabel}
          </span>
        </div>
      </td>
      <td className="px-3 py-1.5 align-top">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isLongField) {
              e.preventDefault();
              commit();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          rows={1}
          className="block w-full text-sm leading-snug bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-blip-purple focus:bg-white dark:focus:bg-gray-800 dark:text-white rounded px-2 py-1 outline-none resize-none overflow-hidden whitespace-pre-wrap break-words"
        />
      </td>
      <td className="px-2 py-2 text-right align-top">
        <button
          type="button"
          onClick={onJump}
          className="opacity-0 group-hover:opacity-100 text-base text-blip-purple hover:text-blip-purple-dark transition"
          title="Ir até este bloco no canvas"
        >
          ↗
        </button>
      </td>
    </tr>
  );
}
