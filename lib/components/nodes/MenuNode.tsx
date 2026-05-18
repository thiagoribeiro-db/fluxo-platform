'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * Menu — modal de seleção do WhatsApp com header, lista de opções e footer.
 *
 * Inputs:
 *   data.header (string)
 *   data.options (string[])
 *   data.footer (string, default "Enviar")
 * Conexões: handle top (entrada), handle bottom (saída — usuário escolheu).
 */
function MenuNode({ data, selected }: NodeProps<FluxoNode>) {
  const options: string[] = data.options || ['Opção 1', 'Opção 2', 'Opção 3'];

  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className="menu">
        <div className="menu-header">{data.header || 'Selecione uma opção'}</div>
        {options.map((opt, idx) => (
          <div key={idx} className="menu-row">
            <span className="menu-row-label">{opt}</span>
            <span className="menu-row-radio" />
          </div>
        ))}
        <div className="menu-footer">{data.footer || 'Enviar'}</div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(MenuNode);
