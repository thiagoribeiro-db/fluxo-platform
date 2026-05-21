import type { Edge } from '@xyflow/react';
import type { FluxoNode, FluxoNodeType } from '@/lib/types';
import { devLog, devWarn } from '@/lib/utils/logger';

/**
 * Helpers compartilhados de criação/manipulação de nodes.
 *
 * ╔═══════════════════════ TABLE OF CONTENTS ═══════════════════════════╗
 * ║                                                                     ║
 * ║  1. PADRÕES / CONSTANTES        (~L18-L80)                          ║
 * ║     APPROX_W/H, GAPs, padding, DIAMOND_COLUMN_SPACING               ║
 * ║                                                                     ║
 * ║  2. BOUNDING BOX & FRAME        (~L80-L170)                         ║
 * ║     Box, getNodeBox, findContainingFrame*, findOwnerFrame           ║
 * ║                                                                     ║
 * ║  3. PREFIX RESOLUTION           (~L170-L200)                        ║
 * ║     resolveFramePrefix, FALLBACK_PREFIX                             ║
 * ║                                                                     ║
 * ║  4. TRACKING LABELS             → lib/codes/tracking-labels.ts      ║
 * ║     (re-exportado aqui pra retro-compat)                            ║
 * ║                                                                     ║
 * ║  5. CÓDIGOS POR FRAME           (~L300-L450)                        ║
 * ║     generateNextCode*, reorganizeCodes (S001, OF002, etc.)          ║
 * ║                                                                     ║
 * ║  6. POSICIONAMENTO              (~L450-L500)                        ║
 * ║     getPositionBelow, getPositionLeft, getRelativePositionLeft      ║
 * ║                                                                     ║
 * ║  7. EDGES REPAIR                (~L520-L640)                        ║
 * ║     repairMainFlowEdges (cuida de btns órfãos e atalhos)            ║
 * ║                                                                     ║
 * ║  8. DIAMOND LAYOUT              (~L640-L900)                        ║
 * ║     buildMainSuccessors, computeDiamondLayout (BFS + cascata)       ║
 * ║                                                                     ║
 * ║  9. ORGANIZE LAYOUT             (~L900-FIM)                         ║
 * ║     organizeLayoutByFrame (entrypoint do botão "Organizar")         ║
 * ║                                                                     ║
 * ╚═════════════════════════════════════════════════════════════════════╝
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
// Largura "âncora" do tracking — TEM que bater com o valor usado dentro do
// TrackingNode no `transform: translateX(calc(240px - 100%))`. Mudou um, muda
// o outro. Esse valor anchora a BORDA DIREITA visual do tracking no
// `bubble.x - TRACKING_GAP_X`, então quando o label cresce a pílula expande
// pra ESQUERDA em vez de invadir o bubble.
export const TRACKING_WIDTH_APPROX = 240;

// Posicionamento RELATIVO da exceção em relação ao USER (parentId).
//
// REGRA: exceção fica HORIZONTALMENTE ALINHADA À DIREITA do bubble-user,
// a uma distância fixa (EXCECAO_GAP_X). Esses constants são usados como
// fallback na CRIAÇÃO inicial — o `organizeLayoutByFrame` recalcula REL_X
// dinamicamente baseado na largura MEDIDA do bubble-user, garantindo que o
// gap seja respeitado mesmo com bubbles de tamanhos variados.
export const EXCECAO_REL_X = 240; // ≈ bubble-user width médio (200) + GAP (16) com folga
export const EXCECAO_REL_Y = 0;   // mesmo Y do bubble-user
export const EXCECAO_GAP_X = 16;  // gap entre bubble-user e exceção
export const EXCECAO_APPROX_WIDTH = 200; // pílula compacta — pouca variação

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

/**
 * Frame "dono" de um node, com prioridade SEMÂNTICA sobre espacial:
 *  1. Se o node tem `data.code` no formato `<prefix><número>` (ex: "S001",
 *     "OF002"), procura um frame com `resolveFramePrefix` == prefix. Match
 *     exclusivo do code wins sobre posição.
 *  2. Senão (ou se nenhum frame casa o prefix), fallback pra containment
 *     espacial via `findContainingFrame`.
 *
 * Motivo: depois de um organize que reposicionou blocos, posições podem
 * vazar pra dentro de frames vizinhos. Mas o `code` é estável e expressa
 * a intenção — bloco "S001" pertence à Saudação não importa onde caiu.
 */
