/**
 * Parser de escopo conversacional (Markdown/TXT) → ProjectState.
 *
 * Heurísticas:
 *  - Seções: linhas iniciando com `#`, `##`, `###`, OU "Cenário N:", OU
 *    "Abertura padrão", "Encerramento padrão", "Frame: <nome>"
 *  - `Bot:` / `Gui:` / `Atendente:` / `BOT:` / `Bot diz:` → bubble-bot
 *  - `Cliente:` / `User:` / `Usuário:` / `USER:` → bubble-user
 *  - Listas (`- ` / `* ` / `1. `) com:
 *      1 item → btn-long
 *      2-3 itens → btn-short row
 *      4+ itens → menu
 *  - Texto entre `[...]` ou referência a "PDF", "imagem", "vídeo", "documento"
 *    → mídia bot
 *  - "atendimento humanizado", "transbordo", "atendente" → direcionamento
 *  - Linhas em branco separam blocos
 *
 * Como NÃO é IA, é heurístico — gera uma estrutura aproximada. O usuário
 * deve revisar/ajustar no editor.
 */
import type { Edge } from '@xyflow/react';
import type { FluxoNode, ProjectState, FluxoNodeType } from '@/lib/types';
import { slugify } from '@/lib/components/nodes/helpers';

// --------------------------------------------------------------------------
// Tokenizer — quebra o texto em "blocos" (seções, mensagens, listas, etc.)
// --------------------------------------------------------------------------
interface ParsedSection {
  title: string;
  blocks: ParsedBlock[];
}

type ParsedBlock =
  | { kind: 'bot'; text: string }
  | { kind: 'user'; text: string }
  | { kind: 'options'; items: string[] }
  | { kind: 'media'; mediaKind: 'imagem' | 'documento' | 'video'; caption: string }
  | { kind: 'direcionamento'; label: string; target?: string }
  | { kind: 'note'; text: string };

const SECTION_REGEX =
  /^(?:#{1,3}\s+|cenário\s+\d+:?\s*|abertura\s+padrão|encerramento\s+padrão|frame:?\s+)/i;

const BOT_PREFIX_REGEX =
  /^(?:bot|gui|atendente virtual|assistente|chatbot)\s*(?:diz)?\s*:\s*/i;
const USER_PREFIX_REGEX =
  /^(?:cliente|user|usuário|usuario|customer|você|voce)\s*(?:diz|escolhe|seleciona|envia)?\s*:\s*/i;

const LIST_ITEM_REGEX = /^(?:[-*•]\s+|\d+[.)]\s+)/;
const MEDIA_REGEX = /\b(pdf|imagem|imagens|foto|vídeo|video|documento|encarte|card|cards)\b/i;
const TRANSBORDO_REGEX =
  /\b(atendimento\s+humano|atendimento\s+humanizado|transbordo|atendente|falar\s+com\s+atendente)\b/i;

function detectMediaKind(line: string): 'imagem' | 'documento' | 'video' | null {
  if (/\bvídeo|video\b/i.test(line)) return 'video';
  if (/\b(pdf|documento|encarte)\b/i.test(line)) return 'documento';
  if (/\b(imagem|imagens|foto|fotos|card|cards|fotografia|figura|gif|png|jpg)\b/i.test(line))
    return 'imagem';
  return null;
}

function isOptionInlineSeparator(line: string): string[] | null {
  // Detecta "caixa de opções: A | B | C" ou "opções: A, B, C"
  const m = line.match(/\b(opç(?:ões|oes)|opt[io]ons|caixa\s+de\s+opç(?:ões|oes))\s*:?\s*([^\n]+)/i);
  if (!m) return null;
  const text = m[2];
  const parts = text
    .split(/\s*[|;]\s*|\s*\/\s*|\s+ou\s+|\s*,\s*/i)
    .map((s) => s.trim())
    .filter((s) => s && !/^abre|^abre\s+caixa$/i.test(s));
  if (parts.length >= 2) return parts;
  return null;
}

