'use client';

import { useState, useTransition } from 'react';
import {
  createComponentSpec,
  updateComponentSpec,
  deleteComponentSpec,
  cloneComponentSpec,
  type ListedSpec,
} from '@/lib/actions/component-specs';
import type { ComponentSpec } from '@/lib/component-specs/spec-schema';

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
  const [editing, setEditing] = useState<ListedSpec | null>(null);
  const [creating, setCreating] = useState(false);

  const totalCount = specs.length;
  const builtinCount = specs.filter((s) => s.source === 'builtin').length;
  const overrideCount = specs.filter((s) => s.source === 'override').length;
  const customCount = specs.filter((s) => s.source === 'custom').length;

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
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="bg-blip-purple hover:bg-blip-purple-dark text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-1.5"
        >
          <span>+</span> Novo componente
        </button>
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
    </section>
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
  const { data, source } = spec;
  const badge =
    source === 'builtin'
      ? { label: 'builtin', cls: 'bg-gray-100 text-gray-600' }
      : source === 'override'
        ? { label: 'editado', cls: 'bg-amber-100 text-amber-800' }
        : { label: 'customizado', cls: 'bg-emerald-100 text-emerald-800' };

  return (
    <button
      type="button"
      onClick={onEdit}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blip-purple/40 transition text-left w-full group"
    >
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

  function handleDelete() {
    if (!spec || spec.source === 'builtin') return;
    const verb = spec.source === 'override' ? 'reverter ao builtin' : 'deletar definitivamente';
    if (!window.confirm(`Tem certeza que deseja ${verb}?`)) return;

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
