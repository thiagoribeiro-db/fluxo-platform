import type { FluxoNode, FluxoNodeType } from '@/lib/types';

/**
 * Helpers compartilhados de criação/manipulação de nodes.
 *
 * REGRAS-CHAVE:
 *
 * 1) IDs (códigos) são por FRAME, não por tipo de node.
 *    - Cada frame define um `prefix` (ex: "S", "O", "T", "E")
 *    - Blocos dentro do frame recebem {prefix}{sequencial}: S001, S002, O001…
 *    - Bloco fora de qualquer frame → prefixo "X" como fallback
 *
 * 2) Tracking automático: só em Bubble BOT (1 exibicao) e Menu (exibicao + selecao + inesperado).
 *    Bubble USER NUNCA tem tracking auto.
 *    Trackings ficam à ESQUERDA do bloco (não abaixo).
 */

// =============================================================================
// PADRÕES / CONSTANTES
// =============================================================================
export const FALLBACK_PREFIX = 'X'; // usado quando o node está fora de qualquer frame

// Altura aproximada de cada tipo (usada pra posicionar próximo node abaixo
// quando `node.measured` ainda não está disponível — caso típico após upload
// via IA + autoOrganize, que roda ANTES do React Flow medir os nodes).
//
// Valores calibrados a partir do CSS real dos componentes:
//  - bubble-bot/user: ~70-80px de altura com 1-2 linhas de texto
//  - menu: ~250-310 dependendo do número de opções
export const APPROX_HEIGHT_BY_TYPE: Partial<Record<FluxoNodeType, number>> = {
  frame: 400,
  'bubble-bot': 80,
  'bubble-user': 70,
  'btn-short': 50,
  'btn-long': 50,
  menu: 310, // ~5 opções; cresce dinamicamente quando measured ok
  tracking: 50,
  excecao: 50,
  direcionamento: 50,
  condicional: 60,
  'atendimento-humano': 44,
  link: 110,
};

export const APPROX_WIDTH_BY_TYPE: Partial<Record<FluxoNodeType, number>> = {
  frame: 540,
  'bubble-bot': 380,
  'bubble-user': 380,
  'btn-short': 120,
  'btn-long': 240,
  menu: 320,
  tracking: 240,
  excecao: 240,
  direcionamento: 240,
};

export const GAP = 24;
export const TRACKING_GAP_X = 16;
export const TRACKING_HEIGHT = 44;
export const TRACKING_WIDTH_APPROX = 240;
// Posicionamento RELATIVO da exceção em relação ao USER (parentId).
// Agora vai ABAIXO (não à direita) pra ficar dentro do frame após organize.
export const EXCECAO_REL_X = 0;
export const EXCECAO_REL_Y = 140;

// =============================================================================
// BOUNDING BOX & FRAME DETECTION
// =============================================================================
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getNodeBox(node: FluxoNode): Box {
  const type = node.type as FluxoNodeType;
  const w =
    (node.data?.width as number | undefined) ??
    APPROX_WIDTH_BY_TYPE[type] ??
    200;
  const h =
    (node.data?.height as number | undefined) ??
    APPROX_HEIGHT_BY_TYPE[type] ??
    100;
  return { x: node.position.x, y: node.position.y, w, h };
}