/**
 * Quebra texto inline (típico de PDF/DOCX que mantém tudo numa linha só)
 * inserindo `\n` ANTES de markers conhecidos. Sem isso, regex `^marker`
 * nunca casa.
 *
 * Markers detectados:
 *  - "Cenário N:", "Frame:", "Abertura padrão", "Encerramento padrão",
 *    "Menu principal padronizado", "Observações do cenário:", "Diretrizes ..."
 *  - "Gui:", "Bot:", "Atendente:", "Assistente:" → bubble bot
 *  - "Cliente:", "User:", "Usuário:" → bubble user
 *  - "• item", "- item", "* item" → lista
 *  - "[colchete]" — quebra antes
 *  - "Pontos para validação..." (seção de observações final)
 */
function splitInlineMarkers(text: string): string {
  return (
    text
      // Quebra antes de cabeçalhos de seção
      .replace(/(?<=\S)\s+(Cenário\s+\d+:)/g, '\n\n$1')
      .replace(/(?<=\S)\s+(Abertura\s+padrão\b)/g, '\n\n$1')
      .replace(/(?<=\S)\s+(Encerramento\s+padrão\b)/g, '\n\n$1')
      .replace(/(?<=\S)\s+(Menu\s+principal\s+padronizado\b)/gi, '\n\n$1')
      .replace(/(?<=\S)\s+(Diretrizes?\s+gerais?\b[^:]*:?)/gi, '\n\n$1')
      .replace(/(?<=\S)\s+(Observa(?:ç|c)(?:ões|oes)\s+do\s+cenário:?)/gi, '\n\n$1')
      .replace(/(?<=\S)\s+(Pontos\s+para\s+valida(?:ç|c)ão\b[^:]*:?)/gi, '\n\n$1')
      .replace(/(?<=\S)\s+(Objetivo\s+do\s+escopo:?)/gi, '\n\n$1')
      // Quebra antes de "Gui:", "Bot:", "Cliente:", "Usuário:", etc.
      .replace(
        /(?<=\S)\s+(Gui|Bot|Atendente|Assistente|Chatbot|Cliente|User|Usuário|Usuario|Customer)\s*:/gi,
        '\n$1:'
      )
      // Quebra antes de bullets/listas: • - * (com espaço depois)
      .replace(/(?<=\S)\s+([••]\s+)/g, '\n$1')
      .replace(/(?<=\S)\s+([-*]\s+)(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇa-záàâãéêíóôõúç])/g, '\n$1')
      // Quebra antes de [colchete] (geralmente mídia/anotação)
      .replace(/(?<=\S)\s+(\[)/g, '\n$1')
      // Limpa quebras duplicadas
      .replace(/\n{3,}/g, '\n\n')
  );
}

/**
 * Normaliza texto extraído de PDF: junta linhas que foram quebradas
 * apenas por largura visual (não eram breaks lógicos).
 *
 * Regra: se uma linha não começa com um "marcador" (Bot:, Cliente:, -, *,
 * número., #, Cenário, etc.) E a linha anterior NÃO termina com `.`, `!`,
 * `?`, `:`, `]`, `)` — junta com espaço.
 */
function normalizePdfText(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];

  const isMarker = (line: string) =>
    /^(?:#{1,3}\s|cenário\s+\d+|abertura\s+padrão|encerramento\s+padrão|frame:|bot|gui|cliente|user|usuário|atendente|assistente|[-*•]\s|\d+[.)]\s)/i.test(
      line.trim()
    );
  const endsHard = (line: string) =>
    /[.!?:\]\)]\s*$/.test(line.trim()) || line.trim() === '';

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trimEnd();
    if (out.length === 0) {
      out.push(line);
      continue;
    }
    const prev = out[out.length - 1];
    // Linha vazia: preservar
    if (line.trim() === '') {
      out.push(line);
      continue;
    }
    // Se a linha atual é um marker, ou a anterior termina em pontuação forte
    // → mantém separada
    if (isMarker(line) || endsHard(prev)) {
      out.push(line);
      continue;
    }
    // Senão, JUNTA com a anterior (linha quebrada por largura visual)
    out[out.length - 1] = prev + ' ' + line.trimStart();
  }

  return out.join('\n');
}

