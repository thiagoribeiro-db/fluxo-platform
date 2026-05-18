'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * BotBubble — balão de mensagem BOT (recebida) no estilo WhatsApp.
 *
 * Inputs: data.text (string), data.time (default "9.41 AM")
 * Conexões: handle top (entrada), handle bottom (saída)
 */
function BotBubbleNode({ data, selected }: NodeProps<FluxoNode>) {
  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className="bubble-bot">
        <div className="bubble-text">{data.text || 'Texto da mensagem BOT...'}</div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(BotBubbleNode);
