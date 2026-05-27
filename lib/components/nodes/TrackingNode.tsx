'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import { parseTrackingLabel, type TrackingSuffix } from '@/lib/codes/tracking-labels';
import CodeBadge from './CodeBadge';

/**
 * Tracking — pílula que registra um evento analítico no fluxo.
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
 *
 * CORES POR TIPO:
 * O sufixo do label define o tipo do evento e a cor da pílula (CSS via
 * `data-kind` em globals.css). Labels customizados (sem sufixo conhecido)
 * mantêm o roxo padrão.
 *   - exibicao  → azul     (mensagem foi exibida)
 *   - selecao   → verde    (usuário selecionou opção)
 *   - input     → âmbar    (input do usuário foi recebido)
 *   - inesperado → vermelho (resposta fora do fluxo esperado)
 */
const ICON_BY_KIND: Record<TrackingSuffix, string> = {
  exibicao: '👁️',
  selecao: '✅',
  input: '⌨️',
  inesperado: '⚠️',
};

function TrackingNode({ data, selected }: NodeProps<FluxoNode>) {
  const label = data.label || 'Tracking';
  const parsed = parseTrackingLabel(label);
  const kind = parsed?.suffix;
  const icon = kind ? ICON_BY_KIND[kind] : '📊';

  return (
    <div
      className={`relative ${selected ? 'ring-2 ring-blip-purple ring-offset-2 rounded-lg' : ''}`}
      style={{ transform: 'translateX(calc(240px - 100%))' }}
    >
      <CodeBadge code={data.code} />
      <Handle type="target" position={Position.Top} className="!bg-blip-purple" />

      <div className="tracking" data-kind={kind}>
        <span className="tracking-icon">{icon}</span>
        <span className="tracking-label">{label}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blip-purple" />
    </div>
  );
}

export default memo(TrackingNode);