function tokenize(text: string): ParsedSection[] {
  // 1) Quebra texto inline em linhas (PDF costuma vir tudo numa linha só)
  const splitted = splitInlineMarkers(text);
  // 2) Junta linhas continuadas (curtas, sem markers)
  const normalized = normalizePdfText(splitted);
  // 3) Normaliza line-endings
  const lines = normalized.replace(/\r\n?/g, '\n').split('\n');
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  let pendingList: string[] = [];

  const pushList = () => {
    if (pendingList.length > 0 && current) {
      current.blocks.push({ kind: 'options', items: pendingList.slice() });
      pendingList = [];
    }
  };

  const ensureSection = (title: string) => {
    pushList();
    current = { title: title.trim() || 'Sem título', blocks: [] };
    sections.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pushList();
      continue;
    }

    // Seção?
    if (SECTION_REGEX.test(line)) {
      const cleaned = line
        .replace(/^#{1,3}\s+/, '')
        .replace(/^cenário\s+\d+:?\s*/i, '')
        .replace(/^frame:?\s+/i, '')
        .trim();
      ensureSection(cleaned);
      continue;
    }

    // Garante seção default se nenhuma ainda
    if (!current) ensureSection('Início');

    // Lista item?
    const listMatch = line.match(LIST_ITEM_REGEX);
    if (listMatch) {
      pendingList.push(line.replace(LIST_ITEM_REGEX, '').trim());
      continue;
    }
    pushList();

    // Bot?
    if (BOT_PREFIX_REGEX.test(line)) {
      const text = line.replace(BOT_PREFIX_REGEX, '').trim();
      // Se o bot tem opções inline ("opções: A | B"), tratar
      const inlineOpts = isOptionInlineSeparator(text);
      if (inlineOpts) {
        // Texto antes das opções
        const beforeOpts = text.replace(/\s*(?:\(|\[)?\s*\b(opç(?:ões|oes)|caixa\s+de\s+opç(?:ões|oes))\b.*$/i, '').trim();
        if (beforeOpts) current!.blocks.push({ kind: 'bot', text: beforeOpts });
        current!.blocks.push({ kind: 'options', items: inlineOpts });
      } else {
        // Detecta mídia inline
        const mkind = detectMediaKind(text);
        if (mkind && /^\[.*\]$/.test(text)) {
          current!.blocks.push({
            kind: 'media',
            mediaKind: mkind,
            caption: text.replace(/^\[|\]$/g, '').trim(),
          });
        } else if (TRANSBORDO_REGEX.test(text)) {
          current!.blocks.push({ kind: 'bot', text });
          current!.blocks.push({
            kind: 'direcionamento',
            label: 'Falar com atendente',
            target: 'atendente',
          });
        } else {
          current!.blocks.push({ kind: 'bot', text });
        }
      }
      continue;
    }

    // User?
    if (USER_PREFIX_REGEX.test(line)) {
      const text = line.replace(USER_PREFIX_REGEX, '').trim();
      current!.blocks.push({ kind: 'user', text });
      continue;
    }

    // Linha tipo "[descrição da mídia]" stand-alone
    if (/^\[.*\]$/.test(line)) {
      const inner = line.replace(/^\[|\]$/g, '').trim();
      const mkind = detectMediaKind(inner);
      if (mkind) {
        current!.blocks.push({ kind: 'media', mediaKind: mkind, caption: inner });
        continue;
      }
      if (TRANSBORDO_REGEX.test(inner)) {
        current!.blocks.push({
          kind: 'direcionamento',
          label: 'Falar com atendente',
          target: 'atendente',
        });
        continue;
      }
      current!.blocks.push({ kind: 'note', text: inner });
      continue;
    }

    // Default — nota/observação
    current!.blocks.push({ kind: 'note', text: line });
  }

  pushList();
  return sections;
}

// --------------------------------------------------------------------------
// Builder de FluxoNode/Edge a partir das seções tokenizadas
// --------------------------------------------------------------------------
let _counter = 0;
function uid(prefix: string): string {
  _counter += 1;
  return `${prefix}-${_counter.toString(36)}`;
}

function makePrefix(title: string): string {
  // Pega primeira letra de cada palavra capitalizada; limita 3 chars
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'X';
  const initials = words
    .map((w) => w[0]?.toUpperCase())
    .filter(Boolean)
    .join('');
  return initials.slice(0, 3) || 'X';
}

function makeFrameId(title: string): string {
  return slugify(title, 40) || `frame-${_counter}`;
}

export function parseEscopoText(text: string): ProjectState {
  _counter = 0;
  const sections = tokenize(text);

  const allNodes: FluxoNode[] = [];
  const allEdges: Edge[] = [];

  const FW = 900;
  const FH = 1400;
  const COL_GAP = 100;
  const ROW_GAP = 200;
  const COLS = 4;

  sections.forEach((section, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const framePos = {
      x: col * (FW + COL_GAP),
      y: row * (FH + ROW_GAP),
    };

    const prefix = makePrefix(section.title);
    const frameId = makeFrameId(section.title);

    const frameNode: FluxoNode = {
      id: uid('frame'),
      type: 'frame',
      position: framePos,
      data: {
        title: section.title,
        prefix,
        frameId,
        code: prefix,
        width: FW,
        height: FH,
      },
    };
    allNodes.push(frameNode);

    let seq = 1;
    let lastFlowId: string | null = null;
    const bx = framePos.x + 400;
    let y = framePos.y + 80;

    const nextCode = () => `${prefix}${String(seq++).padStart(3, '0')}`;

    for (const block of section.blocks) {
      if (block.kind === 'bot') {
        const id = uid('bot');
        allNodes.push({
          id,
          type: 'bubble-bot',
          position: { x: bx, y },
          data: { code: nextCode(), text: block.text, time: '9.41 AM' },
        });
        allNodes.push({
          id: uid('trk'),
          type: 'tracking',
          parentId: id,
          position: { x: -256, y: 0 },
          data: { label: `${slugify(block.text)}_exibicao` },
        });
        if (lastFlowId) {
          allEdges.push({
            id: uid('e'),
            source: lastFlowId,
            target: id,
            animated: true,
          });
        }
        lastFlowId = id;
        y += 160;
      } else if (block.kind === 'user') {
        const id = uid('user');
        allNodes.push({
          id,
          type: 'bubble-user',
          position: { x: bx + 60, y },
          data: { code: nextCode(), text: block.text, time: '9.41 AM' },
        });
        // tracking_input no anterior se for bot/menu
        const prev = lastFlowId ? allNodes.find((n) => n.id === lastFlowId) : null;
        if (prev && (prev.type === 'bubble-bot' || prev.type === 'menu')) {
          const prevText =
            (prev.data?.text as string | undefined) ??
            (prev.data?.header as string | undefined) ??
            '';
          const existing = allNodes.filter(
            (n) => n.type === 'tracking' && n.parentId === prev.id
          );
          allNodes.push({
            id: uid('trk'),
            type: 'tracking',
            parentId: prev.id,
            position: { x: -256, y: existing.length * 52 },
            data: { label: `${slugify(prevText)}_input` },
          });
        }
        allNodes.push({
          id: uid('exc'),
          type: 'excecao',
          parentId: id,
          position: { x: 0, y: 140 },
          data: { label: 'Exceção / Fallback' },
        });
        if (lastFlowId) {
          allEdges.push({
            id: uid('e'),
            source: lastFlowId,
            target: id,
            animated: true,
          });
        }
        lastFlowId = id;
        y += 160;
      } else if (block.kind === 'options') {
        const opts = block.items;
        if (opts.length === 1) {
          // 1 opção → btn-long
          const id = uid('btn');
          allNodes.push({
            id,
            type: 'btn-long',
            position: { x: bx, y },
            data: { code: nextCode(), label: opts[0] },
          });
          if (lastFlowId) {
            allEdges.push({
              id: uid('e'),
              source: lastFlowId,
              target: id,
              animated: true,
            });
          }
          lastFlowId = id;
          y += 70;
        } else if (opts.length <= 3) {
          // 2-3 opções → btn-short row (paralelos)
          const BTN_W = 130;
          const GAP_X = 12;
          const totalW = opts.length * BTN_W + (opts.length - 1) * GAP_X;
          const startX = framePos.x + (FW - totalW) / 2;
          const sourceId = lastFlowId;
          // Os botões NÃO atualizam lastFlowId (parallel)
          opts.forEach((opt, i) => {
            const id = uid('btn');
            allNodes.push({
              id,
              type: 'btn-short',
              position: { x: startX + i * (BTN_W + GAP_X), y },
              data: { code: nextCode(), label: opt },
            });
            if (sourceId) {
              allEdges.push({
                id: uid('e'),
                source: sourceId,
                target: id,
                animated: true,
              });
            }
          });
          // Após os botões, marca lastFlowId como null pra próximo bot reconvergir
          // (mas como não temos lógica fancy aqui, deixo como sourceId pra continuar sequência)
          y += 80;
        } else {
          // 4+ → menu
          const id = uid('menu');
          allNodes.push({
            id,
            type: 'menu',
            position: { x: bx, y },
            data: {
              code: nextCode(),
              header: 'Selecione uma opção',
              options: opts,
              footer: 'Enviar',
            },
          });
          ['exibicao', 'selecao', 'inesperado'].forEach((kind, k) => {
            allNodes.push({
              id: uid('trk'),
              type: 'tracking',
              parentId: id,
              position: { x: -256, y: k * 52 },
              data: { label: `selecione_uma_opcao_${kind}` },
            });
          });
          if (lastFlowId) {
            allEdges.push({
              id: uid('e'),
              source: lastFlowId,
              target: id,
              animated: true,
            });
          }
          lastFlowId = id;
          y += 80 + opts.length * 50;
        }
      } else if (block.kind === 'media') {
        const id = uid('midia');
        const mtype = `midia-${block.mediaKind}-bot` as FluxoNodeType;
        allNodes.push({
          id,
          type: mtype,
          position: { x: bx, y },
          data: {
            code: nextCode(),
            sender: 'bot',
            mediaKind: block.mediaKind,
            caption: block.caption,
            time: '9.41 AM',
          },
        });
        if (lastFlowId) {
          allEdges.push({
            id: uid('e'),
            source: lastFlowId,
            target: id,
            animated: true,
          });
        }
        lastFlowId = id;
        y += 240;
      } else if (block.kind === 'direcionamento') {
        const id = uid('dir');
        const dirW = 230;
        allNodes.push({
          id,
          type: 'direcionamento',
          position: { x: framePos.x + (FW - dirW) / 2, y },
          data: {
            label: block.label,
            targetFrameId: block.target ?? '',
            clickable: !!block.target,
          },
        });
        if (lastFlowId) {
          allEdges.push({
            id: uid('e'),
            source: lastFlowId,
            target: id,
            animated: true,
          });
        }
        y += 70;
      }
      // notes não viram nodes (são metadados — ficam pra comentário futuro)
    }
  });

  return {
    nodes: allNodes,
    edges: allEdges,
    viewport: { x: 0, y: 0, zoom: 0.3 },
  };
}
