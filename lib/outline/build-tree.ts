/**
 * Constrói a árvore de outline a partir dos nodes/edges do canvas.
 *
 * Estrutura: Frames no topo (ordenados por posição vertical/horizontal),
 * cada frame contém os blocos que estão DENTRO dos bounds (não-children
 * visuais como tracking/exceção). Blocos órfãos (fora de qualquer frame)
 * vão no grupo "Sem frame".
 *
 * Função PURA — sem dependência do React Flow runtime. Testável.
 */
import type { FluxoNode } from '@/lib/types';

export type OutlineNodeKind = 'frame' | 'orphan-group' | 'block';

export interface OutlineNode {
  kind: OutlineNodeKind;
  /** ID do node original (ou 'orphans' pro grupo). */
  id: string;
  /** Label exibido na árvore. */
  label: string;
  /** Code do bloco (ex: S001) — só pra `block`. */
  code?: string;
  /** Tipo do node original — pra ícone/cor. */
  nodeType?: string;
  /** Emoji/glyph rápido pra renderização. */
  emoji?: string;
  /** Pra frame: prefix (ex: "S"). */
  prefix?: string;
  /** Pra frame: frameId slug. */
  frameId?: string;
  /** Children (só pra frame/orphan-group). */
  children?: OutlineNode[];
  /** Pra direcionamento: pra onde aponta. */
  targetFrameId?: string;
}

/**
 * Emoji + label "humano" por tipo de node. Usado pra renderização rápida.
 */
function describeBlock(n: FluxoNode): { emoji: string; label: string } {
  const d = n.data ?? {};
  const truncate = (s: string, n = 60) =>
    s.length > n ? s.slice(0, n - 1) + '…' : s;

  switch (n.type) {
    case 'entry-point':
      return { emoji: '▶️', label: (d.label as string) || 'Início' };
    case 'bubble-bot':
      return { emoji: '💬', label: truncate((d.text as string) || 'Bubble bot') };
    case 'bubble-user':
      return { emoji: '👤', label: truncate((d.text as string) || 'Bubble user') };
    case 'menu':
      return { emoji: '📋', label: truncate((d.header as string) || 'Menu') };
    case 'btn-short':
      return { emoji: '🔘', label: truncate((d.label as string) || 'Botão curto') };
    case 'btn-long':
      return { emoji: '⬜', label: truncate((d.label as string) || 'Botão longo') };
    case 'direcionamento':
      return {
        emoji: '🎯',
        label: truncate((d.label as string) || 'Direcionamento'),
      };
    case 'condicional':
      return {
        emoji: '🔀',
        label: truncate((d.condition as string) || (d.label as string) || 'Condicional'),
      };
    case 'atendimento-humano':
      return {
        emoji: '🧑‍💼',
        label: truncate((d.label as string) || 'Atendimento humano'),
      };
    case 'link':
      return { emoji: '🔗', label: truncate((d.linkTitle as string) || (d.url as string) || 'Link') };
    case 'tracking':
      return { emoji: '📊', label: truncate((d.label as string) || 'Tracking') };
    case 'excecao':
      return { emoji: '⚠️', label: truncate((d.label as string) || 'Exceção') };
    case 'integracao-api':
      return { emoji: '🔌', label: truncate((d.title as string) || 'API') };
    case 'integracao-planilha':
      return { emoji: '📊', label: truncate((d.title as string) || 'Planilha') };
    case 'iag-entrada':
      return { emoji: '🤖', label: truncate((d.title as string) || 'IAG entrada') };
    case 'iag-saida':
      return { emoji: '🤖', label: truncate((d.title as string) || 'IAG saída') };
    case 'iag-reentrada':
      return { emoji: '🤖', label: truncate((d.title as string) || 'IAG reentrada') };
    case 'midia-imagem-bot':
    case 'midia-imagem-user':
      return { emoji: '🖼️', label: truncate((d.caption as string) || 'Imagem') };
    case 'midia-documento-bot':
    case 'midia-documento-user':
      return { emoji: '📄', label: truncate((d.filename as string) || (d.caption as string) || 'Documento') };
    case 'midia-video-bot':
    case 'midia-video-user':
      return { emoji: '🎥', label: truncate((d.caption as string) || 'Vídeo') };
    default:
      return { emoji: '◾', label: n.type ?? 'Bloco' };
  }
}

/**
 * Tipos que NÃO aparecem como entradas separadas na outline — são
 * "children visuais" do bloco pai (têm parentId) e poluiriam a árvore.
 * O usuário consegue ver e editar trackings/exceções clicando no pai
 * no canvas.
 */
