'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * Tracking — pílula azul que registra um evento analítico no fluxo.
 *
 * Inputs: data.label (string — nome do evento)
 */
function TrackingNode({ data, selected }: NodeProps<FluxoNode>) {
  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className="tracking">
        <span className="tracking-icon">📊</span>
        <span className="tracking-label">{data.label || 'Tracking'}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(TrackingNode);
