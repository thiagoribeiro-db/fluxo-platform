'use client';

import { memo, useCallback } from 'react';
import {
  Handle,
  Position,
  NodeResizer,
  useReactFlow,
  type NodeProps,
} from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';

/**
 * ConditionalNode — "varal" de decisão if/else.
 *
 * Visual minimalista:
 *  - Pílula horizontal estreita (default 320×44, redimensionável)
 *  - Condição centralizada em texto fino
 *  - Extremidade esquerda: ponto verde + "V" (TRUE)
 *  - Extremidade direita: ponto vermelho + "F" (FALSE)
 *  - Borda fina cinza, fundo branco — discreto, não chamativo
 *
 * Handles:
 *  - target (top) — entrada única
 *  - source id="true" (bottom-left) — saída TRUE
 *  - source id="false" (bottom-right) — saída FALSE
 *
 * Quando selecionado: NodeResizer aparece pra ajustar largura e altura.
 * Tamanho persiste em data.width/data.height.
 *
 * NÃO recebe `code` — é ponto de decisão lógica, não unidade emissora.
 */
function ConditionalNode({ id, data, selected }: NodeProps<FluxoNode>) {
  const width = (data.width as number | undefined) ?? 320;
  const height = (data.height as number | undefined) ?? 44;
  const condition =
    (data.condition as string | undefined) ||
    (data.label as string | undefined) ||
    'Condição?';
  const trueLabel = (data.trueLabel as string | undefined) || 'Verdadeiro';
  const falseLabel = (data.falseLabel as string | undefined) || 'Falso';

  const { setNodes } = useReactFlow();

  const onResizeEnd = useCallback(
    (_evt: unknown, params: { width: number; height: number }) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: { ...n.data, width: params.width, height: params.height },
              }
            : n
        )
      );
    },
    [id, setNodes]
  );

  return (
    <div
      className="relative"
      style={{ width, height }}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={200}
        minHeight={32}
        onResizeEnd={onResizeEnd}
        lineClassName="!border-blip-purple/60"
        handleClassName="!bg-blip-purple !border-white !w-2.5 !h-2.5"
      />

      {/* Handle de entrada (topo, centro) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-2 !h-2 !top-[-4px]"
      />

      {/* Varal */}
      <div
        className={`flex items-center justify-between w-full h-full rounded-full bg-white border ${
          selected ? 'border-blip-purple' : 'border-gray-300'
        } px-2 shadow-sm`}
      >
        {/* TRUE — verde */}
        <div className="flex items-center gap-1 shrink-0">
          <span
            className="w-2 h-2 rounded-full bg-emerald-500"
            aria-hidden="true"
          />
          <span
            className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide"
            title={trueLabel}
          >
            {trueLabel.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Condição centralizada */}
        <div className="flex-1 px-2 text-xs text-gray-700 text-center truncate">
          {condition}
        </div>

        {/* FALSE — vermelho */}
        <div className="flex items-center gap-1 shrink-0">
          <span
            className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide"
            title={falseLabel}
          >
            {falseLabel.charAt(0).toUpperCase()}
          </span>
          <span
            className="w-2 h-2 rounded-full bg-rose-500"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Handle TRUE (bottom-left, posicionado sob o ponto verde) */}
      <Handle
        id="true"
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !border-white !w-2.5 !h-2.5 !bottom-[-5px]"
        style={{ left: 14 }}
      />

      {/* Handle FALSE (bottom-right, posicionado sob o ponto vermelho) */}
      <Handle
        id="false"
        type="source"
        position={Position.Bottom}
        className="!bg-rose-500 !border-white !w-2.5 !h-2.5 !bottom-[-5px]"
        style={{ left: 'auto', right: 14 }}
      />
    </div>
  );
}

export default memo(ConditionalNode);