function pointInBox(px: number, py: number, b: Box): boolean {
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/**
 * Retorna o frame que contém este ponto (x, y). Se houver vários (frames aninhados),
 * retorna o de MENOR área — o "mais íntimo".
 */
export function findContainingFrameAt(
  x: number,
  y: number,
  nodes: FluxoNode[]
): FluxoNode | undefined {
  const candidates = nodes.filter(
    (n) => n.type === 'frame' && pointInBox(x, y, getNodeBox(n))
  );
  if (!candidates.length) return undefined;
  return candidates.sort((a, b) => {
    const ba = getNodeBox(a);
    const bb = getNodeBox(b);
    return ba.w * ba.h - bb.w * bb.h;
  })[0];
}

/**
 * Frame que contém este node específico.
 */
export function findContainingFrame(
  node: FluxoNode,
  allNodes: FluxoNode[]
): FluxoNode | undefined {
  if (node.type === 'frame') return undefined;
  // Usa o ponto médio do node pra evitar conflito com vizinhos
  const box = getNodeBox(node);
  return findContainingFrameAt(box.x + box.w / 2, box.y + box.h / 2, allNodes);
}

// =============================================================================
// PREFIX RESOLUTION
// =============================================================================
/**
 * Devolve o prefix do frame, com fallback inteligente:
 *   1. data.prefix se definido
 *   2. primeira letra do title (uppercase) se title existir
 *   3. "X"
 */
export function resolveFramePrefix(frame: FluxoNode | undefined): string {
  if (!frame) return FALLBACK_PREFIX;
  const explicit = frame.data?.prefix as string | undefined;
  if (explicit && explicit.trim()) return explicit.trim().toUpperCase();
  const title = frame.data?.title as string | undefined;
  if (title && title.trim()) {
    // Pega iniciais das palavras maiúsculas, ou primeira letra
    const initials = title
      .trim()
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase())
      .filter(Boolean)
      .join('');
    if (initials) return initials.length > 3 ? initials[0] : initials;
  }
  return FALLBACK_PREFIX;
}

// =============================================================================
// SLUGIFY (nomes de tracking a partir do texto)
// =============================================================================
export function slugify(text: string, maxLen = 30): string {
  if (!text) return 'sem_texto';
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove diacríticos
      .replace(/[^a-z0-9\s_]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, maxLen)
      .replace(/_+$/, '') || 'sem_texto'
  );
}

// =============================================================================
// GENERATE NEXT CODE — POR FRAME (não por tipo)
// =============================================================================
/**
 * Devolve o próximo código no escopo de um prefixo (= frame).
 *
 * Conta apenas códigos do mesmo prefixo, achando o menor inteiro disponível.
 * Ex: prefix="S", existentes [S001, S003] → devolve S002.
 */
