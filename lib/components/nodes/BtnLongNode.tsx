'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * BtnLong — quick-reply (interactive.button) renderizado em largura inteira.
 *
 * Funcionalmente IDÊNTICO ao BtnShort — ambos viram `interactive.button` no
 * WhatsApp Cloud API. A diferença é só visual: btn-long é usado quando há
 * UMA única opção/CTA, ocupando largura inteira no canvas. Limite Meta:
 * label até 20 chars; máximo 3 quick-replies por mensagem (somando com btn-short).
 *
 * Inputs: data.label (string, max 20 chars)
 * Conexões: handle top (entrada), handle bottom (saída)
 */
function BtnLongNode({ data, selected }: NodeProps<FluxoNode>) {
  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className="btn-long">
        {data.label || 'Continuar'}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(BtnLongNode);
