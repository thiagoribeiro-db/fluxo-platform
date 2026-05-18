'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * UserBubble — balão de mensagem USER (enviada) no estilo WhatsApp.
 *
 * Inputs: data.text (string), data.time (default "9.41 AM")
 * Conexões: handle top (entrada), handle bottom (saída)
 */
function UserBubbleNode({ data, selected }: NodeProps<FluxoNode>) {
  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className="bubble-user">
        <div className="bubble-text">{data.text || 'Texto enviado pelo usuário...'}</div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(UserBubbleNode);
