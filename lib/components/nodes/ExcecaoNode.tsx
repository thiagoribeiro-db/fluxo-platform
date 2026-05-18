'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * Exceção — bloco vermelho indicando caminho de erro/fallback do fluxo.
 *
 * Inputs: data.label (string — descrição da exceção)
 */
function ExcecaoNode({ data, selected }: NodeProps<FluxoNode>) {
  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-red-500" />

      <div className="excecao">
        <span className="excecao-icon">⚠️</span>
        <span className="excecao-label">{data.label || 'Exceção / Fallback'}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-red-500" />
    </div>
  );
}

export default memo(ExcecaoNode);