const HIDDEN_TYPES = new Set<string>([
  'tracking',
  'excecao',
  'btn-short', // botões em row são "ação" de um menu/bubble — não bloco isolado
  'btn-long',
]);

/**
 * Verifica se o "centro" do node está dentro dos bounds de um frame.
 * Usa medidas reais quando disponíveis, senão valores aproximados.
 */
function isInsideFrame(node: FluxoNode, frame: FluxoNode): boolean {
  const fLeft = frame.position.x;
  const fTop = frame.position.y;
  const fW =
    frame.measured?.width ?? (frame.data?.width as number | undefined) ?? 540;
  const fH =
    frame.measured?.height ?? (frame.data?.height as number | undefined) ?? 400;
  const cx = node.position.x + (node.measured?.width ?? 50);
  const cy = node.position.y + (node.measured?.height ?? 25);
  return cx >= fLeft && cx <= fLeft + fW && cy >= fTop && cy <= fTop + fH;
}

export interface BuildOutlineOptions {
  /** Texto pra filtrar (busca em label/code/frameId). Case-insensitive. */
  query?: string;
}

/**
 * Constrói a árvore. Aplica filtro de query se informado.
 */
export function buildOutlineTree(
  nodes: FluxoNode[],
  opts: BuildOutlineOptions = {}
): OutlineNode[] {
  const q = (opts.query ?? '').trim().toLowerCase();

  const frames = nodes.filter((n) => n.type === 'frame');
  const blocks = nodes.filter(
    (n) =>
      n.type !== 'frame' &&
      !n.parentId &&
      n.type &&
      !HIDDEN_TYPES.has(n.type)
  );

  // Constrói entradas dos frames ordenadas por posição
  const sortedFrames = [...frames].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x
  );

  const tree: OutlineNode[] = [];
  const usedBlockIds = new Set<string>();

  for (const frame of sortedFrames) {
    const children: OutlineNode[] = [];
    const inside = blocks
      .filter((b) => isInsideFrame(b, frame))
      .sort(
        (a, b) => a.position.y - b.position.y || a.position.x - b.position.x
      );

    for (const block of inside) {
      usedBlockIds.add(block.id);
      const desc = describeBlock(block);
      const code = block.data?.code as string | undefined;
      const targetFrameId = block.data?.targetFrameId as string | undefined;
      children.push({
        kind: 'block',
        id: block.id,
        label: desc.label,
        emoji: desc.emoji,
        code,
        nodeType: block.type,
        targetFrameId,
      });
    }

    const frameLabel = (frame.data?.title as string) || (frame.data?.frameId as string) || 'Frame';
    const prefix = frame.data?.prefix as string | undefined;
    const frameId = frame.data?.frameId as string | undefined;

    tree.push({
      kind: 'frame',
      id: frame.id,
      label: frameLabel,
      emoji: '📦',
      prefix,
      frameId,
      children,
    });
  }

  // Blocos órfãos (fora de qualquer frame)
  const orphans = blocks.filter((b) => !usedBlockIds.has(b.id));
  if (orphans.length > 0) {
    const children: OutlineNode[] = orphans
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
      .map((b) => {
        const desc = describeBlock(b);
        return {
          kind: 'block' as const,
          id: b.id,
          label: desc.label,
          emoji: desc.emoji,
          code: b.data?.code as string | undefined,
          nodeType: b.type,
          targetFrameId: b.data?.targetFrameId as string | undefined,
        };
      });
    tree.push({
      kind: 'orphan-group',
      id: 'orphans',
      label: 'Sem frame',
      emoji: '🌫️',
      children,
    });
  }

  // Aplica filtro: mantém frames com pelo menos 1 child matching, ou que
  // o próprio frame faça match no label/prefix/frameId.
  if (!q) return tree;

  function matches(n: OutlineNode): boolean {
    const haystack = `${n.label} ${n.code ?? ''} ${n.prefix ?? ''} ${n.frameId ?? ''}`.toLowerCase();
    return haystack.includes(q);
  }

  return tree
    .map((frame) => {
      const selfMatch = matches(frame);
      const matchedChildren = (frame.children ?? []).filter(matches);
      if (selfMatch) {
        // Frame match: mantém TODOS os children (user quer ver o frame inteiro)
        return frame;
      }
      if (matchedChildren.length > 0) {
        return { ...frame, children: matchedChildren };
      }
      return null;
    })
    .filter((f): f is OutlineNode => f !== null);
}
