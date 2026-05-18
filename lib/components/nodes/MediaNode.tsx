'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * MediaNode — bloco visual de mídia (imagem, documento, vídeo) enviada
 * pelo bot ou pelo usuário.
 *
 * data.mediaKind: 'imagem' | 'documento' | 'video'
 * data.sender:    'bot' | 'user'
 * data.caption:   texto/legenda
 * data.meta:      info adicional ("1 page · 262 KB · pdf")
 * data.filename:  só pra documento
 * data.thumbnailUrl: URL (futuro)
 */
function MediaNode({ data, selected }: NodeProps<FluxoNode>) {
  const sender = data.sender ?? 'bot';
  const kind = data.mediaKind ?? 'imagem';
  const isUser = sender === 'user';

  return (
    <div
      className={`relative rounded-lg shadow-sm w-[240px] ${
        isUser ? 'bg-wpp-bg-user' : 'bg-white'
      } ${selected ? 'ring-2 ring-blip-purple ring-offset-2' : ''}`}
    >
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      {/* Thumbnail (placeholder cinza) — rounded-t pra encaixar no wrapper */}
      <div className="relative w-full h-28 bg-gray-300 flex items-center justify-center rounded-t-lg overflow-hidden">
        {data.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.thumbnailUrl}
            alt={data.caption ?? 'mídia'}
            className="w-full h-full object-cover"
          />
        ) : null}

        {/* Play overlay para vídeo */}
        {kind === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-gray-700/80 rounded-full w-10 h-10 flex items-center justify-center">
              <span className="text-white text-sm ml-0.5">▶</span>
            </div>
          </div>
        )}
      </div>

      {/* Body — rounded-b pra encaixar */}
      <div className="px-2.5 py-1.5 rounded-b-lg">
        {kind === 'documento' ? (
          <div className="flex items-center gap-2">
            <span className="text-red-600 text-base leading-none">📄</span>
            <span className="text-sm text-gray-900 truncate">
              {data.filename || 'document.pdf'}
            </span>
          </div>
        ) : (
          <p className="text-[13px] text-gray-900 leading-snug line-clamp-2">
            {data.caption ||
              (kind === 'imagem'
                ? 'Descrição da imagem'
                : 'Descrição do vídeo')}
          </p>
        )}

        {(data.meta || kind === 'documento') && (
          <div
            className={`mt-1 text-[10px] truncate ${
              isUser ? 'text-wpp-text-time-user' : 'text-wpp-text-time'
            }`}
          >
            {data.meta || (kind === 'documento' ? '1 page · 262 KB · pdf' : '')}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(MediaNode);
