'use client';

import { useStore, ViewportPortal, type ReactFlowState } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';

/**
 * HelperLines — guias visuais de alinhamento exibidas durante o drag de um
 * node, indicando quando ele alinha (em X ou Y) com OUTRO node próximo.
 *
 * Comportamento (estilo Figma):
 *  - Detecta alinhamento de borda esquerda/direita/centro em X
 *  - Detecta alinhamento de borda superior/inferior/centro em Y
 *  - Tolerância de TOL pixels pra "considerar alinhado"
 *  - Renderiza linhas magentas tracejadas que atravessam o canvas
 *
 * Renderizado dentro de ViewportPortal pra acompanhar zoom/pan do canvas.
 *
 * NÃO faz snapping ainda — só mostra a guia. Snapping seria modificar
 * `position` durante `onNodeDrag` no FlowEditor. Pode ser adicionado depois.
 */

const TOL = 5; // pixels de tolerância pra considerar alinhado
const NODE_FALLBACK_W = 200;
const NODE_FALLBACK_H = 80;

interface Lines {
  horizontal: number | null; // y do alinhamento horizontal (linha estende em X)
  vertical: number | null;   // x do alinhamento vertical (linha estende em Y)
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

function getBounds(node: FluxoNode): Bounds {
  // Ordem de prioridade pra dimensões:
  //  1. `node.measured` — DOM real medido pelo React Flow após render (mais fiel)
  //  2. `node.data.width/height` — explicitamente setado (ex: frames)
  //  3. `node.width/height` — explícito no node (legado/manual)
  //  4. fallback constante
  //
  // Sem usar `measured`, btn-short (130px) ou bubble-bot (380px) usariam o
  // fallback 200, fazendo o cálculo de borda direita/inferior dar errado.
  const w =
    node.measured?.width ??
    (node.data?.width as number | undefined) ??
    node.width ??
    NODE_FALLBACK_W;
  const h =
    node.measured?.height ??
    (node.data?.height as number | undefined) ??
    node.height ??
    NODE_FALLBACK_H;
  return {
    left: node.position.x,
    right: node.position.x + w,
    top: node.position.y,
    bottom: node.position.y + h,
    centerX: node.position.x + w / 2,
    centerY: node.position.y + h / 2,
  };
}

function selectHelperLines(state: ReactFlowState): Lines {
  // Acha o node sendo arrastado
  const nodes = state.nodes as unknown as FluxoNode[];
  const dragging = nodes.find((n) => n.dragging);
  if (!dragging) return { horizontal: null, vertical: null };

  const A = getBounds(dragging);
  let horizontal: number | null = null;
  let vertical: number | null = null;

  // Tipos que NÃO entram na detecção de alinhamento (são children visuais)
  const skipTypes = new Set([
    'tracking',
    'excecao',
    'btn-short', // botões em row são posicionados automaticamente
  ]);

  for (const n of nodes) {
    if (n.id === dragging.id) continue;
    if (skipTypes.has(n.type ?? '')) continue;
    // Frames são úteis pra alinhar com bordas do container
    const B = getBounds(n);

    // Verticais (X): borda esquerda, direita ou centro
    if (vertical === null) {
      if (Math.abs(A.left - B.left) < TOL) vertical = B.left;
      else if (Math.abs(A.right - B.right) < TOL) vertical = B.right;
      else if (Math.abs(A.centerX - B.centerX) < TOL) vertical = B.centerX;
      else if (Math.abs(A.left - B.right) < TOL) vertical = B.right;
      else if (Math.abs(A.right - B.left) < TOL) vertical = B.left;
    }

    // Horizontais (Y): borda superior, inferior ou centro
    if (horizontal === null) {
      if (Math.abs(A.top - B.top) < TOL) horizontal = B.top;
      else if (Math.abs(A.bottom - B.bottom) < TOL) horizontal = B.bottom;
      else if (Math.abs(A.centerY - B.centerY) < TOL) horizontal = B.centerY;
      else if (Math.abs(A.top - B.bottom) < TOL) horizontal = B.bottom;
      else if (Math.abs(A.bottom - B.top) < TOL) horizontal = B.top;
    }

    // Achou ambos — pode parar
    if (vertical !== null && horizontal !== null) break;
  }

  return { horizontal, vertical };
}

export default function HelperLines() {
  const { horizontal, vertical } = useStore(selectHelperLines);

  if (horizontal === null && vertical === null) return null;

  // Cor magenta vibrante (estilo Figma); tamanho grande pra cobrir o canvas
  const LINE = 'rgba(236, 72, 153, 0.9)'; // pink-500
  const SPAN = 20000; // px — atravessa o canvas inteiro

  return (
    <ViewportPortal>
      {horizontal !== null && (
        <div
          style={{
            position: 'absolute',
            left: -SPAN / 2,
            top: horizontal,
            width: SPAN,
            height: 1,
            background: LINE,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      )}
      {vertical !== null && (
        <div
          style={{
            position: 'absolute',
            left: vertical,
            top: -SPAN / 2,
            width: 1,
            height: SPAN,
            background: LINE,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      )}
    </ViewportPortal>
  );
}
