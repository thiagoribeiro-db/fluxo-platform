'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * BtnShort — botão curto (Aceitar / Recusar / opção numerada).
 *
 * Inputs: data.label (string), data.variant ('default' | 'numbered')
 * Conexões: handle top (entrada), handle bottom (saída — para tracking/menu/bubble)
 */
function BtnShortNode({ data, selected }: NodeProps<FluxoNode>) {
  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className="btn-short">
        {data.label || 'Opção'}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(BtnShortNode);
