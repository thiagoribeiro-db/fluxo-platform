'use client';

/**
 * FlowPreviewRuntime — interpretador live do Flow.
 *
 * Renderiza um mockup WhatsApp INTERATIVO (inputs reais, ao clicar no Footer
 * dispara action). Permite testar o Flow inteiro antes de exportar/publicar.
 *
 * Estado interno:
 *  - currentScreenId: screen atual (começa na entry)
 *  - values: Record<componentName, value> — coleta dos inputs
 *  - completed: payload final se Footer.complete foi disparado
 *
 * Ações suportadas:
 *  - navigate → muda currentScreenId
 *  - complete → marca completed, mostra payload final
 *  - data_exchange → fake fetch (mostra toast + avança pra screen padrão)
 *    (não chama endpoint real — apenas simula)
 */

import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type {
  WhatsAppFlowAction,
  WhatsAppFlowComponent,
  WhatsAppFlowScreen,
} from '@/lib/types';
import { toast } from '@/lib/utils/errors';

export interface FlowPreviewRuntimeProps {
  screens: WhatsAppFlowScreen[];
  flowName: string;
  dataChannelUri?: string;
}

export default function FlowPreviewRuntime({
  screens,
  flowName,
  dataChannelUri,
}: FlowPreviewRuntimeProps) {
  const entryScreen = useMemo(
    () => screens.find((s) => s.isEntry) ?? screens[0],
    [screens]
  );
  const [currentScreenId, setCurrentScreenId] = useState(entryScreen?.id ?? '');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [completed, setCompleted] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset quando screens mudarem fora (raro — mas seguro)
  useEffect(() => {
    setCurrentScreenId(entryScreen?.id ?? '');
    setValues({});
    setCompleted(null);
    setErrors({});
  }, [entryScreen?.id]);

  const screen = useMemo(
    () => screens.find((s) => s.id === currentScreenId),
    [screens, currentScreenId]
  );

  function setValue(name: string, value: unknown) {
    setValues((v) => ({ ...v, [name]: value }));
    // limpa erro do campo quando user digita
    setErrors((e) => {
      if (!e[name]) return e;
      const { [name]: _drop, ...rest } = e;
      void _drop;
      return rest;
    });
  }

  function validateCurrentScreen(): boolean {
    if (!screen) return true;
    const newErrors: Record<string, string> = {};
    for (const c of screen.components) {
      if (isRequired(c)) {
        const name = (c as { name?: string }).name;
        if (!name) continue;
        const v = values[name];
        if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
          newErrors[name] = 'Campo obrigatório';
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleAction(action: WhatsAppFlowAction) {
    if (!validateCurrentScreen()) {
      toast({ level: 'warn', message: 'Preencha os campos obrigatórios' });
      return;
    }
    if (action.name === 'navigate') {
      setCurrentScreenId(action.next.name);
    } else if (action.name === 'complete') {
      setCompleted({ ...values });
      toast({
        level: 'success',
        message: 'Flow concluído',
        detail: `${Object.keys(values).length} campo${Object.keys(values).length === 1 ? '' : 's'} coletado${Object.keys(values).length === 1 ? '' : 's'}`,
      });
    } else {
      // data_exchange — simula (não bate em endpoint real)
      if (!dataChannelUri) {
        toast({
          level: 'warn',
          message: 'data_exchange simulado',
          detail: 'Sem endpoint configurado. Em produção, isso POSTAria no data_channel_uri.',
        });
      } else {
        toast({
          level: 'info',
          message: 'data_exchange (simulação)',
          detail: `Em produção, POST → ${dataChannelUri}`,
        });
      }
    }
  }

  function reset() {
    setCurrentScreenId(entryScreen?.id ?? '');
    setValues({});
    setCompleted(null);
    setErrors({});
    toast({ level: 'info', message: 'Preview reiniciado' });
  }

  if (!screen) {
    return (
      <div className="text-gray-400 text-sm">Nenhuma tela disponível pra preview</div>
    );
  }

  // ---------------- Tela "Flow concluído" ----------------
  if (completed) {
    return (
      <div
        className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
        style={{ width: 320, minHeight: 560 }}
      >
        <div className="bg-emerald-700 text-white text-[10px] px-3 py-1 flex justify-between">
          <span>9:41</span>
          <span>WhatsApp</span>
          <span>100%</span>
        </div>
        <div className="bg-emerald-600 text-white px-4 py-3 flex items-center gap-2">
          <span className="text-base leading-none">✅</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] opacity-80 truncate">{flowName}</div>
            <div className="text-sm font-semibold truncate">Flow concluído</div>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          <p className="text-sm text-gray-700">
            Em produção, esses dados retornam pro chat e o bot continua o
            fluxo conversacional.
          </p>
          <pre className="text-[10px] font-mono bg-gray-100 p-2 rounded overflow-x-auto">
            {JSON.stringify(completed, null, 2)}
          </pre>
          <button
            type="button"
            onClick={reset}
            className="w-full py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2 hover:bg-emerald-700"
          >
            <RotateCcw size={14} /> Reiniciar preview
          </button>
        </div>
      </div>
    );
  }

  // ---------------- Mockup interativo ----------------
  return (
    <div
      className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
      style={{ width: 320, minHeight: 560, maxHeight: '80vh' }}
    >
      <div className="bg-emerald-700 text-white text-[10px] px-3 py-1 flex justify-between">
        <span>9:41</span>
        <span>WhatsApp</span>
        <span>100%</span>
      </div>
      <div className="bg-emerald-600 text-white px-4 py-3 flex items-center gap-2">
        <span className="text-base leading-none">📋</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] opacity-80 truncate">{flowName}</div>
          <div className="text-sm font-semibold truncate">{screen.title}</div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-white/80 hover:text-white"
          title="Reiniciar preview"
          aria-label="Reiniciar preview"
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {screen.components.map((c) => (
          <LiveComponent
            key={c.id}
            component={c}
            values={values}
            errors={errors}
            onValue={setValue}
            onAction={handleAction}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// LiveComponent — render interativo de cada tipo
// =============================================================================

function LiveComponent({
  component: c,
  values,
  errors,
  onValue,
  onAction,
}: {
  component: WhatsAppFlowComponent;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onValue: (name: string, value: unknown) => void;
  onAction: (a: WhatsAppFlowAction) => void;
}) {
  // Helpers pra value + error por nome
  const name = (c as { name?: string }).name;
  const value = name ? values[name] : undefined;
  const error = name ? errors[name] : undefined;

  switch (c.type) {
    case 'TextHeading':
      return <h2 className="text-xl font-bold text-gray-900 leading-tight my-1">{c.text}</h2>;
    case 'TextSubheading':
      return <h3 className="text-base font-semibold text-gray-800 leading-tight my-1">{c.text}</h3>;
    case 'TextBody':
      return <p className="text-sm text-gray-700 leading-snug whitespace-pre-wrap my-1">{c.text}</p>;
    case 'TextCaption':
      return <p className="text-xs text-gray-500 leading-snug my-1">{c.text}</p>;

    case 'Image':
      return c.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.src}
          alt={c.alt ?? 'Imagem'}
          className={`my-1 rounded ${c.scaleType === 'cover' ? 'object-cover' : 'object-contain'}`}
          style={{ width: '100%', maxHeight: 200 }}
        />
      ) : (
        <div className="my-1 bg-gray-100 border-2 border-dashed border-gray-300 rounded h-24 flex items-center justify-center text-xs text-gray-400">
          🖼️ Imagem (sem URL)
        </div>
      );

    case 'EmbeddedLink':
      return (
        <button
          type="button"
          onClick={() => onAction(c.onClickAction)}
          className="text-sm text-emerald-600 hover:underline my-1 text-left block w-full"
        >
          {c.text} ↗
        </button>
      );

    case 'TextInput':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <input
            type={c.inputType === 'number' ? 'number' : c.inputType === 'password' ? 'password' : c.inputType === 'email' ? 'email' : 'text'}
            value={(value as string) ?? ''}
            onChange={(e) => onValue(c.name, e.target.value)}
            placeholder={c.helperText}
            minLength={c.minChars}
            maxLength={c.maxChars}
            className={`w-full px-2.5 py-1.5 text-sm border rounded-md ${
              error ? 'border-rose-400' : 'border-gray-300'
            }`}
          />
          {error ? (
            <p className="text-[10px] text-rose-600 mt-0.5">{error}</p>
          ) : c.helperText ? (
            <p className="text-[10px] text-gray-500 mt-0.5">{c.helperText}</p>
          ) : null}
        </div>
      );

    case 'TextArea':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <textarea
            value={(value as string) ?? ''}
            onChange={(e) => onValue(c.name, e.target.value)}
            maxLength={c.maxLength}
            rows={3}
            className={`w-full px-2.5 py-1.5 text-sm border rounded-md resize-none ${
              error ? 'border-rose-400' : 'border-gray-300'
            }`}
          />
          {error ? (
            <p className="text-[10px] text-rose-600 mt-0.5">{error}</p>
          ) : c.helperText ? (
            <p className="text-[10px] text-gray-500 mt-0.5">{c.helperText}</p>
          ) : null}
        </div>
      );

    case 'RadioButtonsGroup':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <div className="space-y-1">
            {c.dataSource.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-2 px-2 py-1.5 border rounded-md text-sm cursor-pointer hover:bg-emerald-50 ${
                  value === opt.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name={c.name}
                  checked={value === opt.id}
                  onChange={() => onValue(c.name, opt.id)}
                  className="accent-emerald-600"
                />
                <span className="flex-1 text-gray-700">{opt.title}</span>
              </label>
            ))}
          </div>
          {error && <p className="text-[10px] text-rose-600 mt-0.5">{error}</p>}
        </div>
      );

    case 'CheckboxGroup': {
      const selected = (value as string[]) ?? [];
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <div className="space-y-1">
            {c.dataSource.map((opt) => {
              const isOn = selected.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`flex items-center gap-2 px-2 py-1.5 border rounded-md text-sm cursor-pointer hover:bg-emerald-50 ${
                    isOn ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => {
                      const next = isOn
                        ? selected.filter((id) => id !== opt.id)
                        : [...selected, opt.id];
                      onValue(c.name, next);
                    }}
                    className="accent-emerald-600"
                  />
                  <span className="flex-1 text-gray-700">{opt.title}</span>
                </label>
              );
            })}
          </div>
          {error && <p className="text-[10px] text-rose-600 mt-0.5">{error}</p>}
        </div>
      );
    }

    case 'Dropdown':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <select
            value={(value as string) ?? ''}
            onChange={(e) => onValue(c.name, e.target.value)}
            className={`w-full px-2.5 py-1.5 text-sm border rounded-md bg-white ${
              error ? 'border-rose-400' : 'border-gray-300'
            }`}
          >
            <option value="">— Selecione —</option>
            {c.dataSource.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.title}
              </option>
            ))}
          </select>
          {error && <p className="text-[10px] text-rose-600 mt-0.5">{error}</p>}
        </div>
      );

    case 'DatePicker':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <input
            type="date"
            value={(value as string) ?? ''}
            onChange={(e) => onValue(c.name, e.target.value)}
            min={c.minDate}
            max={c.maxDate}
            className={`w-full px-2.5 py-1.5 text-sm border rounded-md ${
              error ? 'border-rose-400' : 'border-gray-300'
            }`}
          />
          {error ? (
            <p className="text-[10px] text-rose-600 mt-0.5">{error}</p>
          ) : c.helperText ? (
            <p className="text-[10px] text-gray-500 mt-0.5">{c.helperText}</p>
          ) : null}
        </div>
      );

    case 'OptIn':
      return (
        <label
          className={`my-2 flex items-start gap-2 px-2 py-1.5 border rounded-md text-sm cursor-pointer ${
            value === true ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
          }`}
        >
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onValue(c.name, e.target.checked)}
            className="mt-0.5 accent-emerald-600"
          />
          <span className="flex-1 text-xs leading-snug text-gray-700">
            {c.label}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </span>
        </label>
      );

    case 'Footer':
      return (
        <div className="mt-3 pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={() => onAction(c.onClickAction)}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md transition"
          >
            {c.label}
          </button>
        </div>
      );
  }
}

function isRequired(c: WhatsAppFlowComponent): boolean {
  if (
    c.type === 'TextInput' ||
    c.type === 'TextArea' ||
    c.type === 'RadioButtonsGroup' ||
    c.type === 'CheckboxGroup' ||
    c.type === 'Dropdown' ||
    c.type === 'DatePicker' ||
    c.type === 'OptIn'
  ) {
    return c.required === true;
  }
  return false;
}