export function findOwnerFrame(
  node: FluxoNode,
  allNodes: FluxoNode[]
): FluxoNode | undefined {
  if (node.type === 'frame') return undefined;
  const code = node.data?.code as string | undefined;
  if (code) {
    const m = code.match(/^([A-Z]+)\d+$/);
    if (m) {
      const prefix = m[1];
      const byPrefix = allNodes.find(
        (n) => n.type === 'frame' && resolveFramePrefix(n) === prefix
      );
      if (byPrefix) return byPrefix;
    }
  }
  return findContainingFrame(node, allNodes);
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
// TRACKING LABELS — re-export de lib/codes/tracking-labels.ts
// =============================================================================
// O código real mora em `lib/codes/tracking-labels.ts` (módulo puro,
// testável isoladamente). Mantemos esse re-export aqui pra retro-compat
// com imports antigos que vinham de `@/lib/components/nodes/helpers`.
export {
  TRACKING_SUFFIXES,
  type TrackingSuffix,
  slugify,
  extractTrackingName,
  parseTrackingLabel,
} from '@/lib/codes/tracking-labels';

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
  //  - atendimento-humano: terminal do fluxo automatizado, não numerado
  //
  // direcionamento E condicional TÊM código (são unidades endereçáveis).
  // condicional especificamente é referenciado nas mensagens-de-corte da
  // cascata do frame "Falar com atendente" (FA001 = É feriado?, FA002 =
  // mensagem-de-corte, FA003 = É final de semana?, etc.).
  const NO_CODE_TYPES = new Set<string>([
    'frame',
    'tracking',
    'excecao',
    'bubble-user',
    'btn-short',
    'btn-long',
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

// Distância horizontal entre os CENTROS de duas colunas adjacentes no
// layout em diamante. 420 mantém um gap visual de ~70px entre o bubble
// da mensagem-de-corte (380px) e a cond (320px) — leitura agradável,
// claramente associando msg ↔ cond, sem espaço sobrando.
//
// Trade-off: pra branches paralelos REAIS (2 mains lado a lado com tracking
// em ambos os lados) seria preciso ~660px. Esses casos são raros — quando
// aparecem, o tracking de um pode invadir visualmente o outro. Aceitamos
// esse risco em troca da proximidade que melhora muito a leitura das
// cascatas (que são o caso comum).
export const DIAMOND_COLUMN_SPACING = 420;

// =============================================================================
// DIAMOND LAYOUT (in progress — passos 1+2 do plano)
// =============================================================================
/**
 * Tipos "transparentes" para o grafo de mains: arestas que passam por eles
 * são consideradas continuidade entre os mains nas pontas. Botões representam
 * "ramificação imediata" do main pai.
 */
const TRANSPARENT_TYPES = new Set<FluxoNodeType>(['btn-short', 'btn-long']);

/**
 * Reescreve as edges de um fluxo pra respeitar a sequência lógica:
 * `pergunta (main) → opção (btn-short) → resposta (main)`. Lida com dois
 * cenários:
 *
 *   (A) **Edge atalho com btns órfãos** — main_A tem edge direta pra main_B
 *       E há btns órfãos saindo de main_A (sem edge de saída). O parser/IA
 *       criou os btns mas não os conectou ao destino. Auto-repair: cria
 *       edges `btn → main_B` para cada órfão e remove a direta. Só dispara
 *       quando existe APENAS UMA edge direta saindo de main_A — havendo
 *       mais de uma, fica ambíguo e só logamos warn.
 *
 *   (B) **Edge redundante** — main_A → main_B direta E já existe caminho
 *       alternativo main_A → btn → ... → main_B. Aqui só removemos a direta;
 *       não criamos nada.
 *
 * Edges main→main legítimas (linha sem decisão, sem btns no caminho) são
 * preservadas.
 */
export function repairMainFlowEdges(
  edges: Edge[],
  nodes: FluxoNode[]
): Edge[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const isMain = (id: string): boolean => {
    const n = nodeById.get(id);
    return !!n?.type && MAIN_FLOW_TYPES.has(n.type as FluxoNodeType);
  };
  const isTransparent = (id: string): boolean => {
    const n = nodeById.get(id);
    return !!n?.type && TRANSPARENT_TYPES.has(n.type as FluxoNodeType);
  };

  const outAdj = new Map<string, string[]>();
  const inAdj = new Map<string, string[]>();
  for (const e of edges) {
    if (!outAdj.has(e.source)) outAdj.set(e.source, []);
    outAdj.get(e.source)!.push(e.target);
    if (!inAdj.has(e.target)) inAdj.set(e.target, []);
    inAdj.get(e.target)!.push(e.source);
  }

  const toRemove = new Set<string>();
  const toAdd: Edge[] = [];
  let repairCounter = 0;
  const mkRepairId = () =>
    `e-repair-${Date.now().toString(36)}-${repairCounter++}`;

  // Agrupa edges main→main por source pra detectar ambiguidade
  const directMainEdgesBySource = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!isMain(e.source) || !isMain(e.target)) continue;
    if (e.source === e.target) continue;
    if (!directMainEdgesBySource.has(e.source))
      directMainEdgesBySource.set(e.source, []);
    directMainEdgesBySource.get(e.source)!.push(e);
  }

  // Processa cada source: tenta (A) repair, senão (B) redundancy check
  for (const [source, directEdges] of directMainEdgesBySource) {
    // Btns órfãos saindo deste source
    const orphanBtns = (outAdj.get(source) ?? [])
      .map((id) => nodeById.get(id))
      .filter(
        (n): n is FluxoNode =>
          !!n &&
          isTransparent(n.id) &&
          (outAdj.get(n.id)?.length ?? 0) === 0
      );

    if (orphanBtns.length > 0) {
      // (A) Auto-repair — só quando há 1 destino claro
      if (directEdges.length === 1) {
        const direct = directEdges[0];
        for (const btn of orphanBtns) {
          toAdd.push({
            id: mkRepairId(),
            source: btn.id,
            target: direct.target,
          });
        }
        toRemove.add(direct.id);
        if (typeof window !== 'undefined') {

          devLog(
            `[repair] conectando ${orphanBtns.length} btn(s) órfãos ao destino e removendo edge direta`,
            {
              source,
              target: direct.target,
              btns: orphanBtns.map((b) => b.id),
            }
          );
        }
        continue;
      }
      // Ambíguo: vários destinos main + btns órfãos → não dá pra mapear automaticamente
      if (typeof window !== 'undefined') {

        devWarn(
          `[repair] AMBÍGUO: source ${source} tem ${directEdges.length} edges main→main e ${orphanBtns.length} btn(s) órfãos. Não vou consertar automaticamente.`,
          {
            source,
            targets: directEdges.map((e) => e.target),
            btns: orphanBtns.map((b) => b.id),
          }
        );
      }
      continue;
    }

    // (B) Sem órfãos: checa redundância clássica (caminho alternativo via btn já completo)
    for (const e of directEdges) {
      const seen = new Set<string>([e.source]);
      const queue: string[] = [];
      for (const t of outAdj.get(e.source) ?? []) {
        if (t === e.target) continue;
        queue.push(t);
      }
      let viaBtn = false;
      while (queue.length) {
        const cur = queue.shift()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        if (cur === e.target) {
          viaBtn = true;
          break;
        }
        if (isTransparent(cur)) {
          for (const nxt of outAdj.get(cur) ?? []) queue.push(nxt);
        }
      }
      if (viaBtn) toRemove.add(e.id);
    }
  }

  if (toRemove.size > 0 && typeof window !== 'undefined') {

    devLog(
      `[repair] removendo ${toRemove.size} edge(s) redundante(s) main→main`
    );
  }

  return [...edges.filter((e) => !toRemove.has(e.id)), ...toAdd];
}

/**
 * @deprecated use {@link repairMainFlowEdges}. Mantida só pra retro-compat
 * imediato dentro deste módulo; remover em seguida.
 */
export const removeRedundantMainEdges = repairMainFlowEdges;

/**
 * Para cada main do frame, devolve os mains do MESMO frame alcançáveis via
 * BFS pelas edges, atravessando `btn-short`/`btn-long` como nós transparentes.
 *
 * `direcionamento`, `condicional` e qualquer outro tipo NÃO são atravessados —
 * eles são pontos de saída do frame (ou ramificações que merecem tratamento
 * próprio mais à frente).
 */
function buildMainSuccessors(
  frameMains: FluxoNode[],
  edges: Edge[],
  allNodes: FluxoNode[]
): Map<string, string[]> {
  const mainIds = new Set(frameMains.map((m) => m.id));
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  const outAdj = new Map<string, string[]>();
  for (const e of edges) {
    if (!outAdj.has(e.source)) outAdj.set(e.source, []);
    outAdj.get(e.source)!.push(e.target);
  }

  const succ = new Map<string, string[]>();
  for (const m of frameMains) {
    const reached: string[] = [];
    const seen = new Set<string>([m.id]);
    const queue: string[] = [m.id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const next of outAdj.get(cur) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        if (mainIds.has(next)) {
          if (!reached.includes(next)) reached.push(next);
          continue; // para em main
        }
        const n = nodeById.get(next);
        if (n?.type && TRANSPARENT_TYPES.has(n.type as FluxoNodeType)) {
          queue.push(next);
        }
        // outros tipos (direcionamento, condicional, tracking, etc.) não propagam
      }
    }
    succ.set(m.id, reached);
  }
  return succ;
}

