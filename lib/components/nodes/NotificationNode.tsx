'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * NotificationNode — bloco de "Notificação de API/IA" (cabeçalho colorido +
 * lista de campos label/valor).
 *
 * IMPORTANTE: não usa `overflow-hidden` no wrapper externo pra o CodeBadge
 * (posicionado em -top-2 -right-2) não ficar cortado. Em vez disso,
 * aplica `rounded-t-xl` no header e `rounded-b-xl` no body individualmente.
 */
function NotificationNode({ data, selected }: NodeProps<FluxoNode>) {
  const headerColor = data.headerColor ?? '#6F2DBD';
  const fields = data.fields ?? [];

  return (
    <div
      className={`relative w-[280px] rounded-xl shadow-md ${
        selected ? 'ring-2 ring-blip-purple ring-offset-2' : ''
      }`}
    >
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      {/* Header */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 rounded-t-xl border border-b-0 border-gray-200"
        style={{ backgroundColor: headerColor }}
      >
        <span className="text-white font-semibold text-sm leading-tight">
          {data.title || 'Integração'}
        </span>
        {data.headerIcon && (
          <span className="text-white text-lg leading-none">
            {data.headerIcon}
          </span>
        )}
      </div>

      {/* Body — lista de campos */}
      <div className="px-3.5 py-2.5 bg-gray-50 rounded-b-xl border border-gray-200">
        {fields.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Adicione campos no painel direito</p>
        ) : (
          <div className="space-y-1.5">
            {fields.map((f, idx) => (
              <div
                key={f.key || idx}
                className={`pb-1.5 ${
                  idx < fields.length - 1 ? 'border-b border-dashed border-gray-300' : ''
                }`}
              >
                <div className="flex items-baseline gap-1.5 text-[11px] leading-tight">
                  <span className="font-semibold text-gray-700 whitespace-nowrap">
                    {f.label}:
                  </span>
                  <span className="text-gray-500 break-words">{f.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(NotificationNode);
