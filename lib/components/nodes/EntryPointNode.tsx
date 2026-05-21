'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';

/**
 * EntryPointNode — marcador visual do INÍCIO do fluxo dentro de um frame.
 *
 * Pra que serve:
 *  - Visualmente: deixa claro pra qualquer um lendo o canvas onde o
 *    fluxo daquele frame começa.
 *  - Para o linter (`flow-linter`): se há entry-points no projeto, o
 *    BFS de "alcançabilidade" parte deles, evitando falsos positivos
 *    de `unreachable-node` em frames secundários (ex: Encerramento,
 *    Algo Mais — alcançados via skill router externo no Blip).
 *
 * Visual: pílula verde compacta com ícone ▶ + texto "Início".
 * Tem só `source` handle (é raiz — não recebe edges).
 *
 * Convenção: coloque UM entry-point por frame, conectado ao primeiro
 * main do frame via edge.
 */
function EntryPointNode({ data, selected }: NodeProps<FluxoNode>) {
  const label = (data.label as string | undefined) || 'Início';

  return (
    <div
      className={`relative ${
        selected ? 'ring-2 ring-emerald-500 ring-offset-2 rounded-full' : ''
      }`}
    >
      <div
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-sm border border-emerald-600"
        style={{ minWidth: 110 }}
        title="Início do fluxo deste frame"
      >
        <span className="text-[10px] leading-none" aria-hidden="true">
          ▶
        </span>
        <span className="uppercase tracking-wide">{label}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-600 !w-2.5 !h-2.5 !bottom-[-5px]"
      />
    </div>
  );
}

export default memo(EntryPointNode);