export function generateNextCodeForPrefix(
  prefix: string,
  existingNodes: FluxoNode[]
): string {
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i');
  const used = new Set<number>();
  for (const n of existingNodes) {
    const code = n.data?.code as string | undefined;
    if (!code) continue;
    const m = code.match(re);
    if (m) used.add(parseInt(m[1], 10));
  }
  let next = 1;
  while (used.has(next)) next++;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

/**
 * Wrapper conveniente: encontra o frame que contém a posição (x, y), pega
 * o prefix dele e devolve o próximo código.
 */
export function generateNextCodeForPosition(
  position: { x: number; y: number },
  existingNodes: FluxoNode[]
): string {
  const frame = findContainingFrameAt(position.x, position.y, existingNodes);
  const prefix = resolveFramePrefix(frame);
  return generateNextCodeForPrefix(prefix, existingNodes);
}

// =============================================================================
// REORGANIZE — renumera tudo em sequência por frame, ordenado por Y
// =============================================================================
export function reorganizeCodes(nodes: FluxoNode[]): FluxoNode[] {
  // 1) Agrupa nodes (não-frame, não-tracking, não-exceção) pelo frame que
  //    os contém. Trackings e exceções NÃO têm código — são "filhas".
  const buckets = new Map<string, FluxoNode[]>(); // prefix → nodes
  const frames = nodes.filter((n) => n.type === 'frame');

  // Tipos que NUNCA recebem code sequencial (S001, S002, ...).
  //
  // Lista:
  //  - frame: recebe prefix puro como "code", tratado depois
  //  - tracking/excecao: children visuais agregados ao parent
  //  - bubble-user: input do usuário, sem ID (resposta, não unidade emissora)
  //  - btn-short/btn-long: botões são "ação" do bloco anterior, não bloco próprio
  //  - midia-*: mídias representam conteúdo da bubble anterior
  //  - link: card de URL externa, conteúdo do sender (igual mídia)
  //
  // direcionamento TEM código (é unidade endereçável de salto).
  const NO_CODE_TYPES = new Set<string>([
    'frame',
    'tracking',
    'excecao',
    'bubble-user',
    'btn-short',
    'btn-long',
    'condicional',
    'atendimento-humano',
    'link',
    'midia-imagem-bot',
    'midia-imagem-user',
    'midia-documento-bot',
    'midia-documento-user',
    'midia-video-bot',
    'midia-video-user',
  ]);

  for (const node of nodes) {
    if (!node.type || NO_CODE_TYPES.has(node.type)) continue;
    const frame = findContainingFrame(node, nodes);
    const prefix = resolveFramePrefix(frame);
    if (!buckets.has(prefix)) buckets.set(prefix, []);
    buckets.get(prefix)!.push(node);
  }

  // 2) Pra cada bucket, ordena por Y e atribui códigos sequenciais
  const newCodeMap = new Map<string, string>(); // node.id → novo code
  for (const [prefix, list] of buckets.entries()) {
    list.sort(
      (a, b) => a.position.y - b.position.y || a.position.x - b.position.x
    );
    list.forEach((n, idx) => {
      newCodeMap.set(n.id, `${prefix}${String(idx + 1).padStart(3, '0')}`);
    });
  }

  // 3) Frames mantêm o code = prefix (sem número)
  for (const f of frames) {
    const p = resolveFramePrefix(f);
    newCodeMap.set(f.id, p);
  }

  return nodes.map((n) => {
    const newCode = newCodeMap.get(n.id);
    if (newCode === undefined) return n;
    return { ...n, data: { ...n.data, code: newCode } };
  });
}

// =============================================================================
// POSITIONING
// =============================================================================
export function getPositionBelow(
  refNode: FluxoNode | undefined,
  fallback: { x: number; y: number } = { x: 200, y: 200 }
): { x: number; y: number } {
  if (!refNode) return fallback;
  const type = refNode.type as FluxoNodeType;
  const height =
    (refNode.data?.height as number | undefined) ??
    APPROX_HEIGHT_BY_TYPE[type] ??
    100;
  return {
    x: refNode.position.x,
    y: refNode.position.y + height + GAP,
  };
}

/**
 * Posição "à esquerda" de um node de referência (usado pra colocar trackings).
 * Posição ABSOLUTA (no canvas).
 *
 * Se `stackIdx` > 0, empilha verticalmente (vários trackings p/ menu).
 */
export function getPositionLeft(
  refNode: FluxoNode,
  stackIdx = 0
): { x: number; y: number } {
  return {
    x: refNode.position.x - TRACKING_WIDTH_APPROX - TRACKING_GAP_X,
    y: refNode.position.y + stackIdx * (TRACKING_HEIGHT + 8),
  };
}

/**
 * Posição "à esquerda" RELATIVA ao node parent (usado quando tracking tem
 * parentId — React Flow trata position como relativa ao parent).
 *
 * O parent é o bubble/menu; o tracking aparece deslocado pra esquerda dele.
 */
export function getRelativePositionLeft(stackIdx = 0): { x: number; y: number } {
  return {
    x: -TRACKING_WIDTH_APPROX - TRACKING_GAP_X,
    y: stackIdx * (TRACKING_HEIGHT + 8),
  };
}

// =============================================================================
// ORGANIZAR LAYOUT — alinha componentes principais em coluna vertical
// =============================================================================
/**
 * Tipos "principais" do fluxo (bubbles, menus, mídias, integrações, IAG)
 * que entram no auto-layout.
 *
 * Trackings, exceções, frames e direcionamentos NÃO são reposicionados aqui:
 *  - Trackings/exceções: são children (parentId) — seguem o parent
 *  - Frames: containers
 *  - Direcionamentos: ficam onde o usuário pôs
 */
// Tipos que entram na coluna VERTICAL do organize.
// btn-short, btn-long e direcionamento NÃO entram aqui — recebem tratamento
// especial (grid horizontal) numa etapa posterior do organize.
export const MAIN_FLOW_TYPES = new Set<FluxoNodeType>([
  'bubble-bot',
  'bubble-user',
  'menu',
  'condicional',
  'atendimento-humano',
  'link',
  'midia-imagem-bot',
  'midia-imagem-user',
  'midia-documento-bot',
  'midia-documento-user',
  'midia-video-bot',
  'midia-video-user',
  'integracao-api',
  'integracao-planilha',
  'iag-entrada',
  'iag-reentrada',
  'iag-saida',
]);

// Tipos que ficam em GRID HORIZONTAL ao FINAL do frame (depois de todos os
// mains). Tipicamente: direcionamentos de saída do menu principal.
//
// IMPORTANTE: `btn-short` foi REMOVIDO daqui — botões curtos devem ficar
// INLINE logo após o bot/menu que faz a pergunta (ex: "Em qual estado?" →
// [Pernambuco] [Paraíba]), NÃO empurrados pro fim do frame. A lógica inline
// é implementada na main loop do `organizeLayoutByFrame`.
export const GRID_FLOW_TYPES = new Set<FluxoNodeType>([
  'direcionamento',
]);

export const LAYOUT_VERTICAL_GAP = 12;       // gap pequeno entre cards
export const LAYOUT_RIGHT_MARGIN = 16;       // encosta perto da borda direita
export const LAYOUT_TOP_PADDING = 50;        // espaço pro header
export const LAYOUT_BOTTOM_PADDING = 40;     // espaço inferior antes de fechar o frame
export const LAYOUT_COL_WIDTH = 300;         // (legado)

/**
 * Reorganiza componentes principais (bubbles, menus, mídias, integrações, IAG)
 * alinhando-os em coluna vertical à direita do frame mais próximo.
 *
 * Lógica de agrupamento:
 *  1. Se o componente está DENTRO de um frame (bounding box) → grupo desse frame
 *  2. Senão, atribui ao frame MAIS PRÓXIMO (menor distância euclidiana)
 *  3. Se não houver frame, alinha pela coluna média dos componentes
 *
 * Children (trackings, exceções com parentId) movem automaticamente porque
 * sua position é relativa ao parent.
 *
 * `getMeasured` (opcional): callback que retorna as dimensões REAIS medidas
 * pelo React Flow após o render. Quando fornecido, é preferido sobre os
 * valores aproximados de `APPROX_WIDTH_BY_TYPE` / `APPROX_HEIGHT_BY_TYPE`.
 */
export function organizeLayoutByFrame(
  nodes: FluxoNode[],
  getMeasured?: (id: string) => { w: number; h: number } | undefined
): FluxoNode[] {
  // Helper local: usa medições reais quando disponíveis, senão fallback approx.
  const measuredBox = (n: FluxoNode): Box => {
    if (getMeasured) {
      const m = getMeasured(n.id);
      if (m && m.w > 0 && m.h > 0) {
        return { x: n.position.x, y: n.position.y, w: m.w, h: m.h };
      }
    }
    return getNodeBox(n);
  };

  // Inclui todos os frames (travados ou não) como possíveis containers
  const frames = nodes.filter((n) => n.type === 'frame');

  const mains = nodes.filter(
    (n) =>
      n.type &&
      !n.parentId &&
      MAIN_FLOW_TYPES.has(n.type as FluxoNodeType)
  );

  if (mains.length === 0) return nodes;

  // Agrupar mains por frame: containing → fallback nearest → órfão
  const groupByFrame = new Map<string, FluxoNode[]>();
  const orphans: FluxoNode[] = [];

  for (const m of mains) {
    if (frames.length === 0) {
      orphans.push(m);
      continue;
    }

    const box = measuredBox(m);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;

    // 1. Tenta containing
    let target: FluxoNode | undefined = findContainingFrameAt(cx, cy, nodes);

    // 2. Fallback: frame mais próximo (centroid)
    if (!target) {
      let minDist = Infinity;
      for (const f of frames) {
        const fbox = measuredBox(f);
        const fcx = fbox.x + fbox.w / 2;
        const fcy = fbox.y + fbox.h / 2;
        const dist = Math.hypot(cx - fcx, cy - fcy);
        if (dist < minDist) {
          minDist = dist;
          target = f;
        }
      }
    }

    if (target) {
      if (!groupByFrame.has(target.id)) groupByFrame.set(target.id, []);
      groupByFrame.get(target.id)!.push(m);
    } else {
      orphans.push(m);
    }
  }

  const next = [...nodes];
  const idxById = new Map<string, number>();
  next.forEach((n, i) => idxById.set(n.id, i));

  // Reposiciona cada grupo no respectivo frame e redimensiona o frame
  for (const [frameId, list] of groupByFrame) {
    list.sort(
      (a, b) =>
        a.position.y - b.position.y || a.position.x - b.position.x
    );

    const frame = frames.find((f) => f.id === frameId);
    if (!frame) continue;
    const fbox = measuredBox(frame);

    // Width máximo do grupo (usado pra calcular o tamanho mínimo do frame)
    const maxW = Math.max(...list.map((m) => measuredBox(m).w));

    // Width NECESSÁRIO do frame: tracking-à-esquerda + bubble + margens
    // Layout interno: [margem-esquerda] [tracking 240px] [gap 16px] [bubble maxW] [margem-direita]
    const requiredWidth =
      24 + TRACKING_WIDTH_APPROX + TRACKING_GAP_X + maxW + LAYOUT_RIGHT_MARGIN;
    const newWidth = Math.max(400, requiredWidth); // mínimo de 400px

    // Borda direita compartilhada por todos os componentes (alinha PELA DIREITA real)
    const rightEdge = fbox.x + newWidth - LAYOUT_RIGHT_MARGIN;

    // Pré-coleta btn-shorts pertencentes a este frame (pra colocar INLINE
    // entre os mains que os "ownam" — a pergunta que antecede os botões).
    // Usa containment de frame (centro do btn) pra associar.
    const frameBtnShorts = nodes.filter((n) => {
      if (n.type !== 'btn-short' || n.parentId) return false;
      const bbox = measuredBox(n);
      const cx = bbox.x + bbox.w / 2;
      const cy = bbox.y + bbox.h / 2;
      const containing = findContainingFrameAt(cx, cy, nodes);
      return containing?.id === frame.id;
    });

    let currentY = fbox.y + LAYOUT_TOP_PADDING;
    for (let mainIdx = 0; mainIdx < list.length; mainIdx++) {
      const comp = list[mainIdx];
      const compBox = measuredBox(comp);
      const i = idxById.get(comp.id);
      if (i === undefined) continue;

      // X individual: cada componente alinha sua borda direita com rightEdge
      const origY = comp.position.y; // Y ORIGINAL (antes de reposicionar)
      next[i] = {
        ...next[i],
        position: { x: rightEdge - compBox.w, y: currentY },
      };

      // Gap normal entre componentes — se bubble-user tem exceção child,
      // somar a altura extra (exceção ABAIXO ocupa EXCECAO_REL_Y + ~50px)
      let extraGap = 0;
      if (comp.type === 'bubble-user') {
        const hasExcecao = nodes.some(
          (n) => n.type === 'excecao' && n.parentId === comp.id
        );
        if (hasExcecao) extraGap = EXCECAO_REL_Y + 50 - compBox.h;
      }
      currentY += compBox.h + Math.max(0, extraGap) + LAYOUT_VERTICAL_GAP;

      // INLINE btn-shorts: encontra os btns cuja posição original estava
      // ENTRE este main e o próximo. Coloca em row logo após o main.
      // Heurística: btn.y >= main.origY && (sem próximo OU btn.y < próximo.origY)
      const nextOrigY =
        mainIdx + 1 < list.length ? list[mainIdx + 1].position.y : Infinity;
      const inlineBtns = frameBtnShorts
        .filter((b) => b.position.y >= origY && b.position.y < nextOrigY)
        .sort((a, b) => a.position.x - b.position.x);

      if (inlineBtns.length > 0) {
        const BTN_W = 130;
        const BTN_H = 50;
        const GAP_X = 12;
        const cols = inlineBtns.length;
        const totalW = cols * BTN_W + (cols - 1) * GAP_X;
        const startX = fbox.x + (newWidth - totalW) / 2;

        inlineBtns.forEach((b, idx) => {
          const bi = idxById.get(b.id);
          if (bi === undefined) return;
          next[bi] = {
            ...next[bi],
            position: {
              x: startX + idx * (BTN_W + GAP_X),
              y: currentY,
            },
          };
        });
        currentY += BTN_H + LAYOUT_VERTICAL_GAP;
      }
    }

    // ----- GRID HORIZONTAL: btn-short + direcionamentos dentro do frame ---
    // Encontra btn-short e direcionamentos não-children que estão dentro deste frame
    // pelo centro (ponto médio). Posiciona em grid horizontal abaixo dos mains.
    const gridItems = nodes
      .filter((n) => {
        if (n.parentId) return false;
        if (!n.type || !GRID_FLOW_TYPES.has(n.type as FluxoNodeType)) return false;
        const box = measuredBox(n);
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const containing = findContainingFrameAt(cx, cy, nodes);
        if (containing?.id === frame.id) return true;
        // Também aceita "mais próximo" pra direcionamentos que escaparam
        if (!containing && frames.length > 0) {
          let minDist = Infinity;
          let nearest: FluxoNode | undefined;
          for (const f of frames) {
            const fb = measuredBox(f);
            const dist = Math.hypot(
              cx - (fb.x + fb.w / 2),
              cy - (fb.y + fb.h / 2)
            );
            if (dist < minDist) {
              minDist = dist;
              nearest = f;
            }
          }
          return nearest?.id === frame.id;
        }
        return false;
      })
      .sort(
        (a, b) =>
          a.position.y - b.position.y || a.position.x - b.position.x
      );

    if (gridItems.length > 0) {
      // ITEM_W reduzido de 230 → 145 pra permitir 4 colunas em frame estreito
      // (676px). Direcionamentos com label curto cabem sem overflow; labels
      // longos (ex: "Cartão de crédito") podem encostar, mas é aceitável
      // visualmente (espelha o layout manual do usuário).
      const ITEM_W = 145;
      const ITEM_H = 50;
      const GAP_X = 12;
      const GAP_Y = 8;
      const innerW = newWidth - 2 * 20;
      const perRow = Math.max(1, Math.floor((innerW + GAP_X) / (ITEM_W + GAP_X)));
      const rows = Math.ceil(gridItems.length / perRow);
      const totalW = perRow * ITEM_W + (perRow - 1) * GAP_X;
      const startX = fbox.x + (newWidth - totalW) / 2;

      gridItems.forEach((g, idx) => {
        const col = idx % perRow;
        const row = Math.floor(idx / perRow);
        const i = idxById.get(g.id);
        if (i === undefined) return;
        next[i] = {
          ...next[i],
          position: {
            x: startX + col * (ITEM_W + GAP_X),
            y: currentY + row * (ITEM_H + GAP_Y),
          },
        };
      });

      currentY += rows * (ITEM_H + GAP_Y) + LAYOUT_VERTICAL_GAP;
    }

    // Redimensiona o frame pra caber exatamente o conteúdo
    const requiredHeight = currentY - fbox.y + LAYOUT_BOTTOM_PADDING;
    const newHeight = Math.max(200, requiredHeight);

    const fi = idxById.get(frame.id);
    if (fi !== undefined) {
      next[fi] = {
        ...next[fi],
        data: {
          ...next[fi].data,
          width: newWidth,
          height: newHeight,
        },
      };
    }
  }

  // Órfãos (sem frame disponível): alinha numa coluna pela média de X
  if (orphans.length > 0) {
    orphans.sort(
      (a, b) =>
        a.position.y - b.position.y || a.position.x - b.position.x
    );
    const avgX =
      orphans.reduce((s, n) => s + n.position.x, 0) / orphans.length;
    let currentY = orphans[0].position.y;
    for (const m of orphans) {
      const box = measuredBox(m);
      const i = idxById.get(m.id);
      if (i === undefined) continue;
      next[i] = {
        ...next[i],
        position: { x: avgX, y: currentY },
      };
      currentY += box.h + LAYOUT_VERTICAL_GAP;
    }
  }

  return next;
}
