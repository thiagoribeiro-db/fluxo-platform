/**
 * Detecção de tipo de bloco a partir de UMA linha (já tokenizada).
 *
 * Cada bloco vira um node no canvas. O detector trabalha por prioridade:
 *  1. Lista (já agrupada pelo tokenizer)
 *  2. Bot/User (prefixo claro)
 *  3. Condicional
 *  4. Integração API
 *  5. IA generativa
 *  6. Link (URL explícita)
 *  7. Direcionamento (navegação)
 *  8. Mídia (frase com verbo + tipo)
 *  9. Transbordo (atendente)
 *  10. Note (fallback)
 */

import * as P from './patterns';

/**
 * Bloco detectado — descrição estrutural sem render ainda.
 *
 * `confidence`: 0-1, quão certeza temos do match. Útil pra debug.
 */
export type ParsedBlock =
  | { kind: 'bot'; text: string; confidence: number }
  | { kind: 'user'; text: string; confidence: number }
  | { kind: 'options'; items: string[]; confidence: number }
  | {
      kind: 'media';
      mediaKind: 'imagem' | 'documento' | 'video' | 'audio';
      caption: string;
      sender: 'bot' | 'user';
      confidence: number;
    }
  | {
      kind: 'direcionamento';
      label: string;
      /** Nome livre do alvo (resolvido depois via fuzzy match). */
      targetHint?: string;
      confidence: number;
    }
  | {
      kind: 'condicional';
      condition: string;
      /** Texto livre do branch true se inferível inline (raro). */
      thenText?: string;
      elseText?: string;
      confidence: number;
    }
  | { kind: 'link'; url: string; title?: string; confidence: number }
  | {
      kind: 'iag';
      prompt: string;
      /** 'entrada' = input do user→IA; 'saida' = IA→bot. Heurística. */
      direction: 'entrada' | 'saida';
      confidence: number;
    }
  | {
      kind: 'integracao-api';
      title: string;
      method?: string;
      url?: string;
      confidence: number;
    }
  | { kind: 'atendimento-humano'; label: string; confidence: number }
  | { kind: 'note'; text: string; confidence: number };

/**
 * Detecta o tipo MAIS específico que casa com a linha.
 * Retorna `null` se a linha não é "interessante" (só ruído).
 *
 * Linhas vazias devem ser filtradas ANTES.
 */