export interface MainGraphInfo {
  id: string;
  code: string;
  type: string;
  depth: number;
  column: number;
  isLateral: boolean;
  succ: string[];
  pred: string[];
}

/**
 * Tipos que, quando aparecem como FILHO de uma ramificação E não têm
 * sucessores próprios (terminal), não contam como branch principal —
 * representam saídas laterais do fluxo principal. Tipicamente:
 *  - `condicional`: ponto de decisão lateral (admin/erro/fallback)
 *  - `atendimento-humano`: transbordo (terminal da automação)
 *
 * Esses filhos recebem coluna lateral (negativa, fora do bloco principal)
 * e o(s) filho(s) conversacional(is) herda(m) a coluna do pai.
 */
const LATERAL_MAIN_TYPES = new Set<FluxoNodeType>([
  'condicional',
  'atendimento-humano',
]);

/**
 * BFS layer-by-layer a partir das raízes do frame. Calcula (depth, column,
 * isLateral) para cada main:
 *  - depth: max sobre os predecessores + 1 (lida com merges)
 *  - column: filhos de branch (>1 sucessor) recebem offsets simétricos
 *           -⌊N/2⌋..+⌈N/2⌉ APENAS pra filhos conversacionais; laterais
 *           terminais ficam em coluna negativa fora (não inflam o frame).
 *           Filho conversacional único herda coluna do pai.
 *           Merges recebem média das colunas dos predecessores.
 *  - isLateral: true quando o nó representa saída lateral (cond/hum
 *               terminal) — usado pra excluir do cálculo de numCols.
 */
