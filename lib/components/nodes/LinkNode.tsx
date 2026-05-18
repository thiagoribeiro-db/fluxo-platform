'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * LinkNode — card visual de referência a uma URL externa.
 *
 * Renderiza no estilo de "link preview" do WhatsApp:
 *  - Ícone 🔗 + título
 *  - Descrição opcional (cinza)
 *  - Domínio em fonte menor
 *  - URL completa em fonte mono e cor link
 *
 * `data.sender` controla alinhamento (bot=esquerda, user=direita) e cor,
 * espelhando o padrão das mídias e bubbles.
 */
function LinkNode({ data, selected }: NodeProps<FluxoNode>) {
  const sender = data.sender ?? 'bot';
  const isBot = sender === 'bot';
  const url = (data.url as string | undefined) ?? '';
  const title =
    (data.linkTitle as string | undefined) ||
    (data.label as string | undefined) ||
    'Acessar link';
  const description = data.linkDescription as string | undefined;
  const domain =
    (data.linkDomain as string | undefined) || extractDomain(url) || '';

  return (
    <div
      className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-xl' : ''}`}
    >
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div
        className={`w-72 rounded-xl shadow-sm border ${
          isBot
            ? 'bg-white border-gray-200'
            : 'bg-[#dcf8c6] border-[#c8eba6]'
        } overflow-hidden`}
      >
        {/* Cabeçalho com ícone + título + domínio */}
        <div className="px-3 pt-3 pb-2 border-b border-black/5">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none mt-0.5" aria-hidden="true">
              🔗
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {title}
              </p>
              {domain && (
                <p className="text-[10px] text-gray-500 truncate">{domain}</p>
              )}
            </div>
          </div>
          {description && (
            <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>

        {/* URL completa */}
        <div className="px-3 py-2 bg-gray-50/60">
          <p className="text-[11px] font-mono text-blip-purple truncate" title={url}>
            {url || 'https://…'}
          </p>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

/** Extrai o domínio de uma URL pra exibir abaixo do título. */
function extractDomain(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export default memo(LinkNode);
