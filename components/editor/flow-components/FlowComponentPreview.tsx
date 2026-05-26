'use client';

/**
 * FlowComponentPreview — render visual de um WhatsAppFlowComponent dentro
 * do mockup WhatsApp. Estilo fiel ao Flow real do WhatsApp Business.
 *
 * NÃO é interativo (não responde a clicks/input do user no preview).
 * Quando rolar #212 (preview interativo), vamos ter um `FlowComponentLive`
 * que aceita value + onChange. Esse aqui é puro mockup.
 */

import type { WhatsAppFlowComponent } from '@/lib/types';

export interface FlowComponentPreviewProps {
  component: WhatsAppFlowComponent;
  /** Marca visual quando este component está selecionado pra edição. */
  selected?: boolean;
  /** Click no preview seleciona o component pra editar no inspector. */
  onClick?: () => void;
}

export default function FlowComponentPreview({
  component,
  selected,
  onClick,
}: FlowComponentPreviewProps) {
  const baseCls = `relative w-full ${
    selected
      ? 'ring-2 ring-emerald-500 ring-offset-1 rounded-md'
      : 'hover:ring-1 hover:ring-gray-300 rounded'
  } transition cursor-pointer`;

  return (
    <div className={baseCls} onClick={onClick} role="button" tabIndex={0}>
      {renderByType(component)}
    </div>
  );
}

// =============================================================================
// Renderers por tipo — cada um espelha o look-and-feel do Flow real
// =============================================================================

function renderByType(c: WhatsAppFlowComponent) {
  switch (c.type) {
    // ---- Texto ---------------------------------------------------------
    case 'TextHeading':
      return (
        <h2 className="text-xl font-bold text-gray-900 leading-tight my-1">
          {c.text || 'Título'}
        </h2>
      );
    case 'TextSubheading':
      return (
        <h3 className="text-base font-semibold text-gray-800 leading-tight my-1">
          {c.text || 'Subtítulo'}
        </h3>
      );
    case 'TextBody':
      return (
        <p className="text-sm text-gray-700 leading-snug whitespace-pre-wrap my-1">
          {c.text || 'Texto do corpo.'}
        </p>
      );
    case 'TextCaption':
      return (
        <p className="text-xs text-gray-500 leading-snug my-1">
          {c.text || 'Legenda'}
        </p>
      );

    // ---- Visual --------------------------------------------------------
    case 'Image':
      return c.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.src}
          alt={c.alt ?? 'Imagem'}
          className={`my-1 rounded ${
            c.scaleType === 'cover' ? 'object-cover' : 'object-contain'
          }`}
          style={{
            width: c.width ?? '100%',
            height: c.height ?? 'auto',
            maxHeight: 200,
          }}
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
          className="text-sm text-emerald-600 hover:underline my-1 text-left block w-full"
        >
          {c.text || 'Link'} ↗
        </button>
      );

    // ---- Inputs simples ------------------------------------------------
    case 'TextInput':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label || 'Campo'}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <input
            type="text"
            placeholder={inputPlaceholder(c.inputType)}
            disabled
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-400"
          />
          {c.helperText && (
            <p className="text-[10px] text-gray-500 mt-0.5">{c.helperText}</p>
          )}
        </div>
      );

    case 'TextArea':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label || 'Campo longo'}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <textarea
            disabled
            rows={3}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-400 resize-none"
          />
          {c.helperText && (
            <p className="text-[10px] text-gray-500 mt-0.5">{c.helperText}</p>
          )}
        </div>
      );

    // ---- Inputs com opções ---------------------------------------------
    case 'RadioButtonsGroup':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label || 'Selecione'}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <div className="space-y-1">
            {c.dataSource.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1 border border-gray-200 rounded-md text-sm text-gray-600"
              >
                <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                <span className="flex-1 truncate">{opt.title}</span>
                {opt.description && (
                  <span className="text-[10px] text-gray-400 truncate max-w-[40%]">
                    {opt.description}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      );

    case 'CheckboxGroup':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label || 'Marque'}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <div className="space-y-1">
            {c.dataSource.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1 border border-gray-200 rounded-md text-sm text-gray-600"
              >
                <span className="w-3.5 h-3.5 rounded border-2 border-gray-300 shrink-0" />
                <span className="flex-1 truncate">{opt.title}</span>
              </label>
            ))}
          </div>
        </div>
      );

    case 'Dropdown':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label || 'Selecione'}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <div className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-400 flex items-center justify-between">
            <span>
              {c.dataSource.length} opç{c.dataSource.length === 1 ? 'ão' : 'ões'}
            </span>
            <span>▾</span>
          </div>
        </div>
      );

    case 'DatePicker':
      return (
        <div className="my-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {c.label || 'Data'}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <div className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-400 flex items-center gap-1.5">
            <span>📅</span>
            <span>dd/mm/aaaa</span>
          </div>
          {c.helperText && (
            <p className="text-[10px] text-gray-500 mt-0.5">{c.helperText}</p>
          )}
        </div>
      );

    case 'OptIn':
      return (
        <label className="my-2 flex items-start gap-2 px-2 py-1.5 border border-gray-200 rounded-md text-sm text-gray-700">
          <span className="w-3.5 h-3.5 rounded border-2 border-gray-300 shrink-0 mt-0.5" />
          <span className="flex-1 text-xs leading-snug">
            {c.label || 'Aceito os termos'}
            {c.required && <span className="text-rose-500 ml-0.5">*</span>}
          </span>
        </label>
      );

    // ---- Footer --------------------------------------------------------
    case 'Footer':
      return (
        <div className="mt-3 pt-2 border-t border-gray-200">
          <button
            type="button"
            disabled
            className="w-full py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-md"
          >
            {c.label || 'Continuar'}
          </button>
          <p className="text-[10px] text-center text-gray-400 mt-1">
            action: {actionSummary(c.onClickAction)}
          </p>
        </div>
      );
  }
}

function inputPlaceholder(t?: string): string {
  switch (t) {
    case 'email':
      return 'exemplo@email.com';
    case 'number':
      return '0';
    case 'phone':
      return '(11) 99999-9999';
    case 'password':
    case 'passcode':
      return '••••••';
    default:
      return '';
  }
}

function actionSummary(a: {
  name: 'navigate' | 'data_exchange' | 'complete';
  next?: { name: string };
}): string {
  if (a.name === 'navigate') return `Ir pra "${a.next?.name ?? '?'}"`;
  if (a.name === 'data_exchange') return 'Enviar dados ao backend';
  return 'Encerrar Flow';
}