function computeDiamondLayout(
  frameMains: FluxoNode[],
  succ: Map<string, string[]>,
  edges: Edge[] = []
): Map<string, { depth: number; column: number; isLateral: boolean }> {
  // Mapa rápido (source,target) → sourceHandle (se houver). Usado pra
  // decidir o LADO do cutoff: edges saindo do handle "true" (saída TRUE,
  // verde, à esquerda da cond visualmente) → cutoff à ESQUERDA da coluna
  // central. Edges saindo de "false" (vermelho, à direita) → cutoff à
  // DIREITA. Edges sem sourceHandle são consideradas FALSE (default).
  const handleByEdge = new Map<string, 'true' | 'false'>();
  for (const e of edges) {
    if (e.sourceHandle === 'true' || e.sourceHandle === 'false') {
      handleByEdge.set(`${e.source}->${e.target}`, e.sourceHandle);
    }
  }
  const isTrueCutoff = (parentId: string, childId: string): boolean =>
    handleByEdge.get(`${parentId}->${childId}`) === 'true';
  const mainById = new Map(frameMains.map((m) => [m.id, m]));
  const isLateralTerminal = (id: string): boolean => {
    const n = mainById.get(id);
    if (!n?.type) return false;
    if (!LATERAL_MAIN_TYPES.has(n.type as FluxoNodeType)) return false;
    return (succ.get(id) ?? []).length === 0;
  };

  const pred = new Map<string, string[]>();
  for (const [from, tos] of succ.entries()) {
    for (const to of tos) {
      if (!pred.has(to)) pred.set(to, []);
      pred.get(to)!.push(from);
    }
  }

  const roots = frameMains.filter(
    (m) => !pred.has(m.id) || pred.get(m.id)!.length === 0
  );

  const depth = new Map<string, number>();
  const column = new Map<string, number>();
  const lateral = new Set<string>();
  const queue: string[] = [];
  for (const r of roots) {
    depth.set(r.id, 0);
    column.set(r.id, 0);
    queue.push(r.id);
  }

  // Helpers de classificação dos filhos em CASCATAS (cond→msg→cond→...):
  //   - "continuation": tem sucessores, continua a cadeia
  //   - "center-terminal": atendimento-humano terminal — é o destino lógico
  //     (caso da última cond da cascata FA)
  //   - "leaf": qualquer outro terminal — vira mensagem-de-corte lateral
  const hasSucc = (id: string) => (succ.get(id) ?? []).length > 0;
  const isAtendimentoTerminal = (id: string) => {
    const n = mainById.get(id);
    return n?.type === 'atendimento-humano' && !hasSucc(id);
  };

  // BFS — pode revisitar nodes em caso de merge (atualiza depth=max)
  let guard = 0;
  while (queue.length && guard++ < 10000) {
    const id = queue.shift()!;
    const d = depth.get(id) ?? 0;
    const c = column.get(id) ?? 0;
    const children = succ.get(id) ?? [];
    if (children.length === 0) continue;

    // Classifica filhos:
    //  - continuations: continuam a cascata (têm succ)
    //  - cascadeCutoffs: terminais que viram MENSAGEM-DE-CORTE da cascata
    //    (à DIREITA da coluna central, mesma depth+1 mas col+1, +2…)
    //  - condHumLeftLaterals: cond/hum terminais ÓRFÃOS (sem irmão
    //    continuation nem center-terminal) — vão pra coluna lateral à
    //    ESQUERDA (compat. com o comportamento anterior)
    const continuations = children.filter(hasSucc);
    const terminals = children.filter((id) => !hasSucc(id));
    const centerTerminals = terminals.filter(isAtendimentoTerminal);

    // Decide quem é "centro" e quem é "lateral direita" (mensagem-de-corte)
    let centerChildren: string[];
    let cutoffChildren: string[];
    if (continuations.length > 0) {
      // Caso comum cascata: cond pai com filho que continua + terminais laterais
      centerChildren = continuations;
      cutoffChildren = terminals;
    } else if (centerTerminals.length > 0) {
      // Última cond da cascata FA: atend-humano vira centro, outros laterais
      centerChildren = centerTerminals;
      cutoffChildren = terminals.filter((id) => !isAtendimentoTerminal(id));
    } else {
      // Sem continuação nem center-terminal — branch puro
      centerChildren = terminals;
      cutoffChildren = [];
    }

    // Posiciona filhos do CENTRO
    if (centerChildren.length === 1) {
      const child = centerChildren[0];
      const newD = d + 1;
      if (!depth.has(child) || depth.get(child)! < newD) depth.set(child, newD);
      if (!column.has(child)) column.set(child, c);
      queue.push(child);
    } else if (centerChildren.length > 1) {
      const N = centerChildren.length;
      centerChildren.forEach((child, idx) => {
        const offset = idx - (N - 1) / 2;
        const newD = d + 1;
        if (!depth.has(child) || depth.get(child)! < newD) depth.set(child, newD);
        if (!column.has(child)) column.set(child, c + offset);
        queue.push(child);
      });
    }

    // Posiciona MENSAGENS-DE-CORTE — o LADO depende do sourceHandle da edge:
    //   TRUE (saída verde, à esquerda da cond)  → coluna c-1, c-2, …
    //   FALSE (saída vermelha, à direita)        → coluna c+1, c+2, …
    // Esse alinhamento bate com a posição visual dos handles do
    // ConditionalNode (handle TRUE no bottom-left, FALSE no bottom-right),
    // evitando edges cruzadas.
    let leftIdx = 0;
    let rightIdx = 0;
    for (const child of cutoffChildren) {
      const newD = d + 1;
      if (!depth.has(child) || depth.get(child)! < newD) depth.set(child, newD);
      if (!column.has(child)) {
        if (isTrueCutoff(id, child)) {
          leftIdx++;
          column.set(child, c - leftIdx);
        } else {
          rightIdx++;
          column.set(child, c + rightIdx);
        }
      }
      queue.push(child);
      // NÃO marcamos como lateral — esses ocupam espaço real do bloco
    }

    // CASO RARO compat: cond/hum terminal SEM irmão de continuação E SEM
    // irmão center-terminal → coluna lateral à ESQUERDA, fora do bloco
    // (não infla numCols). Mantém o comportamento "saída lateral" antigo.
    if (continuations.length === 0 && centerTerminals.length === 0) {
      const orphanLaterals = children.filter(isLateralTerminal);
      orphanLaterals.forEach((child, idx) => {
        if (!column.has(child)) column.set(child, -2 - idx);
        lateral.add(child);
      });
    }
  }

  // Resolução de MERGES: só pra mains conversacionais
  for (const m of frameMains) {
    if (lateral.has(m.id)) continue;
    const ps = pred.get(m.id) ?? [];
    if (ps.length > 1) {
      const avg =
        ps.reduce((s, p) => s + (column.get(p) ?? 0), 0) / ps.length;
      column.set(m.id, avg);
    }
  }

  const out = new Map<
    string,
    { depth: number; column: number; isLateral: boolean }
  >();
  for (const m of frameMains) {
    out.set(m.id, {
      depth: depth.get(m.id) ?? 0,
      column: column.get(m.id) ?? 0,
      isLateral: lateral.has(m.id),
    });
  }
  return out;
}

/**
 * Empacota dados estruturados pra log/inspeção visual durante o passo de
 * validação do layout em diamante.
 */
