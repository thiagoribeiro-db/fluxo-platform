'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createComponentSpec,
  updateComponentSpec,
  deleteComponentSpec,
  cloneComponentSpec,
  exportSpecsMarkdown,
  importSpecsMarkdownDiff,
  applySpecsImport,
  type ListedSpec,
  type ImportDiff,
} from '@/lib/actions/component-specs';
import type { ComponentSpec } from '@/lib/component-specs/spec-schema';
import { toast } from '@/lib/utils/errors';
import { confirmDialog } from '@/lib/utils/dialog';
import { formatTimeAgo, isRecent } from '@/lib/utils/time-ago';
import { hasUnseenUpdate, markSeen } from '@/lib/utils/seen-tracker';

interface ComponentsSectionProps {
  specs: ListedSpec[];
}

const CATEGORY_LABELS: Record<ComponentSpec['category'], string> = {
  messaging: 'Mensagens',
  navigation: 'Navegação',
  media: 'Mídias',
  integration: 'Integrações',
  ai: 'IA Generativa',
  structure: 'Estrutura',
  auto: 'Eventos automáticos',
};

const CATEGORY_ORDER: ComponentSpec['category'][] = [
  'messaging',
  'navigation',
  'media',
  'integration',
  'ai',
  'structure',
  'auto',
];

/**
 * Seção da dashboard que lista todos os componentes (builtins + customs +
 * overrides). Permite editar, clonar e deletar.
 *
 * Layout: lista agrupada por categoria. Cada card mostra ícone, nome,
 * descrição truncada e badge indicando origem (builtin / override / custom).
 *
 * Editor: modal full-screen com formulário pros campos principais do spec.
 */
