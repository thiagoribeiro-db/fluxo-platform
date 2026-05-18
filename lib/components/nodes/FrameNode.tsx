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
 * Frame — container nomeado que agrupa nós relacionados.
 *
 * - Quando selecionado e DESBLOQUEADO: mostra NodeResizer (puxa cantos pra
 *   redimensionar). O novo width/height é salvo em data.width/height.
 * - Quando BLOQUEADO (data.locked=true): borda mais sutil, cadeado no header,
 *   sem handles de resize. O FlowEditor também desativa drag desses nodes.
 */
function FrameNode({ id, data, selected }: NodeProps<FluxoNode>) {
  const width = data.width ?? 540;
  const height = data.height ?? 400;
  const locked = !!data.locked;
  const { setNodes } = useReactFlow();

  // Persiste o tamanho em data.width/height quando o resize termina
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
    // Wrapper externo: `pointer-events: none` faz o BODY do frame ser
    // "transparente" a cliques. Os elementos interativos (header, NodeResizer
    // handles, Handles de edge) re-habilitam clique com `pointer-events: auto`.
    //
    // Resultado: clicar dentro do frame em outro componente → seleciona o
    // componente (não o frame). Só clica no HEADER pra selecionar o frame.
    <div
      id={data.frameId ? `frame-${data.frameId}` : undefined}
      className={`relative border-2 ${
        locked
          ? 'border-solid border-gray-300/70 bg-gray-100/30'
          : 'border-dashed bg-blip-purple/5 ' +
            (selected ? 'border-blip-purple' : 'border-blip-purple/40')
      } rounded-lg`}
      style={{ width, height, pointerEvents: 'none' }}
    >
      {/* NodeResizer — handles re-habilitam pointer-events automaticamente */}
      <NodeResizer
        isVisible={!!selected && !locked}
        minWidth={200}
        minHeight={120}
        onResizeEnd={onResizeEnd}
        lineClassName="!border-blip-purple"
        handleClassName="!bg-blip-purple !border-white !w-3 !h-3"
      />

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blip-purple"
        style={{ pointerEvents: 'auto' }}
      />

      {/* HEADER — esta é a "área direta" do frame: clicar aqui seleciona/arrasta */}
      <div
        className={`absolute -top-7 left-0 px-3 py-1 rounded-t-md text-white text-xs font-semibold uppercase tracking-wide flex items-center gap-2 cursor-pointer ${
          locked ? 'bg-gray-500' : 'bg-blip-purple'
        }`}
        style={{ pointerEvents: 'auto' }}
      >
        {locked && <span title="Frame travado">🔒</span>}
        {data.code && (
          <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-mono">
            {data.code}
          </span>
        )}
        {data.title || 'Frame'}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blip-purple"
        style={{ pointerEvents: 'auto' }}
      />
    </div>
  );
}

export default memo(FrameNode);
