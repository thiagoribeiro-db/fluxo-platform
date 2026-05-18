'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';

/**
 * AtendimentoHumanoNode — marca o TRANSBORDO do bot pro atendimento humano.
 *
 * Visual: pílula compacta laranja vibrante (#F97316) com ícone 👤.
 *
 * Use quando o fluxo automatizado ENCERRA e um humano assume. É terminal
 * do bot — geralmente não tem saída (ou tem uma saída opcional pra "Algo Mais"
 * depois do humano finalizar).
 *
 * NÃO recebe `code` — é marcador semântico, não unidade emissora.
 */
function AtendimentoHumanoNode({ data, selected }: NodeProps<FluxoNode>) {
  const label =
    (data.label as string | undefined) || 'Atendimento humano';

  return (
    <div
      className={`relative ${
        selected ? 'ring-2 ring-orange-600 ring-offset-2 rounded-full' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-orange-600 !w-2.5 !h-2.5 !top-[-5px]"
      />

      <div
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-orange-500 text-white text-xs font-semibold shadow-sm border border-orange-600"
        style={{ minWidth: 160 }}
      >
        <span className="text-sm leading-none" aria-hidden="true">
          👤
        </span>
        <span>{label}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-orange-600 !w-2.5 !h-2.5 !bottom-[-5px]"
      />
    </div>
  );
}

export default memo(AtendimentoHumanoNode);
