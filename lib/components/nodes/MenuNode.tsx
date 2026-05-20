'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';
import { markdownToHtml } from '@/lib/utils/markdown';

/**
 * Menu — modal de seleção do WhatsApp com header, lista de opções e footer.
 *
 * Inputs:
 *   data.header (string em markdown WhatsApp)
 *   data.options (string[] em markdown WhatsApp)
 *   data.footer (string, default "Enviar")
 * Conexões: handle top (entrada), handle bottom (saída — usuário escolheu).
 */
function MenuNode({ data, selected }: NodeProps<FluxoNode>) {
  const options: string[] = data.options || ['Opção 1', 'Opção 2', 'Opção 3'];
  const header = (data.header as string | undefined) || 'Selecione uma opção';

  return (
    <div className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}>
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className="menu">
        <div
          className="menu-header"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(header) }}
        />
        {options.map((opt, idx) => (
          <div key={idx} className="menu-row">
            <span
              className="menu-row-label"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(opt) }}
            />
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
