/**
 * Alinhar / distribuir nodes selecionados.
 *
 * Função pura: recebe `nodes`, `ids` (selecionados) e `op` → retorna NOVA
 * lista de nodes com `position` ajustada para os ids.
 *
 * Regras:
 *  - Nodes com `parentId` (children: trackings, exceções) são IGNORADOS —
 *    a position deles é relativa ao parent, alinhamento absoluto quebra
 *    a relação.
 *  - Frames também são ignorados — alinhamento entre containers raramente
 *    é o que o user quer (eles são âncoras visuais).
 *  - Precisa de >= 2 ids elegíveis pra alinhar; >= 3 pra distribuir.
 *
 * Tudo testável sem React.
 */

import type { FluxoNode } from '@/lib/types';
import { getNodeBox } from './helpers';

export type AlignOp =
  | 'align-left'
  | 'align-right'
  | 'align-center-h'
  | 'align-top'
  | 'align-bottom'
  | 'align-center-v'
  | 'distribute-h'
  | 'distribute-v';

/**
 * Quantos nodes elegíveis a operação tem (sem aplicar). Útil pra UI
 * exibir "Selecione 3 ou mais" etc.
 */
export function countEligible(nodes: FluxoNode[], ids: string[]): number {
  return ids
    .map((id) => nodes.find((n) => n.id === id))
    .filter(
      (n): n is FluxoNode => !!n && !n.parentId && n.type !== 'frame'
    ).length;
}

/**
 * Mínimo de nodes elegíveis pra cada operação.
 */
export function minimumFor(op: AlignOp): number {
  return op.startsWith('distribute') ? 3 : 2;
}

/**
 * Aplica a operação. Retorna nova lista de nodes (preserva ordem e
 * referências dos não-afetados).
 */
export function alignNodes(
  nodes: FluxoNode[],
  ids: string[],
  op: AlignOp
): FluxoNode[] {
  const targets = ids
    .map((id) => nodes.find((n) => n.id === id))
    .filter(
      (n): n is FluxoNode => !!n && !n.parentId && n.type !== 'frame'
    );

  if (targets.length < minimumFor(op)) return nodes;

  // Position updates (id → { x, y }). Só altera o que muda.
  const updates = new Map<string, { x?: number; y?: number }>();

  const boxes = targets.map((n) => ({ n, box: getNodeBox(n) }));

  switch (op) {
    case 'align-left': {
      const minX = Math.min(...boxes.map((b) => b.box.x));
      for (const { n } of boxes) updates.set(n.id, { x: minX });
      break;
    }
    case 'align-right': {
      const maxRight = Math.max(...boxes.map((b) => b.box.x + b.box.w));
      for (const { n, box } of boxes) updates.set(n.id, { x: maxRight - box.w });
      break;
    }
    case 'align-center-h': {
      // Eixo X centralizado pelo centro médio dos targets
      const avgCx =
        boxes.reduce((acc, b) => acc + (b.box.x + b.box.w / 2), 0) / boxes.length;
      for (const { n, box } of boxes) updates.set(n.id, { x: avgCx - box.w / 2 });
      break;
    }
    case 'align-top': {
      const minY = Math.min(...boxes.map((b) => b.box.y));
      for (const { n } of boxes) updates.set(n.id, { y: minY });
      break;
    }
    case 'align-bottom': {
      const maxBottom = Math.max(...boxes.map((b) => b.box.y + b.box.h));
      for (const { n, box } of boxes) updates.set(n.id, { y: maxBottom - box.h });
      break;
    }
    case 'align-center-v': {
      const avgCy =
        boxes.reduce((acc, b) => acc + (b.box.y + b.box.h / 2), 0) / boxes.length;
      for (const { n, box } of boxes) updates.set(n.id, { y: avgCy - box.h / 2 });
      break;
    }
    case 'distribute-h': {
      // Ordena por centro X. Mantém extremos. Distribui o gap interno.
      const sorted = [...boxes].sort(
        (a, b) => a.box.x + a.box.w / 2 - (b.box.x + b.box.w / 2)
      );
      const first = sorted[0]!.box;
      const last = sorted[sorted.length - 1]!.box;
      const totalSpan = last.x + last.w - first.x;
      const totalW = sorted.reduce((acc, s) => acc + s.box.w, 0);
      const gap = (totalSpan - totalW) / (sorted.length - 1);
      let cursor = first.x + first.w + gap;
      // Extremos não mudam — só os do meio.
      for (let i = 1; i < sorted.length - 1; i++) {
        const s = sorted[i]!;
        updates.set(s.n.id, { x: cursor });
        cursor += s.box.w + gap;
      }
      break;
    }
    case 'distribute-v': {
      const sorted = [...boxes].sort(
        (a, b) => a.box.y + a.box.h / 2 - (b.box.y + b.box.h / 2)
      );
      const first = sorted[0]!.box;
      const last = sorted[sorted.length - 1]!.box;
      const totalSpan = last.y + last.h - first.y;
      const totalH = sorted.reduce((acc, s) => acc + s.box.h, 0);
      const gap = (totalSpan - totalH) / (sorted.length - 1);
      let cursor = first.y + first.h + gap;
      for (let i = 1; i < sorted.length - 1; i++) {
        const s = sorted[i]!;
        updates.set(s.n.id, { y: cursor });
        cursor += s.box.h + gap;
      }
      break;
    }
  }

  if (updates.size === 0) return nodes;

  return nodes.map((n) => {
    const u = updates.get(n.id);
    if (!u) return n;
    return {
      ...n,
      position: {
        x: u.x !== undefined ? u.x : n.position.x,
        y: u.y !== undefined ? u.y : n.position.y,
      },
    };
  });
}
