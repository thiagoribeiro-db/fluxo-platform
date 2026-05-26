'use client';

/**
 * WhatsAppFlowNode — bloco visual representando um Flow do WhatsApp.
 *
 * Funcionalmente: é um "âncora" no fluxo conversacional principal. O Flow em
 * si (com suas screens, components e routing) vive em `data.screens` e é
 * editado num sub-editor modal dedicado (FlowSubEditor.tsx).
 *
 * Render: card com header verde "📋 WhatsApp Flow", título do flow, badge
 * da categoria, contagem de screens, CTA "Abrir editor". Quando o Flow foi
 * editado recentemente, mostra:
 *   - badge "atualizado há X min/h" (formatTimeAgo)
 *   - pulse animado de 5 minutos pós-edição (isRecent)
 *   - dot vermelho "atualização não vista" se updatedAt > lastSeen no localStorage
 *
 * Conexões: handle top (entrada — o fluxo conversacional dispara o Flow);
 * handle bottom (saída — quando o usuário completa/cancela o Flow).
 */

import { memo, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode, WhatsAppFlowCategory } from '@/lib/types';
import { FLOW_CATEGORIES } from '@/lib/whatsapp-flows/constants';
import { formatTimeAgo, isRecent } from '@/lib/utils/time-ago';
import { hasUnseenUpdate } from '@/lib/utils/seen-tracker';
import CodeBadge from './CodeBadge';

function getCategoryLabel(value?: WhatsAppFlowCategory): string {
  if (!value) return 'Outro';
  const entry = FLOW_CATEGORIES.find((c) => c.value === value);
  return entry?.label ?? 'Outro';
}

/**
 * Re-renderiza o componente a cada `intervalMs` pra atualizar timestamps
 * relativos ("há 1 min" → "há 2 min"). Default 30s.
 */
function useTick(intervalMs = 30_000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

function WhatsAppFlowNode({ id, data, selected }: NodeProps<FluxoNode>) {
  const name = (data.flowName as string | undefined) ?? 'Novo Flow';
  const category = data.flowCategory as WhatsAppFlowCategory | undefined;
  const screens = (data.screens as unknown[] | undefined) ?? [];
  const trigger = (data.triggerLabel as string | undefined) ?? 'Abrir';
  const updatedAt = data.flowUpdatedAt as string | undefined;

  // Re-render a cada 30s pra atualizar "atualizado há X"
  useTick();

  const recent = isRecent(updatedAt, { withinMs: 5 * 60_000 });
  const unseen = hasUnseenUpdate('flow', id, updatedAt);
  const timeAgo = formatTimeAgo(updatedAt);

  return (
    <div
      className={`relative rounded-xl shadow-md w-[260px] bg-white border overflow-hidden transition-shadow ${
        selected
          ? 'border-blip-purple ring-2 ring-blip-purple ring-offset-2'
          : recent
            ? 'border-emerald-400 shadow-emerald-200/50 shadow-lg'
            : 'border-gray-200'
      }`}
    >
      <CodeBadge code={data.code} />

      {/* Dot indicator "atualização não vista" — canto superior direito.
          Limpa quando o user abre o sub-editor (markSeen) ou fecha o modal. */}
      {unseen && (
        <span
          className="absolute -top-1 -right-1 z-10 flex items-center justify-center"
          title="Tem atualização não vista — clique pra abrir o editor"
          aria-label="Tem atualização não vista"
        >
          <span className="absolute inline-flex h-3 w-3 rounded-full bg-rose-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
        </span>
      )}

      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      {/* Header — verde WhatsApp pra deixar claro que é Meta-native.
          Pulse de borda durante 5min pós-edição (recent). */}
      <div
        className={`bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 flex items-center gap-2 ${
          recent ? 'animate-pulse-subtle' : ''
        }`}
      >
        <span className="text-base">📋</span>
        <span className="text-white font-semibold text-sm flex-1 truncate">
          WhatsApp Flow
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        <div className="text-sm font-semibold text-gray-900 truncate" title={name}>
          {name}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
            {getCategoryLabel(category)}
          </span>
          <span className="text-[10px] text-gray-500">
            {screens.length} {screens.length === 1 ? 'tela' : 'telas'}
          </span>
        </div>

        {/* Badge "atualizado há X" — só renderiza se houver timestamp.
            Cor varia: emerald (recente <5min) → gray (mais antigo). */}
        {timeAgo && (
          <div
            className={`text-[10px] flex items-center gap-1 ${
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
          </div>
        )}

        {/* CTA visual — o handler do duplo-clique no canvas abre o sub-editor */}
        <div className="mt-1 text-[11px] text-center text-emerald-700 font-medium bg-emerald-50 hover:bg-emerald-100 transition rounded py-1.5 cursor-pointer">
          ▸ {trigger}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(WhatsAppFlowNode);