function buildMainGraphReport(
  frameMains: FluxoNode[],
  succ: Map<string, string[]>,
  layout: Map<
    string,
    { depth: number; column: number; isLateral: boolean }
  >
): MainGraphInfo[] {
  const pred = new Map<string, string[]>();
  for (const [from, tos] of succ.entries()) {
    for (const to of tos) {
      if (!pred.has(to)) pred.set(to, []);
      pred.get(to)!.push(from);
    }
  }
  const codeOf = (id: string): string => {
    const n = frameMains.find((m) => m.id === id);
    return (n?.data?.code as string | undefined) ?? id.slice(0, 6);
  };
  return frameMains
    .map((m) => ({
      id: m.id,
      code: (m.data?.code as string | undefined) ?? m.id.slice(0, 6),
      type: m.type ?? '?',
      depth: layout.get(m.id)?.depth ?? 0,
      column: layout.get(m.id)?.column ?? 0,
      isLateral: layout.get(m.id)?.isLateral ?? false,
      succ: (succ.get(m.id) ?? []).map(codeOf),
      pred: (pred.get(m.id) ?? []).map(codeOf),
    }))
    .sort((a, b) => a.depth - b.depth || a.column - b.column);
}

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
 * `edges`: usado pelo cálculo (em validação) do layout em diamante — quando
 * houver branches/merges entre mains, é a única forma de inferir a topologia.
 * Por enquanto a função CONTINUA aplicando o layout vertical antigo; o cálculo
 * de diamante apenas emite `console.log` por frame pra validação visual.
 *
 * `getMeasured` (opcional): callback que retorna as dimensões REAIS medidas
 * pelo React Flow após o render. Quando fornecido, é preferido sobre os
 * valores aproximados de `APPROX_WIDTH_BY_TYPE` / `APPROX_HEIGHT_BY_TYPE`.
 */
