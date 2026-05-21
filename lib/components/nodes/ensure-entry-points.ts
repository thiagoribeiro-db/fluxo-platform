/**
 * Auto-fix: pra cada frame que tem mains mas NENHUM entry-point dentro,
 * cria um nó `entry-point` posicionado acima do primeiro main e conecta
 * com edge ao primeiro main.
 *
 * Função pura — retorna novos nodes/edges, não muta a entrada.
 *
 * USO típico: chamada após `organizeLayoutByFrame` no `handleOrganizeLayout`
 * pra preencher os marcadores de início faltando.
 */
import type { Edge } from '@xyflow/react';
import { nanoid } from 'nanoid';
import type { FluxoNode, FluxoNodeType } from '@/lib/types';

const MAIN_TYPES: Set<string> = new Set([
  'bubble-bot', 'bubble-user', 'menu',
  'midia-imagem-bot', 'midia-imagem-user',
  'midia-documento-bot', 'midia-documento-user',
  'midia-video-bot', 'midia-video-user',
  'link', 'direcionamento', 'condicional', 'atendimento-humano',
  'integracao-api', 'integracao-planilha',
  'iag-entrada', 'iag-reentrada', 'iag-saida',
]);

interface EnsureResult {
  nodes: FluxoNode[];
  edges: Edge[];
  /** Quantos entry-points novos foram criados. */
  created: number;
}

export function ensureEntryPointsForFrames(
  inputNodes: FluxoNode[],
  inputEdges: Edge[]
): EnsureResult {
  const nodes = [...inputNodes];
  const edges = [...inputEdges];
  let created = 0;

  // Função pra checar se um node está dentro do bbox de um frame
  const insideBBox = (
    n: FluxoNode,
    fx: number,
    fy: number,
    fw: number,
    fh: number
  ): boolean => {
    if (n.parentId) return false;
    const cx = n.position.x + 100;
    const cy = n.position.y + 30;
    return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
  };

  const frames = nodes.filter((n) => n.type === 'frame');

  for (const frame of frames) {
    const fx = frame.position.x;
    const fy = frame.position.y;
    const fw = (frame.data?.width as number | undefined) ?? 656;
    const fh = (frame.data?.height as number | undefined) ?? 400;

    // Já tem entry-point dentro?
    const hasEntryPoint = nodes.some(
      (n) => n.type === 'entry-point' && insideBBox(n, fx, fy, fw, fh)
    );
    if (hasEntryPoint) continue;

    // Acha mains dentro, ordenados por Y (primeiro = mais alto)
    const mainsInside = nodes
      .filter((n) => n.type && MAIN_TYPES.has(n.type) && insideBBox(n, fx, fy, fw, fh))
      .sort(
        (a, b) =>
          a.position.y - b.position.y || a.position.x - b.position.x
      );

    if (mainsInside.length === 0) continue; // frame vazio — não cria
    const firstMain = mainsInside[0];

    // Posiciona o entry-point ACIMA do primeiro main, dentro do bbox.
    // Width aproximada do entry-point: 130px (pílula "▶ INÍCIO").
    // Vertical: 40px acima do main, mas clampa pra não sair do topo do frame.
    const desiredY = firstMain.position.y - 40;
    const minY = fy + 8; // pequena margem do topo
    const epY = Math.max(minY, desiredY);
    // Horizontal: alinhado com o primeiro main (que costuma estar à direita
    // do frame após organize-layout)
    const epX = firstMain.position.x;

    const epId = `entry-${nanoid(6)}`;
    const entryPoint: FluxoNode = {
      id: epId,
      type: 'entry-point' as FluxoNodeType,
      position: { x: epX, y: epY },
      data: { label: 'Início' },
    };
    nodes.push(entryPoint);

    // Edge entry-point → primeiro main
    edges.push({
      id: `e-entry-${nanoid(6)}`,
      source: epId,
      target: firstMain.id,
      animated: true,
    });

    created++;
  }

  return { nodes, edges, created };
}
