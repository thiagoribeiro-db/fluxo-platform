/**
 * Extrai todas as linhas editáveis de texto de um array de nodes.
 *
 * Cada linha representa UM campo de texto de UM bloco. Blocos com múltiplos
 * campos (ex: menu tem header + N opções, ou link tem linkTitle + description)
 * geram múltiplas linhas — cada uma editável independentemente.
 *
 * USO típico: alimenta a tabela de conteúdo (ContentTablePanel) com uma
 * visão tipo planilha onde o copywriter atualiza textos em massa sem
 * mexer no canvas.
 *
 * Funções PURAS — testáveis. Não dependem do React Flow runtime.
 */
import type { FluxoNode } from '@/lib/types';

/**
 * Caminhos JSON-pointer-like pro campo dentro de `node.data`.
 * Pode ser uma chave direta ("text") OU "options[idx]" pra item de array.
 */
export type ContentFieldPath = string;

export interface ContentRow {
  /** ID estável do node — usado pra atualizar via setNodes. */
  nodeId: string;
  /** ID do frame que contém o bloco (ou null se órfão). */
  frameId: string | null;
  /** Título humano do frame (ou "Sem frame"). */
  frameLabel: string;
  /** Prefixo do frame (ex: S, OF) se houver. */
  framePrefix: string | null;
  /** Code do bloco (ex: S001) se houver. */
  code: string | null;
  /** Tipo do node (ex: bubble-bot, menu, etc.). */
  nodeType: string;
  /** Label humano do campo (ex: "Mensagem", "Header", "Opção 1"). */
  fieldLabel: string;
  /** Path interno do campo em node.data — usado pra fazer patch. */
  fieldPath: ContentFieldPath;
  /** Valor atual. */
  value: string;
  /** Hint visual sobre o tipo de conteúdo (emoji). */
  emoji: string;
}

/**
 * Aplica um patch numa cópia de node.data, suportando paths simples
 * (ex: "text") OU array index (ex: "options[2]").
 */
export function applyFieldPatch(
  data: Record<string, unknown>,
  fieldPath: ContentFieldPath,
  newValue: string
): Record<string, unknown> {
  // Caso "options[N]" — atualiza item específico do array
  const arrMatch = fieldPath.match(/^([a-zA-Z_]+)\[(\d+)\]$/);
  if (arrMatch) {
    const [, key, idxStr] = arrMatch;
    const idx = parseInt(idxStr, 10);
    const arr = Array.isArray(data[key]) ? [...(data[key] as string[])] : [];
    arr[idx] = newValue;
    return { ...data, [key]: arr };
  }
  // Caso simples
  return { ...data, [fieldPath]: newValue };
}

/**
 * Verifica se um node está dentro dos bounds de um frame.
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

/**
 * Mapeia o tipo do node pra um emoji visual.
 */
function emojiFor(type: string): string {
  switch (type) {
    case 'bubble-bot':
      return '💬';
    case 'bubble-user':
      return '👤';
    case 'menu':
      return '📋';
    case 'btn-short':
    case 'btn-long':
      return '🔘';
    case 'direcionamento':
      return '🎯';
    case 'condicional':
      return '🔀';
    case 'link':
      return '🔗';
    case 'tracking':
      return '📊';
    case 'excecao':
      return '⚠️';
    case 'atendimento-humano':
      return '🧑‍💼';
    case 'entry-point':
      return '▶️';
    case 'integracao-api':
      return '🔌';
    case 'integracao-planilha':
      return '📊';
    case 'iag-entrada':
    case 'iag-saida':
    case 'iag-reentrada':
      return '🤖';
    default:
      if (type.startsWith('midia-imagem')) return '🖼️';
      if (type.startsWith('midia-documento')) return '📄';
      if (type.startsWith('midia-video')) return '🎥';
      return '◾';
  }
}

/**
 * Lista de campos editáveis por tipo de node.
 * Cada entrada: { path, label }.
 *
 * Pra menus, o campo "options" é tratado especialmente — gera N linhas
 * (uma por opção do array).
 */
const FIELD_MAP: Record<string, Array<{ path: string; label: string }>> = {
  'bubble-bot': [{ path: 'text', label: 'Mensagem' }],
  'bubble-user': [{ path: 'text', label: 'Mensagem' }],
  menu: [
    { path: 'header', label: 'Header' },
    { path: 'footer', label: 'Footer (botão)' },
    // options geradas dinamicamente
  ],
  'btn-short': [{ path: 'label', label: 'Label' }],
  'btn-long': [{ path: 'label', label: 'Label' }],
  direcionamento: [{ path: 'label', label: 'Label' }],
  condicional: [
    { path: 'condition', label: 'Condição' },
    { path: 'trueLabel', label: 'Label TRUE' },
    { path: 'falseLabel', label: 'Label FALSE' },
  ],
  'atendimento-humano': [{ path: 'label', label: 'Label' }],
  link: [
    { path: 'linkTitle', label: 'Título' },
    { path: 'linkDescription', label: 'Descrição' },
    { path: 'url', label: 'URL' },
  ],
  'midia-imagem-bot': [{ path: 'caption', label: 'Legenda' }],
  'midia-imagem-user': [{ path: 'caption', label: 'Legenda' }],
  'midia-documento-bot': [
    { path: 'filename', label: 'Nome do arquivo' },
    { path: 'meta', label: 'Metadata' },
  ],
  'midia-documento-user': [
    { path: 'filename', label: 'Nome do arquivo' },
    { path: 'meta', label: 'Metadata' },
  ],
  'midia-video-bot': [{ path: 'caption', label: 'Legenda' }],
  'midia-video-user': [{ path: 'caption', label: 'Legenda' }],
  'integracao-api': [{ path: 'title', label: 'Título' }],
  'integracao-planilha': [{ path: 'title', label: 'Título' }],
  'iag-entrada': [{ path: 'title', label: 'Título' }],
  'iag-saida': [{ path: 'title', label: 'Título' }],
  'iag-reentrada': [{ path: 'title', label: 'Título' }],
  tracking: [{ path: 'label', label: 'Label' }],
  excecao: [{ path: 'label', label: 'Label' }],
  'entry-point': [{ path: 'label', label: 'Label' }],
};

