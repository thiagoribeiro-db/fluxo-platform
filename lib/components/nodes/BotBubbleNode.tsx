'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';
import { markdownToHtml } from '@/lib/utils/markdown';

/**
 * BotBubble — balão de mensagem BOT (recebida) no estilo WhatsApp.
 *
 * Inputs: data.text (string em markdown WhatsApp), data.time (default "9.41 AM")
 * Conexões: handle top (entrada), handle bottom (saída)
 */
function BotBubbleNode({ data, selected }: NodeProps<FluxoNode>) {
  const text = (data.text as string | undefined) || 'Texto da mensagem BOT...';
  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className="bubble-bot">
        <div
          className="bubble-text"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }}
        />
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(BotBubbleNode);