export function detectBlock(line: string): ParsedBlock | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 1. Bot: / Gui: / Atendente: ...
  if (P.BOT_PREFIX.test(trimmed)) {
    const text = trimmed.replace(P.BOT_PREFIX, '').trim();
    return enrichBotBlock(text);
  }

  // 2. Cliente: / User: / ...
  if (P.USER_PREFIX.test(trimmed)) {
    const text = trimmed.replace(P.USER_PREFIX, '').trim();
    return { kind: 'user', text, confidence: 0.95 };
  }

  // 3. Condicional
  if (P.CONDITIONAL_PREFIX.test(trimmed)) {
    const condition = trimmed.replace(P.CONDITIONAL_PREFIX, '').trim();
    // Tenta extrair "então X" / "senão Y"
    const thenMatch = condition.match(P.CONDITIONAL_THEN);
    const elseMatch = condition.match(P.CONDITIONAL_ELSE);
    let cleanCondition = condition;
    let thenText: string | undefined;
    let elseText: string | undefined;
    if (thenMatch) {
      const idx = condition.indexOf(thenMatch[0]);
      cleanCondition = condition.slice(0, idx).trim();
      thenText = condition
        .slice(idx + thenMatch[0].length)
        .split(P.CONDITIONAL_ELSE)[0]
        ?.trim();
    }
    if (elseMatch) {
      elseText = condition.split(P.CONDITIONAL_ELSE)[1]?.trim();
    }
    return {
      kind: 'condicional',
      condition: cleanCondition.replace(/[.?!]+$/, ''),
      thenText,
      elseText,
      confidence: 0.9,
    };
  }

  // 4. HTTP method explícito ou frase de integração API
  const httpMatch = trimmed.match(P.HTTP_METHOD);
  if (httpMatch) {
    return {
      kind: 'integracao-api',
      title: `${httpMatch[1].toUpperCase()} ${httpMatch[2]}`,
      method: httpMatch[1].toUpperCase(),
      url: httpMatch[2],
      confidence: 0.95,
    };
  }
  if (P.API_CALL.test(trimmed)) {
    return {
      kind: 'integracao-api',
      title: trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed,
      confidence: 0.8,
    };
  }

  // 5. IA generativa
  if (P.IA_GENERATIVA.test(trimmed)) {
    // Heurística melhorada:
    //  - Verbos de SAÍDA têm prioridade ("responder", "gera resposta", "gera",
    //    "produzir mensagem", "resume com IA"). IA escreve algo pro user.
    //  - Senão, se tem "analisa entrada", "classifica" etc. → ENTRADA.
    //  - Default: SAÍDA (caso mais comum: bot usa IA pra responder).
    const isSaida = /\b(?:respond[ae]r?|gera(?:r)?\s+(?:resposta|conteúdo|conteudo|texto|mensagem)|escrev[ae]r?|produz[ae]r?\s+(?:resposta|mensagem)|resume?\s+com|resumir?\s+com|sintetiz[ae]r?)/i.test(
      trimmed
    );
    const isEntrada =
      !isSaida &&
      /\b(?:analisa\s+entrada|classifica\s+(?:a\s+)?(?:intenção|intencao|pergunta\s+do)|entrada\s+do\s+user|input\s+do\s+(?:user|usuário|usuario)|interpreta\s+(?:a\s+)?(?:resposta|pergunta))/i.test(
        trimmed
      );
    return {
      kind: 'iag',
      prompt: trimmed,
      direction: isEntrada ? 'entrada' : 'saida',
      confidence: 0.85,
    };
  }

  // 6. URL explícita
  const urlMatch = trimmed.match(P.URL_FULL);
  if (urlMatch && urlMatch.length > 0) {
    const url = urlMatch[0];
    // Texto antes da URL vira o título (se houver)
    const idx = trimmed.indexOf(url);
    const title = trimmed.slice(0, idx).replace(/[\s:\-—]+$/, '').trim();
    return {
      kind: 'link',
      url,
      title: title || undefined,
      confidence: 0.95,
    };
  }

  // 7. Transbordo — tem prioridade sobre direcionamento (mais específico)
  if (P.TRANSBORDO.test(trimmed)) {
    return {
      kind: 'atendimento-humano',
      label: 'Atendimento humano',
      confidence: 0.9,
    };
  }

  // 8. Direcionamento de navegação (qualquer outro destino)
  if (P.NAVIGATE_VERB.test(trimmed) && !P.BOT_PREFIX.test(trimmed)) {
    const m = trimmed.match(P.NAVIGATE_VERB);
    const targetHint = m?.[1]?.trim();
    return {
      kind: 'direcionamento',
      label: trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed,
      targetHint,
      confidence: 0.75,
    };
  }

  // 9. Mídia stand-alone — [imagem do produto], [pdf catálogo]
  const bracketMatch = trimmed.match(/^\[(.+)\]$/);
  if (bracketMatch) {
    const inner = bracketMatch[1].trim();
    const mediaKind = detectMediaKind(inner);
    if (mediaKind) {
      return {
        kind: 'media',
        mediaKind,
        caption: inner,
        sender: 'bot',
        confidence: 0.85,
      };
    }
    return { kind: 'note', text: inner, confidence: 0.5 };
  }

  // 10. Frase de mídia com verbo ("Bot envia uma imagem do X")
  if (P.MEDIA_VERB.test(trimmed)) {
    const mediaKind = detectMediaKind(trimmed);
    if (mediaKind) {
      // Caption = parte depois do verbo de mídia (limpa)
      const cleanCaption = trimmed
        .replace(/^[A-Za-zÀ-ÿ\s]+(?:envia|anexa|compartilha|encaminha|manda|disponibiliza|exibe|mostra|apresenta)\b/i, '')
        .replace(/^\s*(?:o|a|um|uma|os|as)\s+/i, '')
        .trim();
      return {
        kind: 'media',
        mediaKind,
        caption: cleanCaption || trimmed,
        sender: 'bot',
        confidence: 0.7,
      };
    }
  }

  // Fallback: nota
  return { kind: 'note', text: trimmed, confidence: 0.3 };
}

/**
 * Enriquece bloco do bot — detecta opções inline, mídia inline,
 * URL embedada. Retorna sempre um único bloco principal; o builder
 * resolve splits internamente quando útil.
 */
function enrichBotBlock(text: string): ParsedBlock {
  // Opções inline ("Opções: A | B | C")?
  const inlineMatch = text.match(P.OPTIONS_INLINE);
  if (inlineMatch) {
    const parts = inlineMatch[1]
      .split(/\s*[|;]\s*|\s*\/\s*|\s+ou\s+|\s*,\s*/i)
      .map((s) => s.trim())
      .filter((s) => s && !/^abre|^abre\s+caixa$/i.test(s));
    if (parts.length >= 2) {
      // Retorna o texto antes das opções como bot — o tokenizer vai gerar
      // o options separado depois.
      const beforeOpts = text
        .replace(/\s*(?:\(|\[)?\s*\b(?:opç(?:ões|oes)|caixa\s+de\s+opç(?:ões|oes)|opt[io]ons|escolhe?\s+entre)\b.*$/i, '')
        .trim();
      return {
        kind: 'bot',
        text: beforeOpts || text,
        confidence: 0.9,
      };
    }
  }

  // URL inline?
  const urlMatch = text.match(P.URL_FULL);
  if (urlMatch && urlMatch.length > 0) {
    // Mantém como bot — o user vê o link no texto. Builder pode optar por
    // criar nó `link` separado se preferir. Por enquanto deixamos inline.
  }

  return { kind: 'bot', text, confidence: 0.95 };
}

export function detectMediaKind(
  line: string
): 'imagem' | 'documento' | 'video' | 'audio' | null {
  if (P.MEDIA_KIND_VIDEO.test(line)) return 'video';
  if (P.MEDIA_KIND_AUDIO.test(line)) return 'audio';
  if (P.MEDIA_KIND_DOCUMENTO.test(line)) return 'documento';
  if (P.MEDIA_KIND_IMAGEM.test(line)) return 'imagem';
  return null;
}
