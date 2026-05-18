'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * Event customizado que o FlowEditor escuta pra navegar até o frame de destino
 * quando o usuário clica num direcionamento clickable.
 *
 * Prioriza `targetNodeId` (ESTÁVEL — node.id do React Flow) sobre o
 * `targetFrameId` (legado, baseado em frameId humano que pode mudar).
 */
export const FLUXO_JUMP_TO_FRAME_EVENT = 'fluxo:jump-to-frame';
export interface JumpToFrameDetail {
  targetNodeId?: string;
  targetFrameId?: string;
}

/**
 * Direcionamento — pílula que aponta para outro frame do fluxo (ex.: "→ frame-AS").
 *
 * Inputs:
 *   data.label (string — texto exibido)
 *   data.targetFrameId (string — id do frame de destino; usado para navegação)
 *   data.clickable (boolean — se true, aplica estilo .clickable)
 */
function DirecionamentoNode({ data, selected }: NodeProps<FluxoNode>) {
  const className = `direcionamento ${data.clickable ? 'clickable' : ''}`.trim();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!data.clickable) return;
      if (!data.targetNodeId && !data.targetFrameId) return;
      e.stopPropagation();
      const detail: JumpToFrameDetail = {
        targetNodeId: data.targetNodeId,
        targetFrameId: data.targetFrameId,
      };
      window.dispatchEvent(
        new CustomEvent(FLUXO_JUMP_TO_FRAME_EVENT, { detail })
      );
    },
    [data.clickable, data.targetNodeId, data.targetFrameId]
  );

  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className={className} onClick={handleClick}>
        <span className="direcionamento-arrow">→</span>
        <span className="direcionamento-label">
          {data.label || 'Ir para frame...'}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(DirecionamentoNode);