export function organizeLayoutByFrame(
  nodes: FluxoNode[],
  edges: Edge[] = [],
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

    // 1. Prioridade SEMÂNTICA: se o main tem code "S001"-like, manda pro
    //    frame de prefix "S" mesmo que esteja fisicamente em outro lugar.
    //    Resolve o caso em que blocos foram posicionados (manualmente ou
    //    por organize antigo) fora do bbox do seu frame conceitual.
    let target: FluxoNode | undefined = findOwnerFrame(m, nodes);

    // 2. Fallback: frame mais próximo (centroid)
    if (!target) {
      const box = measuredBox(m);
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
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

  // ===========================================================
  // REASSIGN BY GRAPH — mains sem code prefix herdam frame do
  // predecessor mapeado (resolve bubble-user/mídia/link/etc.
  // que ficaram no frame errado pelo containment espacial).
  // ===========================================================
  {
    const nodeByIdLocal = new Map(nodes.map((n) => [n.id, n]));
    const codeRegex = /^[A-Z]+\d+$/;
    const hasCodeAnchor = (n: FluxoNode): boolean => {
      const c = n.data?.code as string | undefined;
      return !!c && codeRegex.test(c);
    };

    // predOfMain[m] = lista de mains que apontam pra m (direto ou via btn)
    const predOfMain = new Map<string, string[]>();
    // Edges out por source
    const outBySource = new Map<string, string[]>();
    for (const e of edges) {
      if (!outBySource.has(e.source)) outBySource.set(e.source, []);
      outBySource.get(e.source)!.push(e.target);
    }
    const mainIdSet = new Set(mains.map((m) => m.id));
    for (const m of mains) {
      // BFS reverso a partir de m via edges, atravessando btns transparentes
      const reached = new Set<string>();
      const seen = new Set<string>([m.id]);
      // Coleta sources que apontam pra m (e atravessa btns)
      for (const e of edges) {
        if (e.target !== m.id) continue;
        const src = nodeByIdLocal.get(e.source);
        if (!src) continue;
        if (mainIdSet.has(src.id)) {
          reached.add(src.id);
        } else if (TRANSPARENT_TYPES.has(src.type as FluxoNodeType)) {
          // Sobe pelas edges que apontam pro btn
          const q = [src.id];
          while (q.length) {
            const cur = q.shift()!;
            if (seen.has(cur)) continue;
            seen.add(cur);
            for (const e2 of edges) {
              if (e2.target !== cur) continue;
              const ss = nodeByIdLocal.get(e2.source);
              if (!ss) continue;
              if (mainIdSet.has(ss.id)) reached.add(ss.id);
              else if (TRANSPARENT_TYPES.has(ss.type as FluxoNodeType))
                q.push(ss.id);
            }
          }
        }
      }
      predOfMain.set(m.id, [...reached]);
    }

    // frame inicial de cada main
    const frameOfMain = new Map<string, string>();
    for (const [fid, list] of groupByFrame) {
      for (const m of list) frameOfMain.set(m.id, fid);
    }

    // Itera: mains SEM code anchor herdam frame do(s) predecessor(es)
    let changed = true;
    let iter = 0;
    while (changed && iter++ < 10) {
      changed = false;
      for (const m of mains) {
        if (hasCodeAnchor(m)) continue;
        const preds = predOfMain.get(m.id) ?? [];
        const currentFrame = frameOfMain.get(m.id);
        // Conta predecessores por frame; escolhe o majoritário
        const counts = new Map<string, number>();
        for (const pid of preds) {
          const pf = frameOfMain.get(pid);
          if (!pf) continue;
          counts.set(pf, (counts.get(pf) ?? 0) + 1);
        }
        if (counts.size === 0) continue;
        let bestFrame = currentFrame;
        let bestCount = currentFrame ? counts.get(currentFrame) ?? 0 : -1;
        for (const [f, c] of counts) {
          if (c > bestCount) {
            bestFrame = f;
            bestCount = c;
          }
        }
        if (bestFrame && bestFrame !== currentFrame) {
          // remove de currentFrame, adiciona em bestFrame
          if (currentFrame) {
            const lst = groupByFrame.get(currentFrame) ?? [];
            groupByFrame.set(
              currentFrame,
              lst.filter((x) => x.id !== m.id)
            );
          }
          if (!groupByFrame.has(bestFrame))
            groupByFrame.set(bestFrame, []);
          groupByFrame.get(bestFrame)!.push(m);
          frameOfMain.set(m.id, bestFrame);
          changed = true;
        }
      }
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

    // ---- DIAMOND LAYOUT (topologia) ----
    // Calcula grafo + depth/column UMA VEZ por frame. Resultado é usado tanto
    // pra decidir se entra no modo diamante quanto pra reposicionar de fato.
    let diamondLayout:
      | Map<string, { depth: number; column: number; isLateral: boolean }>
      | undefined;
    let diamondSucc: Map<string, string[]> | undefined;
    let diamondPred: Map<string, string[]> | undefined;
    let useDiamond = false;
    let diamondMinCol = 0;
    let diamondMaxCol = 0;
    let diamondMaxDepth = 0;
    if (list.length > 1) {
      diamondSucc = buildMainSuccessors(list, edges, nodes);
      const totalEdges = [...diamondSucc.values()].reduce(
        (s, a) => s + a.length,
        0
      );
      if (totalEdges > 0) {
        diamondLayout = computeDiamondLayout(list, diamondSucc, edges);
        diamondPred = new Map<string, string[]>();
        for (const [from, tos] of diamondSucc.entries()) {
          for (const to of tos) {
            if (!diamondPred.has(to)) diamondPred.set(to, []);
            diamondPred.get(to)!.push(from);
          }
        }
        // Branch só conta filhos CONVERSACIONAIS (não-laterais). Se um
        // main tem 2 filhos onde 1 é lateral terminal (cond/hum), não é
        // branch — é continuação linear com saída lateral.
        const mainBranchSucc = new Map<string, string[]>();
        for (const [from, tos] of diamondSucc.entries()) {
          mainBranchSucc.set(
            from,
            tos.filter((id) => !diamondLayout!.get(id)?.isLateral)
          );
        }
        const hasBranch = [...mainBranchSucc.values()].some((s) => s.length > 1);
        const hasMerge = [...diamondPred.values()].some((p) => p.length > 1);
        useDiamond = hasBranch || hasMerge;
        // Cols pra cálculo de width: apenas mains não-laterais
        const mainCols = [...diamondLayout.values()]
          .filter((v) => !v.isLateral)
          .map((v) => v.column);
        const depths = [...diamondLayout.values()].map((v) => v.depth);
        diamondMinCol = mainCols.length ? Math.min(...mainCols) : 0;
        diamondMaxCol = mainCols.length ? Math.max(...mainCols) : 0;
        diamondMaxDepth = depths.length ? Math.max(...depths) : 0;
        if (typeof window !== 'undefined') {
          const report = buildMainGraphReport(list, diamondSucc, diamondLayout);
          const frameTitle =
            (frame.data?.title as string | undefined) ??
            (frame.data?.frameName as string | undefined) ??
            resolveFramePrefix(frame);

          devLog(
            `[diamond] frame="${frameTitle}" mains=${list.length} edges=${totalEdges} useDiamond=${useDiamond}`,
            report
          );
        }
      }
    }

    // Width máximo do grupo (usado pra calcular o tamanho mínimo do frame)
    const maxW = Math.max(...list.map((m) => measuredBox(m).w));

    // Largura efetiva ocupada por trackings DESTE frame. Se algum tracking
    // tem label longo (ex: "baixe_o_nosso_app_na_loja_de_a_exibicao"), sua
    // largura medida pode passar de TRACKING_WIDTH_APPROX (240). O CSS do
    // tracking ancora a BORDA DIREITA no bubble.x - GAP, então a pílula
    // expande pra esquerda — o frame precisa crescer pra contê-la.
    const frameTrackings = nodes.filter(
      (n) =>
        n.type === 'tracking' &&
        n.parentId &&
        list.some((m) => m.id === n.parentId)
    );
    const trackingMaxW = frameTrackings.reduce(
      (m, t) => Math.max(m, measuredBox(t).w),
      TRACKING_WIDTH_APPROX
    );

    // Largura efetiva ocupada por bubble-user+exceção (dupla horizontal).
    // Se algum bubble-user do grupo tem exceção filha, a dupla ocupa
    // (bubble_w + GAP + exceção_w) — verificamos pra garantir que o frame
    // seja largo o suficiente. Caso contrário, organize repõe o bubble-user
    // pra direita demais e a exceção vaza pra fora do frame à direita.
    let userPairMaxW = 0;
    for (const m of list) {
      if (m.type !== 'bubble-user') continue;
      const exc = nodes.find((n) => n.type === 'excecao' && n.parentId === m.id);
      if (!exc) continue;
      const w = measuredBox(m).w + EXCECAO_GAP_X + measuredBox(exc).w;
      if (w > userPairMaxW) userPairMaxW = w;
    }

    // Width NECESSÁRIO do frame: tracking-à-esquerda + max(bubble, dupla user) + margens
    // Layout interno: [margem-esquerda] [tracking] [gap] [main] [margem-direita]
    const contentRightW = Math.max(maxW, userPairMaxW);
    const requiredWidth =
      24 + trackingMaxW + TRACKING_GAP_X + contentRightW + LAYOUT_RIGHT_MARGIN;

    // Em modo diamante o frame precisa acomodar N colunas + tracking na coluna
    // mais à esquerda + margem direita.
    const numCols = useDiamond
      ? Math.ceil(diamondMaxCol) - Math.floor(diamondMinCol) + 1
      : 1;
    const requiredDiamondW = useDiamond
      ? numCols * DIAMOND_COLUMN_SPACING +
        trackingMaxW +
        TRACKING_GAP_X +
        24 +
        LAYOUT_RIGHT_MARGIN
      : 0;

    // Width mínimo pra acomodar direcionamentos em GRID (caso típico
    // do frame AM com 3 direcionamentos lado a lado: Voltar/Atendente/
    // Finalizar). Se o diamond + cascata não pediu width suficiente,
    // o grid de dirs força o frame a crescer pra evitar cortes laterais.
    const frameDirs = nodes.filter((n) => {
      if (n.type !== 'direcionamento' || n.parentId) return false;
      const owner = findOwnerFrame(n, nodes);
      return owner?.id === frame.id;
    });
    const requiredGridW =
      frameDirs.length > 0
        ? (() => {
            const itemW = Math.min(
              260,
              Math.max(145, ...frameDirs.map((d) => measuredBox(d).w))
            );
            // Tenta encaixar em UMA row se ≤4 itens; senão deixa quebrar
            const cols = Math.min(frameDirs.length, 4);
            return cols * itemW + (cols - 1) * 12 + 40;
          })()
        : 0;

    const desiredWidth = Math.max(
      400,
      requiredWidth,
      requiredDiamondW,
      requiredGridW
    );

    // CAP POR VIZINHO: o frame não pode crescer além do x do vizinho à
    // direita (na mesma faixa vertical). Sem esse cap, frames com muitos
    // branches (ou diamond largo) invadem frames adjacentes.
    let maxAllowedW = Infinity;
    const frameTop = fbox.y;
    const frameBot = fbox.y + Math.max(fbox.h, 200);
    for (const other of frames) {
      if (other.id === frame.id) continue;
      const ob = measuredBox(other);
      // Só vizinhos à DIREITA (ob.x > fbox.x)
      if (ob.x <= fbox.x) continue;
      // Só os que tem overlap em Y com o frame atual
      const otherTop = ob.y;
      const otherBot = ob.y + ob.h;
      const overlap = !(otherBot < frameTop || otherTop > frameBot);
      if (!overlap) continue;
      // Margem mínima de respiro entre frames
      const allowed = ob.x - fbox.x - 24;
      if (allowed > 0 && allowed < maxAllowedW) maxAllowedW = allowed;
    }
    const newWidth = Math.min(desiredWidth, maxAllowedW);

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

    if (useDiamond && diamondLayout) {
      // ===========================================================
      // DIAMOND POSITIONING — mains por (depth, column)
      // ===========================================================
      // 1. Altura máxima de cada layer (depth) — todos os mains da
      //    mesma depth recebem o mesmo Y, calculado pela maior altura.
      const maxHeightByDepth = new Map<number, number>();
      for (const m of list) {
        const lay = diamondLayout.get(m.id);
        if (!lay) continue;
        const h = measuredBox(m).h;
        const cur = maxHeightByDepth.get(lay.depth) ?? 0;
        if (h > cur) maxHeightByDepth.set(lay.depth, h);
      }

      // Slot extra entre depths pra caber 1 row de btn-short (quando houver)
      const BTN_INTERLAYER_SLOT = 50 + LAYOUT_VERTICAL_GAP;

      // 2. Y cumulativo por depth.
      const yByDepth = new Map<number, number>();
      let y = fbox.y + LAYOUT_TOP_PADDING;
      for (let d = 0; d <= diamondMaxDepth; d++) {
        yByDepth.set(d, y);
        y +=
          (maxHeightByDepth.get(d) ?? 0) +
          LAYOUT_VERTICAL_GAP +
          BTN_INTERLAYER_SLOT;
      }

      // 3. Posicionamento horizontal ancorado pela ESQUERDA do bloco
      // principal. A coluna minCol (que pode ser negativa) fica no x mais
      // à esquerda; cada coluna ocupa DIAMOND_COLUMN_SPACING. Cada main
      // é centralizado horizontalmente dentro da sua coluna.
      //
      // Antes usávamos centerX = fbox.x + newWidth/2 e col=0 era o centro,
      // mas isso fazia colunas negativas saírem pela ESQUERDA do frame
      // quando havia mensagem-de-corte TRUE (à esquerda das conds).
      const LEFT_PADDING_INSIDE = trackingMaxW + TRACKING_GAP_X + 24;
      const blockStartX = fbox.x + LEFT_PADDING_INSIDE;
      const minColFloor = Math.floor(diamondMinCol);
      const colCenterX = (col: number) =>
        blockStartX + (col - minColFloor + 0.5) * DIAMOND_COLUMN_SPACING;

      // 4. Posicionar mains.
      // Laterais cond/hum terminais SEM irmão (caso compat antigo) ficam
      // empilhados à ESQUERDA do frame, sem ocupar espaço do bloco principal.
      const LATERAL_X_OFFSET = 16;
      const lateralByDepth = new Map<number, number>();
      for (const m of list) {
        const lay = diamondLayout.get(m.id);
        const i = idxById.get(m.id);
        if (!lay || i === undefined) continue;
        const compBox = measuredBox(m);
        const yPos = yByDepth.get(lay.depth) ?? fbox.y + LAYOUT_TOP_PADDING;

        let x: number;
        if (lay.isLateral) {
          const slot = lateralByDepth.get(lay.depth) ?? 0;
          lateralByDepth.set(lay.depth, slot + 1);
          x = fbox.x + LATERAL_X_OFFSET + slot * (compBox.w + 12);
        } else {
          x = colCenterX(lay.column) - compBox.w / 2;
        }

        // Preserva tratamento da exceção horizontal do bubble-user
        const excChild =
          m.type === 'bubble-user'
            ? nodes.find((n) => n.type === 'excecao' && n.parentId === m.id)
            : undefined;
        next[i] = { ...next[i], position: { x, y: yPos } };
        if (excChild) {
          const ei = idxById.get(excChild.id);
          if (ei !== undefined) {
            next[ei] = {
              ...next[ei],
              position: { x: compBox.w + EXCECAO_GAP_X, y: 0 },
            };
          }
        }
      }

      // 5. btn-shorts: cada btn na coluna do filho-main correspondente,
      //    Y centralizado no slot entre o main pai e o main filho.
      const edgeBySource = new Map<string, string[]>();
      const edgeByTarget = new Map<string, string[]>();
      for (const e of edges) {
        if (!edgeBySource.has(e.source)) edgeBySource.set(e.source, []);
        edgeBySource.get(e.source)!.push(e.target);
        if (!edgeByTarget.has(e.target)) edgeByTarget.set(e.target, []);
        edgeByTarget.get(e.target)!.push(e.source);
      }
      const mainSet = new Set(list.map((m) => m.id));
      const nodeById = new Map(nodes.map((n) => [n.id, n]));

      const findMainEndpoint = (
        startId: string,
        direction: 'fwd' | 'back'
      ): string | undefined => {
        const adj = direction === 'fwd' ? edgeBySource : edgeByTarget;
        const seen = new Set<string>([startId]);
        const q: string[] = [...(adj.get(startId) ?? [])];
        while (q.length) {
          const cur = q.shift()!;
          if (seen.has(cur)) continue;
          seen.add(cur);
          if (mainSet.has(cur)) return cur;
          const n = nodeById.get(cur);
          if (n?.type && TRANSPARENT_TYPES.has(n.type as FluxoNodeType)) {
            for (const next of adj.get(cur) ?? []) q.push(next);
          }
        }
        return undefined;
      };

      for (const b of frameBtnShorts) {
        const childMainId = findMainEndpoint(b.id, 'fwd');
        if (!childMainId) continue;
        const childLay = diamondLayout.get(childMainId);
        if (!childLay) continue;
        const parentMainId = findMainEndpoint(b.id, 'back');
        const parentLay = parentMainId
          ? diamondLayout.get(parentMainId)
          : undefined;

        const BTN_W = 130;
        const BTN_H = 50;
        const childX = colCenterX(childLay.column);
        const btnX = childX - BTN_W / 2;
        const childY = yByDepth.get(childLay.depth) ?? 0;

        let btnY: number;
        if (parentLay) {
          const parentY = yByDepth.get(parentLay.depth) ?? 0;
          const parentH = maxHeightByDepth.get(parentLay.depth) ?? 0;
          const slotTop = parentY + parentH + LAYOUT_VERTICAL_GAP;
          const slotBot = childY - LAYOUT_VERTICAL_GAP;
          btnY = slotTop + Math.max(0, (slotBot - slotTop - BTN_H) / 2);
        } else {
          btnY = childY - BTN_H - LAYOUT_VERTICAL_GAP;
        }

        const bi = idxById.get(b.id);
        if (bi !== undefined) {
          next[bi] = { ...next[bi], position: { x: btnX, y: btnY } };
        }
      }

      // Atualiza currentY pra o grid de direcionamentos no fim do frame
      currentY =
        (yByDepth.get(diamondMaxDepth) ?? fbox.y + LAYOUT_TOP_PADDING) +
        (maxHeightByDepth.get(diamondMaxDepth) ?? 0) +
        LAYOUT_VERTICAL_GAP;
    } else {
      // ===========================================================
      // VERTICAL POSITIONING — mains empilhados, btn-shorts em row
      // ===========================================================
      for (let mainIdx = 0; mainIdx < list.length; mainIdx++) {
        const comp = list[mainIdx];
        const compBox = measuredBox(comp);
        const i = idxById.get(comp.id);
        if (i === undefined) continue;

        // Y ORIGINAL (antes de reposicionar) — usado pra associar btn-shorts
        const origY = comp.position.y;

        // CASO ESPECIAL: bubble-user com exceção filha = dupla horizontal.
        const excChild =
          comp.type === 'bubble-user'
            ? nodes.find((n) => n.type === 'excecao' && n.parentId === comp.id)
            : undefined;

        if (excChild) {
          const excBox = measuredBox(excChild);
          const pairW = compBox.w + EXCECAO_GAP_X + excBox.w;
          next[i] = {
            ...next[i],
            position: { x: rightEdge - pairW, y: currentY },
          };
          const ei = idxById.get(excChild.id);
          if (ei !== undefined) {
            next[ei] = {
              ...next[ei],
              position: { x: compBox.w + EXCECAO_GAP_X, y: 0 },
            };
          }
        } else {
          next[i] = {
            ...next[i],
            position: { x: rightEdge - compBox.w, y: currentY },
          };
        }

        currentY += compBox.h + LAYOUT_VERTICAL_GAP;

        // INLINE btn-shorts entre este main e o próximo (centralizados em row)
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
    }

    // ----- GRID HORIZONTAL: btn-short + direcionamentos dentro do frame ---
    // Encontra btn-short e direcionamentos não-children que estão dentro deste frame
    // pelo centro (ponto médio). Posiciona em grid horizontal abaixo dos mains.
    const gridItems = nodes
      .filter((n) => {
        if (n.parentId) return false;
        if (!n.type || !GRID_FLOW_TYPES.has(n.type as FluxoNodeType)) return false;
        // Prefere ownership por code (direcionamentos têm code, ex: "S005")
        const owner = findOwnerFrame(n, nodes);
        if (owner?.id === frame.id) return true;
        // Fallback: frame mais próximo por centroid pra órfãos sem code
        if (!owner && frames.length > 0) {
          const box = measuredBox(n);
          const cx = box.x + box.w / 2;
          const cy = box.y + box.h / 2;
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
      // Largura por item: usa max measurado entre os items do grid, com piso
      // de 145 (caso measured não venha ainda) e teto suave de 260. Garante
      // que direcionamentos com label longo (ex: "Cartão de crédito") não
      // sobreponham o vizinho de coluna.
      const measuredMaxW = Math.max(
        145,
        ...gridItems.map((g) => measuredBox(g).w)
      );
      const ITEM_W = Math.min(260, measuredMaxW);
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