export default function ComponentsSection({ specs }: ComponentsSectionProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<ListedSpec | null>(null);
  const [creating, setCreating] = useState(false);
  // ---- Export/Import state ----
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDiff, setImportDiff] = useState<ImportDiff | null>(null);
  const [applying, setApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const md = await exportSpecsMarkdown();
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `componentes-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        level: 'error',
        message: 'Falha ao exportar',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
    setExporting(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const diff = await importSpecsMarkdownDiff(text);
      setImportDiff(diff);
    } catch (err) {
      toast({
        level: 'error',
        message: 'Falha ao parsear',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    setImporting(false);
    // reset pra permitir re-importar o mesmo arquivo se necessário
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleApplyImport() {
    if (!importDiff) return;
    setApplying(true);
    try {
      const toUpdateMin = importDiff.toUpdate.map((u) => ({
        id: u.id,
        merged: u.merged,
      }));
      const res = await applySpecsImport(importDiff.toCreate, toUpdateMin);
      if (res.errors.length > 0) {
        toast({
          level: 'warn',
          message: `Aplicado com erros — ${res.created} criados, ${res.updated} atualizados`,
          detail: res.errors.join('\n'),
          duration: 10000,
        });
      } else {
        toast({
          level: 'success',
          message: `${res.created} criados, ${res.updated} atualizados.`,
        });
      }
      setImportDiff(null);
      router.refresh();
    } catch (err) {
      toast({
        level: 'error',
        message: 'Falha ao aplicar',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    setApplying(false);
  }

  const totalCount = specs.length;
  const builtinCount = specs.filter((s) => s.source === 'builtin').length;
  const overrideCount = specs.filter((s) => s.source === 'override').length;
  const customCount = specs.filter((s) => s.source === 'custom').length;

  // Conta specs com atualização não vista pelo user (vs lastSeen no
  // localStorage). Usado pra mostrar badge contador no botão "Atualizar".
  const unseenCount = useMemo(
    () =>
      specs.filter((s) =>
        hasUnseenUpdate('spec', s.data.id, s.updatedAt)
      ).length,
    [specs]
  );

  /** Re-busca do server (Server Component refetch) + invalida cache. */
  function handleRefresh() {
    router.refresh();
    toast({
      level: 'success',
      message: 'Componentes atualizados',
      detail: 'Última versão do servidor carregada.',
    });
  }

  /** Marca TODOS os specs como vistos AGORA — limpa todos os dots. */
  function markAllSeen() {
    const now = new Date().toISOString();
    for (const s of specs) {
      if (s.updatedAt) markSeen('spec', s.data.id, now);
    }
    toast({
      level: 'info',
      message: 'Tudo marcado como visto',
    });
    router.refresh();
  }

  // Agrupa por categoria respeitando a ordem canônica
  const byCategory = new Map<ComponentSpec['category'], ListedSpec[]>();
  for (const cat of CATEGORY_ORDER) byCategory.set(cat, []);
  for (const spec of specs) {
    const cat = spec.data.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(spec);
  }

  return (
    <section>
      {/* Header da seção */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">🧩</span> Componentes do fluxo
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} componente{totalCount === 1 ? '' : 's'} ·{' '}
            <span className="text-gray-600">{builtinCount} builtin</span>
            {overrideCount > 0 && (
              <>
                {' · '}
                <span className="text-amber-700">{overrideCount} editado</span>
              </>
            )}
            {customCount > 0 && (
              <>
                {' · '}
                <span className="text-emerald-700">{customCount} customizado</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botão "Atualizar" — força re-fetch + invalidação.
              Mostra dot/contador quando há specs com atualização não-vista. */}
          <button
            type="button"
            onClick={handleRefresh}
            className="relative border border-gray-300 hover:border-blip-purple/40 hover:text-blip-purple text-gray-700 px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-1.5"
            title={
              unseenCount > 0
                ? `${unseenCount} componente${unseenCount === 1 ? '' : 's'} atualizado${unseenCount === 1 ? '' : 's'} desde sua última visita`
                : 'Puxa a versão mais recente do servidor'
            }
          >
            <span>🔄</span> Atualizar
            {unseenCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse-subtle">
                {unseenCount}
              </span>
            )}
          </button>
          {unseenCount > 0 && (
            <button
              type="button"
              onClick={markAllSeen}
              className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
              title="Marca todas as atualizações como vistas"
            >
              marcar tudo como visto
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="border border-gray-300 hover:border-blip-purple/40 hover:text-blip-purple text-gray-700 px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50"
            title="Baixa um .md com todos os specs pra editar fora"
          >
            <span>📥</span> {exporting ? 'Exportando…' : 'Exportar'}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="border border-gray-300 hover:border-blip-purple/40 hover:text-blip-purple text-gray-700 px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50"
            title="Lê um .md editado e mostra o diff antes de aplicar"
          >
            <span>📤</span> {importing ? 'Lendo…' : 'Importar'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="bg-blip-purple hover:bg-blip-purple-dark text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-1.5"
          >
            <span>+</span> Novo componente
          </button>
        </div>
      </div>

      {/* Lista agrupada por categoria */}
      <div className="space-y-6 mt-6">
        {CATEGORY_ORDER.map((cat) => {
          const items = byCategory.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {CATEGORY_LABELS[cat]} · {items.length}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((spec) => (
                  <ComponentCard
                    key={spec.data.id}
                    spec={spec}
                    onEdit={() => setEditing(spec)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de edição */}
      {editing && (
        <ComponentEditor
          spec={editing}
          onClose={() => setEditing(null)}
          onCloneRequest={() => {
            // Clonar = abrir o "criar novo" pré-preenchido
            setCreating(true);
            setEditing(null);
          }}
        />
      )}

      {/* Modal de criação (vazio ou clone) */}
      {creating && (
        <ComponentEditor
          spec={null}
          cloneFrom={editing?.data}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {/* Modal de diff de import */}
      {importDiff && (
        <ImportDiffModal
          diff={importDiff}
          applying={applying}
          onCancel={() => setImportDiff(null)}
          onApply={handleApplyImport}
        />
      )}
    </section>
  );
}

// ============================================================================
// Modal de diff de import
// ============================================================================

function ImportDiffModal({
  diff,
  applying,
  onCancel,
  onApply,
}: {
  diff: ImportDiff;
  applying: boolean;
  onCancel: () => void;
  onApply: () => void;
}) {
  const totalChanges = diff.toCreate.length + diff.toUpdate.length;
  const nothingToDo = totalChanges === 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={applying ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              📋 Pré-visualização do import
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Confira o que será criado/atualizado antes de aplicar. Nada é
              alterado no banco até você clicar em <strong>Aplicar</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={applying}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {/* Avisos do parser */}
          {diff.warnings.length > 0 && (
            <DiffSection
              tone="amber"
              icon="⚠️"
              title={`Avisos do parser (${diff.warnings.length})`}
            >
              <ul className="space-y-1 text-sm text-amber-900">
                {diff.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </DiffSection>
          )}

          {/* A criar */}
          {diff.toCreate.length > 0 && (
            <DiffSection
              tone="emerald"
              icon="✨"
              title={`A criar (${diff.toCreate.length})`}
            >
              <ul className="space-y-1 text-sm text-emerald-900">
                {diff.toCreate.map((s) => (
                  <li key={s.id}>
                    <code className="font-mono text-xs">{s.id}</code>
                    {s.displayName && ` — ${s.displayName}`}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-emerald-700 mt-2 italic">
                Vão ser criados como <strong>customs</strong>. Você pode
                ajustar nodeType / fields via UI depois.
              </p>
            </DiffSection>
          )}

          {/* A atualizar */}
          {diff.toUpdate.length > 0 && (
            <DiffSection
              tone="purple"
              icon="✏️"
              title={`A atualizar (${diff.toUpdate.length})`}
            >
              <ul className="space-y-2 text-sm text-blip-purple-dark">
                {diff.toUpdate.map((u) => (
                  <li
                    key={u.id}
                    className="border-l-2 border-blip-purple/30 pl-3"
                  >
                    <div className="font-mono text-xs">{u.id}</div>
                    {u.diff.changes.length > 0 && (
                      <div className="text-xs text-gray-600 mt-0.5">
                        Campos: {u.diff.changes.join(', ')}
                      </div>
                    )}
                    {Object.keys(u.diff.fieldChanges).length > 0 && (
                      <div className="text-xs text-gray-600 mt-0.5">
                        Campos editados:{' '}
                        {Object.entries(u.diff.fieldChanges)
                          .map(([n, props]) => `${n} (${props.join('/')})`)
                          .join(', ')}
                      </div>
                    )}
                    {u.intent === 'create-override' && (
                      <div className="text-[10px] uppercase font-semibold text-amber-700 mt-0.5">
                        → vai criar override do builtin
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </DiffSection>
          )}

          {/* Sem mudanças */}
          {diff.unchanged.length > 0 && (
            <DiffSection
              tone="gray"
              icon="✓"
              title={`Sem mudanças (${diff.unchanged.length})`}
            >
              <p className="text-xs text-gray-600">
                {diff.unchanged.join(', ')}
              </p>
            </DiffSection>
          )}

          {/* Ausentes no arquivo */}
          {diff.missing.length > 0 && (
            <DiffSection
              tone="red"
              icon="🗒"
              title={`Ausentes no arquivo (${diff.missing.length})`}
            >
              <p className="text-sm text-red-900">
                Esses specs existem hoje mas não estavam no arquivo importado.
                Eles <strong>NÃO serão deletados</strong> — só estão sendo
                listados pra revisão:
              </p>
              <p className="text-xs text-red-800 mt-2 font-mono">
                {diff.missing.join(', ')}
              </p>
            </DiffSection>
          )}

          {nothingToDo && diff.warnings.length === 0 && (
            <p className="text-sm text-gray-500 italic text-center py-8">
              Tudo igual — nada a aplicar.
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={applying}
            className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={applying || nothingToDo}
            className="bg-blip-purple hover:bg-blip-purple-dark text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            {applying ? 'Aplicando…' : `Aplicar (${totalChanges})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function DiffSection({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'emerald' | 'purple' | 'amber' | 'red' | 'gray';
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  const styles: Record<typeof tone, string> = {
    emerald: 'bg-emerald-50 border-emerald-200',
    purple: 'bg-blip-purple/5 border-blip-purple/20',
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
    gray: 'bg-gray-50 border-gray-200',
  };
  return (
    <div className={`border rounded-lg p-3 ${styles[tone]}`}>
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-2">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

// ============================================================================
// Card de componente
// ============================================================================

function ComponentCard({
  spec,
  onEdit,
}: {
  spec: ListedSpec;
  onEdit: () => void;
}) {
  const { data, source, updatedAt } = spec;
  const badge =
    source === 'builtin'
      ? { label: 'builtin', cls: 'bg-gray-100 text-gray-600' }
      : source === 'override'
        ? { label: 'editado', cls: 'bg-amber-100 text-amber-800' }
        : { label: 'customizado', cls: 'bg-emerald-100 text-emerald-800' };

  // Sinalização "tem atualização não vista" — compara updated_at do DB com
  // a marcação local (localStorage) da última visita do user a este spec.
  const unseen = hasUnseenUpdate('spec', data.id, updatedAt);
  const recent = isRecent(updatedAt, { withinMs: 24 * 60 * 60_000 }); // 24h
  const timeAgo = formatTimeAgo(updatedAt);

  function handleClick() {
    // Ao abrir o editor, marca como visto — limpa o dot na próxima render.
    markSeen('spec', data.id, updatedAt ?? new Date().toISOString());
    onEdit();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative bg-white border rounded-xl p-4 hover:shadow-md transition text-left w-full group ${
        unseen
          ? 'border-rose-300 ring-1 ring-rose-100 hover:border-rose-400'
          : 'border-gray-200 hover:border-blip-purple/40'
      }`}
    >
      {/* Dot indicator "atualização não vista" — canto superior direito */}
      {unseen && (
        <span
          className="absolute -top-1 -right-1 z-10 flex items-center justify-center"
          title="Atualizado depois da sua última visita — clique pra ver"
          aria-label="Atualização não vista"
        >
          <span className="absolute inline-flex h-3 w-3 rounded-full bg-rose-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
        </span>
      )}

      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 leading-none">{data.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className="font-semibold text-gray-900 group-hover:text-blip-purple truncate">
              {data.displayName}
            </h4>
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.cls} shrink-0`}
            >
              {badge.label}
            </span>
          </div>
          <code className="text-[10px] text-gray-400 font-mono">{data.id}</code>
          <p className="text-xs text-gray-600 mt-2 line-clamp-2">
            {data.description.split('\n')[0]}
          </p>
          {/* Timestamp visível pros customs/overrides — builtin não tem
              porque não vem do DB. */}
          {timeAgo && (
            <p
              className={`text-[10px] mt-1.5 flex items-center gap-1 ${
                recent ? 'text-emerald-700 font-medium' : 'text-gray-400'
              }`}
              title={updatedAt}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  recent ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              />
              atualizado {timeAgo}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Editor (modal com formulário)
// ============================================================================

function ComponentEditor({
  spec,
  cloneFrom,
  onClose,
  onCloneRequest,
}: {
  spec: ListedSpec | null; // null = criando novo
  cloneFrom?: ComponentSpec;
  onClose: () => void;
  onCloneRequest?: () => void;
}) {
  const isEditing = spec !== null;
  const initialData = spec?.data ?? cloneFrom;

  // Form state
  const [id, setId] = useState(
    isEditing ? initialData!.id : `custom-${Date.now().toString(36).slice(-5)}`
  );
  const [displayName, setDisplayName] = useState(initialData?.displayName ?? 'Novo componente');
  const [icon, setIcon] = useState(initialData?.icon ?? '🧩');
  const [category, setCategory] = useState<ComponentSpec['category']>(
    initialData?.category ?? 'messaging'
  );
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [usageRules, setUsageRules] = useState<string[]>(initialData?.usageRules ?? []);
  const [detectionCues, setDetectionCues] = useState<string[]>(
    initialData?.detectionCues ?? []
  );
  const [commonMistakes, setCommonMistakes] = useState<string[]>(
    initialData?.commonMistakes ?? []
  );
  const [aiInstructions, setAiInstructions] = useState(initialData?.aiInstructions ?? '');

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const idLocked = spec?.source === 'builtin' || spec?.source === 'override';

  function handleSave() {
    setError(null);
    if (!displayName.trim()) {
      setError('Nome é obrigatório.');
      return;
    }
    if (!id.trim()) {
      setError('ID é obrigatório.');
      return;
    }

    // Monta o spec completo. Pra builtins/overrides, preserva campos que a UI
    // não edita (fields, builderRules, examples, nodeType, flowControl).
    const newSpec: ComponentSpec = {
      ...(initialData ?? {}),
      id: id.trim(),
      displayName: displayName.trim(),
      icon: icon.trim(),
      category,
      description: description.trim(),
      usageRules: usageRules.filter((r) => r.trim()),
      detectionCues: detectionCues.filter((c) => c.trim()),
      commonMistakes: commonMistakes.filter((m) => m.trim()),
      aiInstructions: aiInstructions.trim() || undefined,
      // Defaults pra customs novos sem esses campos
      nodeType: initialData?.nodeType ?? 'bubble-bot',
      flowControl: initialData?.flowControl ?? 'linear',
    };

    startTransition(async () => {
      try {
        if (isEditing) {
          await updateComponentSpec(spec!.data.id, newSpec);
        } else {
          await createComponentSpec(newSpec);
        }
        onClose();
        window.location.reload(); // força refetch
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao salvar');
      }
    });
  }

  async function handleDelete() {
    if (!spec || spec.source === 'builtin') return;
    const isRevert = spec.source === 'override';
    const ok = await confirmDialog({
      title: isRevert ? 'Reverter ao builtin?' : 'Deletar componente?',
      message: isRevert
        ? 'Isso descarta as customizações deste componente e volta pro builtin original.'
        : 'Isso apaga definitivamente o componente customizado.',
      confirmText: isRevert ? 'Reverter' : 'Deletar',
      variant: 'danger',
    });
    if (!ok) return;

    startTransition(async () => {
      try {
        await deleteComponentSpec(spec.data.id);
        onClose();
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao deletar');
      }
    });
  }

  function handleClone() {
    if (onCloneRequest) onCloneRequest();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{icon || '🧩'}</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isEditing ? 'Editar componente' : 'Novo componente'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEditing && spec
                  ? spec.source === 'builtin'
                    ? 'Builtin — editar criará um override'
                    : spec.source === 'override'
                      ? 'Override de builtin'
                      : 'Customizado'
                  : 'Criando do zero ou clonando'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </header>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-[1fr_1fr_70px_180px] gap-3">
            <Field label="ID (slug)" hint={idLocked ? 'Builtin — não pode mudar' : 'kebab-case, único'}>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                disabled={idLocked}
                placeholder="meu-componente"
                className={inputCls + ' font-mono ' + (idLocked ? 'opacity-60 cursor-not-allowed' : '')}
              />
            </Field>
            <Field label="Nome exibido">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Mensagem do Bot"
                className={inputCls}
              />
            </Field>
            <Field label="Ícone">
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🧩"
                className={inputCls + ' text-center'}
                maxLength={4}
              />
            </Field>
            <Field label="Categoria">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComponentSpec['category'])}
                className={inputCls}
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Descrição" hint="O que é e quando usar. Aparece no prompt da IA.">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Descrição completa do componente..."
              className={inputCls + ' resize-y'}
            />
          </Field>

          <ListField
            label="Regras de uso"
            hint="Bullets que a IA segue ao decidir o que emitir."
            items={usageRules}
            onChange={setUsageRules}
            placeholder="Ex: Cada parágrafo é uma bubble separada"
          />

          <ListField
            label="Pistas pra detecção"
            hint="Padrões textuais que indicam que esse componente deve ser usado."
            items={detectionCues}
            onChange={setDetectionCues}
            placeholder='Ex: Linhas começando com "Bot:"'
          />

          <ListField
            label="Erros comuns"
            hint="Coisas que a IA deve EVITAR."
            items={commonMistakes}
            onChange={setCommonMistakes}
            placeholder="Ex: Concatenar 2 bubbles numa só"
          />

          <Field label="Instruções extras pra IA (opcional)" hint="Texto livre apêndice no prompt.">
            <textarea
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
              rows={3}
              placeholder="Detalhes específicos sobre uso prioritário, casos especiais, etc."
              className={inputCls + ' resize-y'}
            />
          </Field>

          {/* Aviso pros campos não-editados aqui */}
          {isEditing && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
              💡 Campos avançados não editáveis aqui (fields, builderRules,
              examples, nodeType, flowControl) são preservados do spec original.
              Pra editá-los, mexa direto no YAML do componente.
            </div>
          )}
        </div>

        {/* Footer com ações */}
        <footer className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
          <div className="flex items-center gap-2">
            {isEditing && spec?.source !== 'builtin' && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="text-sm text-red-600 hover:text-red-700 px-2 py-1.5 rounded"
              >
                🗑️ {spec?.source === 'override' ? 'Reverter ao builtin' : 'Deletar'}
              </button>
            )}
            {isEditing && (
              <button
                type="button"
                onClick={handleClone}
                disabled={isPending}
                className="text-sm text-gray-600 hover:text-blip-purple px-2 py-1.5 rounded"
              >
                📋 Clonar como novo
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="bg-blip-purple hover:bg-blip-purple-dark text-white px-4 py-1.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            >
              {isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-componentes auxiliares
// ============================================================================

const inputCls =
  'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blip-purple focus:outline-none focus:ring-1 focus:ring-blip-purple/30';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700 mb-1 block">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-gray-500 mt-0.5 block">{hint}</span>}
    </label>
  );
}

function ListField({
  label,
  hint,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <textarea
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[idx] = e.target.value;
                onChange(next);
              }}
              rows={1}
              className={inputCls + ' resize-y text-xs'}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="text-gray-400 hover:text-red-600 text-sm leading-none px-1 mt-2"
              title="Remover"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="text-xs text-blip-purple hover:underline"
        >
          + Adicionar item
        </button>
      </div>
    </Field>
  );
}
