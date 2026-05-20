'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import CodeBadge from './CodeBadge';

/**
 * Tracking — pílula azul que registra um evento analítico no fluxo.
 *
 * Inputs: data.label (string — nome do evento)
 *
 * REGRA DE LAYOUT ("anchor right edge"):
 * O tracking fica à ESQUERDA do bubble parent, com a borda direita ENCOSTADA
 * (com GAP) na borda esquerda do bubble. Como o label pode variar (curto:
 * "saudacao_exibicao", longo: "baixe_o_nosso_app_na_loja_de_a_exibicao"), a
 * largura visual varia também — mas a posição React Flow do node é FIXA em
 * `parent.x - 256` (= -TRACKING_WIDTH_APPROX - TRACKING_GAP_X).
 *
 * O `transform: translateX(calc(240px - 100%))` faz a pílula visualmente
 * EXPANDIR PRA ESQUERDA conforme o label cresce, mantendo a borda direita
 * sempre em `position.x + 240` (= `parent.x - 16`). Sem isso, labels longos
 * vazariam pra DIREITA, invadindo o bubble.
 *
 * O valor 240 TEM que bater com TRACKING_WIDTH_APPROX em helpers.ts.
 */
function TrackingNode({ data, selected }: NodeProps<FluxoNode>) {
  return (
    <div
      className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}
      style={{ transform: 'translateX(calc(240px - 100%))' }}
    >
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
