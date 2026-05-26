'use client';

/**
 * FlowComponentInspector — formulário de edição das props do component
 * selecionado. Switch por tipo. Cada operação dispara `onChange(updated)`.
 *
 * Validação visual: usa os limites de FLOW_COMPONENT_LIMITS pra mostrar
 * contadores e cortar input no maxLength.
 */

import type {
  WhatsAppFlowAction,
  WhatsAppFlowChoice,
  WhatsAppFlowComponent,
  WhatsAppFlowScreen,
} from '@/lib/types';
import { FLOW_COMPONENT_LIMITS } from '@/lib/whatsapp-flows/components';
import { Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';

export interface FlowComponentInspectorProps {
  component: WhatsAppFlowComponent;
  onChange: (updated: WhatsAppFlowComponent) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** Lista de screens disponíveis pra ações `navigate`. */
  screens: WhatsAppFlowScreen[];
}

export default function FlowComponentInspector({
  component,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  screens,
}: FlowComponentInspectorProps) {
  return (
    <div className="px-4 py-3 space-y-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Componente · {component.type}
        </h3>
        <div className="flex items-center gap-1">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Mover pra cima"
              aria-label="Mover componente pra cima"
            >
              <ChevronUp size={14} />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Mover pra baixo"
              aria-label="Mover componente pra baixo"
            >
              <ChevronDown size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-700"
            title="Remover componente"
            aria-label="Remover componente"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {renderFields(component, onChange, screens)}
    </div>
  );
}

// =============================================================================
// Switch grande — cada tipo tem fields específicos
// =============================================================================

function renderFields(
  c: WhatsAppFlowComponent,
  onChange: (u: WhatsAppFlowComponent) => void,
  screens: WhatsAppFlowScreen[]
): React.ReactNode {
  switch (c.type) {
    case 'TextHeading':
    case 'TextSubheading':
    case 'TextBody':
    case 'TextCaption': {
      const max = FLOW_COMPONENT_LIMITS[c.type].text;
      return (
        <Field label={`Texto (${c.text.length}/${max})`}>
          {c.type === 'TextBody' ? (
            <textarea
              value={c.text}
              maxLength={max}
              rows={4}
              onChange={(e) =>
                onChange({ ...c, text: e.target.value.slice(0, max) })
              }
              className={`${inputCls} resize-none`}
            />
          ) : (
            <input
              type="text"
              value={c.text}
              maxLength={max}
              onChange={(e) =>
                onChange({ ...c, text: e.target.value.slice(0, max) })
              }
              className={inputCls}
            />
          )}
        </Field>
      );
    }

    case 'Image':
      return (
        <>
          <Field label="URL da imagem">
            <input
              type="text"
              value={c.src}
              onChange={(e) => onChange({ ...c, src: e.target.value })}
              placeholder="https://… ou data:image/png;base64,…"
              className={inputCls}
            />
          </Field>
          <Field label="Alt text (acessibilidade)">
            <input
              type="text"
              value={c.alt ?? ''}
              onChange={(e) => onChange({ ...c, alt: e.target.value })}
              maxLength={FLOW_COMPONENT_LIMITS.Image.alt}
              className={inputCls}
            />
          </Field>
          <Field label="Modo de exibição">
            <select
              value={c.scaleType ?? 'contain'}
              onChange={(e) =>
                onChange({ ...c, scaleType: e.target.value as 'contain' | 'cover' })
              }
              className={inputCls}
            >
              <option value="contain">Contain (mostra inteiro)</option>
              <option value="cover">Cover (preenche cortando)</option>
            </select>
          </Field>
        </>
      );

    case 'EmbeddedLink':
      return (
        <>
          <Field
            label={`Texto do link (${c.text.length}/${FLOW_COMPONENT_LIMITS.EmbeddedLink.text})`}
          >
            <input
              type="text"
              value={c.text}
              maxLength={FLOW_COMPONENT_LIMITS.EmbeddedLink.text}
              onChange={(e) => onChange({ ...c, text: e.target.value })}
              className={inputCls}
            />
          </Field>
          <ActionEditor
            value={c.onClickAction}
            onChange={(action) => onChange({ ...c, onClickAction: action })}
            screens={screens}
          />
        </>
      );

    case 'TextInput':
      return (
        <>
          <Field label="Label">
            <input
              type="text"
              value={c.label}
              maxLength={FLOW_COMPONENT_LIMITS.TextInput.label}
              onChange={(e) => onChange({ ...c, label: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Nome (identificador no payload)">
            <input
              type="text"
              value={c.name}
              onChange={(e) =>
                onChange({ ...c, name: e.target.value.replace(/\s+/g, '_') })
              }
              placeholder="ex: nome_completo"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field label="Tipo de input">
            <select
              value={c.inputType ?? 'text'}
              onChange={(e) =>
                onChange({
                  ...c,
                  inputType: e.target.value as typeof c.inputType,
                })
              }
              className={inputCls}
            >
              <option value="text">Texto</option>
              <option value="email">E-mail</option>
              <option value="number">Número</option>
              <option value="phone">Telefone</option>
              <option value="password">Senha</option>
              <option value="passcode">Passcode</option>
            </select>
          </Field>
          <Field label="Helper text (opcional)">
            <input
              type="text"
              value={c.helperText ?? ''}
              maxLength={FLOW_COMPONENT_LIMITS.TextInput.helperText}
              onChange={(e) => onChange({ ...c, helperText: e.target.value })}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min chars">
              <input
                type="number"
                min={0}
                value={c.minChars ?? ''}
                onChange={(e) =>
                  onChange({
                    ...c,
                    minChars: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Max chars">
              <input
                type="number"
                min={0}
                max={FLOW_COMPONENT_LIMITS.TextInput.maxCharsMax}
                value={c.maxChars ?? ''}
                onChange={(e) =>
                  onChange({
                    ...c,
                    maxChars: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </Field>
          </div>
          <RequiredToggle
            value={c.required ?? false}
            onChange={(v) => onChange({ ...c, required: v })}
          />
        </>
      );

    case 'TextArea':
      return (
        <>
          <Field label="Label">
            <input
              type="text"
              value={c.label}
              maxLength={FLOW_COMPONENT_LIMITS.TextArea.label}
              onChange={(e) => onChange({ ...c, label: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Nome">
            <input
              type="text"
              value={c.name}
              onChange={(e) =>
                onChange({ ...c, name: e.target.value.replace(/\s+/g, '_') })
              }
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field label="Max length">
            <input
              type="number"
              min={1}
              max={FLOW_COMPONENT_LIMITS.TextArea.maxLength}
              value={c.maxLength ?? 600}
              onChange={(e) =>
                onChange({ ...c, maxLength: Number(e.target.value) || 600 })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Helper text (opcional)">
            <input
              type="text"
              value={c.helperText ?? ''}
              onChange={(e) => onChange({ ...c, helperText: e.target.value })}
              className={inputCls}
            />
          </Field>
          <RequiredToggle
            value={c.required ?? false}
            onChange={(v) => onChange({ ...c, required: v })}
          />
        </>
      );

    case 'RadioButtonsGroup':
    case 'CheckboxGroup':
    case 'Dropdown':
      return (
        <>
          <Field label="Label">
            <input
              type="text"
              value={c.label}
              onChange={(e) => onChange({ ...c, label: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Nome">
            <input
              type="text"
              value={c.name}
              onChange={(e) =>
                onChange({ ...c, name: e.target.value.replace(/\s+/g, '_') })
              }
              className={`${inputCls} font-mono`}
            />
          </Field>
          <ChoicesEditor
            choices={c.dataSource}
            onChange={(ds) => onChange({ ...c, dataSource: ds })}
          />
          <RequiredToggle
            value={c.required ?? false}
            onChange={(v) => onChange({ ...c, required: v })}
          />
        </>
      );

    case 'DatePicker':
      return (
        <>
          <Field label="Label">
            <input
              type="text"
              value={c.label}
              onChange={(e) => onChange({ ...c, label: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Nome">
            <input
              type="text"
              value={c.name}
              onChange={(e) =>
                onChange({ ...c, name: e.target.value.replace(/\s+/g, '_') })
              }
              className={`${inputCls} font-mono`}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min date">
              <input
                type="date"
                value={c.minDate ?? ''}
                onChange={(e) => onChange({ ...c, minDate: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Max date">
              <input
                type="date"
                value={c.maxDate ?? ''}
                onChange={(e) => onChange({ ...c, maxDate: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <RequiredToggle
            value={c.required ?? false}
            onChange={(v) => onChange({ ...c, required: v })}
          />
        </>
      );

    case 'OptIn':
      return (
        <>
          <Field
            label={`Texto (${c.label.length}/${FLOW_COMPONENT_LIMITS.OptIn.label})`}
          >
            <textarea
              value={c.label}
              maxLength={FLOW_COMPONENT_LIMITS.OptIn.label}
              rows={2}
              onChange={(e) => onChange({ ...c, label: e.target.value })}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <Field label="Nome">
            <input
              type="text"
              value={c.name}
              onChange={(e) =>
                onChange({ ...c, name: e.target.value.replace(/\s+/g, '_') })
              }
              className={`${inputCls} font-mono`}
            />
          </Field>
          <RequiredToggle
            value={c.required ?? false}
            onChange={(v) => onChange({ ...c, required: v })}
          />
        </>
      );

    case 'Footer':
      return (
        <>
          <Field
            label={`Texto do botão (${c.label.length}/${FLOW_COMPONENT_LIMITS.Footer.label})`}
          >
            <input
              type="text"
              value={c.label}
              maxLength={FLOW_COMPONENT_LIMITS.Footer.label}
              onChange={(e) => onChange({ ...c, label: e.target.value })}
              className={inputCls}
            />
          </Field>
          <ActionEditor
            value={c.onClickAction}
            onChange={(action) => onChange({ ...c, onClickAction: action })}
            screens={screens}
          />
        </>
      );
  }
}

// =============================================================================
// Helpers compartilhados
// =============================================================================

const inputCls =
  'w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function RequiredToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-emerald-600"
      />
      <span className="text-xs text-gray-700 dark:text-gray-300">
        Campo obrigatório
      </span>
    </label>
  );
}

function ActionEditor({
  value,
  onChange,
  screens,
}: {
  value: WhatsAppFlowAction;
  onChange: (a: WhatsAppFlowAction) => void;
  screens: WhatsAppFlowScreen[];
}) {
  return (
    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
      <Field label="Ao clicar">
        <select
          value={value.name}
          onChange={(e) => {
            const name = e.target.value as WhatsAppFlowAction['name'];
            if (name === 'navigate') {
              onChange({ name: 'navigate', next: { name: screens[0]?.id ?? '' } });
            } else if (name === 'data_exchange') {
              onChange({ name: 'data_exchange' });
            } else {
              onChange({ name: 'complete' });
            }
          }}
          className={inputCls}
        >
          <option value="navigate">Navegar pra outra tela</option>
          <option value="data_exchange">Enviar dados ao backend</option>
          <option value="complete">Encerrar Flow</option>
        </select>
      </Field>
      {value.name === 'navigate' && (
        <Field label="Tela de destino">
          <select
            value={value.next.name}
            onChange={(e) =>
              onChange({ name: 'navigate', next: { name: e.target.value } })
            }
            className={inputCls}
          >
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || s.id}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}

function ChoicesEditor({
  choices,
  onChange,
}: {
  choices: WhatsAppFlowChoice[];
  onChange: (cs: WhatsAppFlowChoice[]) => void;
}) {
  function update(idx: number, patch: Partial<WhatsAppFlowChoice>) {
    onChange(choices.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function add() {
    const id = `op_${Math.random().toString(36).slice(2, 6)}`;
    onChange([...choices, { id, title: `Opção ${choices.length + 1}` }]);
  }
  function remove(idx: number) {
    onChange(choices.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Opções ({choices.length})
        </span>
        <button
          type="button"
          onClick={add}
          className="text-emerald-600 hover:text-emerald-700"
          title="Adicionar opção"
          aria-label="Adicionar opção"
        >
          <Plus size={14} />
        </button>
      </div>
      {choices.map((c, i) => (
        <div key={c.id} className="flex items-center gap-1">
          <input
            type="text"
            value={c.title}
            onChange={(e) => update(i, { title: e.target.value })}
            placeholder={`Opção ${i + 1}`}
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={choices.length <= 1}
            className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Remover"
            aria-label="Remover opção"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