export interface ExtractRowsOptions {
  /** Filtra por busca textual (label, valor, code, frame). */
  query?: string;
  /** Filtra por tipos específicos. Se vazio, todos. */
  types?: string[];
  /** Filtra por frameId específico (ou 'none' pra órfãos). */
  frameId?: string | null;
  /** Se true, INCLUI trackings/exceções (default: false — são "filhos visuais"). */
  includeChildren?: boolean;
}

/**
 * Extrai linhas editáveis de todos os nodes.
 *
 * Resolve o frame de cada bloco por inclusão geométrica (bbox), igual ao
 * outline. Aplica filtros opcionais (query, types, frameId).
 */
export function extractContentRows(
  nodes: FluxoNode[],
  opts: ExtractRowsOptions = {}
): ContentRow[] {
  const frames = nodes.filter((n) => n.type === 'frame');
  const rows: ContentRow[] = [];

  // Inicia indexador frame → label, prefix
  const frameInfo = new Map<string, { label: string; prefix: string | null; frame: FluxoNode }>();
  for (const f of frames) {
    const id = (f.data?.frameId as string) || f.id;
    const label = (f.data?.title as string) || (f.data?.frameId as string) || 'Frame';
    const prefix = (f.data?.prefix as string) ?? null;
    frameInfo.set(id, { label, prefix, frame: f });
  }

  const includeChildren = opts.includeChildren ?? false;

  for (const node of nodes) {
    if (node.type === 'frame') continue;
    if (!node.type) continue;
    if (!includeChildren && (node.type === 'tracking' || node.type === 'excecao')) {
      continue;
    }

    // Resolve frame container
    let containingFrameId: string | null = null;
    let containingFrameLabel = 'Sem frame';
    let containingFramePrefix: string | null = null;
    for (const f of frames) {
      if (isInsideFrame(node, f)) {
        containingFrameId = (f.data?.frameId as string) || f.id;
        const info = frameInfo.get(containingFrameId);
        if (info) {
          containingFrameLabel = info.label;
          containingFramePrefix = info.prefix;
        }
        break;
      }
    }

    const code = (node.data?.code as string | undefined) ?? null;
    const fields = FIELD_MAP[node.type] ?? [];
    const emoji = emojiFor(node.type);

    for (const field of fields) {
      const value = (node.data?.[field.path] as string | undefined) ?? '';
      rows.push({
        nodeId: node.id,
        frameId: containingFrameId,
        frameLabel: containingFrameLabel,
        framePrefix: containingFramePrefix,
        code,
        nodeType: node.type,
        fieldLabel: field.label,
        fieldPath: field.path,
        value,
        emoji,
      });
    }

    // Menu: gera 1 linha por opção
    if (node.type === 'menu' && Array.isArray(node.data?.options)) {
      const options = node.data.options as string[];
      options.forEach((opt, i) => {
        rows.push({
          nodeId: node.id,
          frameId: containingFrameId,
          frameLabel: containingFrameLabel,
          framePrefix: containingFramePrefix,
          code,
          nodeType: node.type,
          fieldLabel: `Opção ${i + 1}`,
          fieldPath: `options[${i}]`,
          value: opt,
          emoji,
        });
      });
    }
  }

  // Aplica filtros
  let filtered = rows;
  if (opts.types && opts.types.length > 0) {
    const set = new Set(opts.types);
    filtered = filtered.filter((r) => set.has(r.nodeType));
  }
  if (opts.frameId !== undefined) {
    filtered = filtered.filter((r) => {
      if (opts.frameId === 'none') return r.frameId === null;
      return r.frameId === opts.frameId;
    });
  }
  const q = (opts.query ?? '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((r) => {
      const hay = `${r.value} ${r.code ?? ''} ${r.frameLabel} ${r.fieldLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }

  return filtered;
}

/**
 * Tipos canônicos exibíveis na tabela (na ordem do filtro).
 */
export const TABLE_NODE_TYPES: Array<{ type: string; label: string; emoji: string }> = [
  { type: 'bubble-bot', label: 'Bot', emoji: '💬' },
  { type: 'bubble-user', label: 'User', emoji: '👤' },
  { type: 'menu', label: 'Menu', emoji: '📋' },
  { type: 'direcionamento', label: 'Direcionamento', emoji: '🎯' },
  { type: 'condicional', label: 'Condicional', emoji: '🔀' },
  { type: 'btn-short', label: 'Botão curto', emoji: '🔘' },
  { type: 'btn-long', label: 'Botão longo', emoji: '🔘' },
  { type: 'link', label: 'Link', emoji: '🔗' },
  { type: 'atendimento-humano', label: 'Atendente', emoji: '🧑‍💼' },
];
