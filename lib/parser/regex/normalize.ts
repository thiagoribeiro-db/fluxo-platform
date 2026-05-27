/**
 * Normalização de texto bruto de escopo.
 *
 * Texto de PDF/DOCX costuma vir:
 *  1. Sem quebras antes de markers (`Cenário 1: Saudação Bot: Olá`)
 *  2. Com quebras "falsas" — linha cortada por largura visual sem
 *     ser uma quebra lógica (resolução: juntar)
 *  3. Com espaços/tabs anormais
 *
 * Aplica 2 passos em ordem:
 *  1. `splitInlineMarkers` — INSERE \n antes de markers conhecidos
 *  2. `joinWrappedLines` — JUNTA linhas continuadas (sem markers)
 */

/**
 * Insere `\n\n` antes de cabeçalhos de seção e `\n` antes de markers de
 * fala/lista quando estão "colados" no texto. Preserva newlines já existentes.
 */
export function splitInlineMarkers(text: string): string {
  return (
    text
      // Separador horizontal (________________) → marcador de quebra de seção.
      // Deve vir PRIMEIRO para que o marcador não seja confundido com outros padrões.
      // A linha seguinte ao marcador vira título da nova seção (tratado no tokenizer).
      .replace(/_{4,}/g, '\n\n===SECTION_BREAK===\n\n')
      // Cabeçalhos de seção — quebra DUPLA antes (apenas quando há : ou quebra clara)
      .replace(/(?<=\S)\s+(Cenário\s+\d+\s*:)/g, '\n\n$1')
      // Frame: precisa de `:` ou ser início de linha já (não casa "# Frame" no meio)
      .replace(/(?<=[.!?\)\]])\s+(Frame\s*:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/g, '\n\n$1')
      .replace(/(?<=\S)\s+(Abertura\s+padrão\b)/g, '\n\n$1')
      .replace(/(?<=\S)\s+(Encerramento\s+padrão\b)/g, '\n\n$1')
      .replace(/(?<=\S)\s+(Menu\s+principal\s+padronizado\b)/gi, '\n\n$1')
      .replace(/(?<=\S)\s+(Diretrizes?\s+gerais?\b[^:]*:?)/gi, '\n\n$1')
      .replace(/(?<=\S)\s+(Observa(?:ç|c)(?:ões|oes)\s+(?:do\s+cenário|gerais?):?)/gi, '\n\n$1')
      .replace(/(?<=\S)\s+(Pontos\s+para\s+valida(?:ç|c)ão\b[^:]*:?)/gi, '\n\n$1')
      .replace(/(?<=\S)\s+(Objetivo\s+do\s+escopo:?)/gi, '\n\n$1')
      // Prefixos de fala — quebra SIMPLES antes
      .replace(
        /(?<=\S)\s+(Gui|Bot|Atendente(?:\s+Virtual)?|Assistente|Chatbot|Cliente|User|Usuário|Usuario|Customer|Você|Voce|SAC|Robô|Robo)\s*:/gi,
        '\n$1:'
      )
      // Bullets/listas — quebra antes do bullet
      .replace(/(?<=\S)\s+([••▸→]\s+)/g, '\n$1')
      .replace(/(?<=\S)\s+([-*]\s+)(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇa-záàâãéêíóôõúç])/g, '\n$1')
      // Numeração tipo "1." ou "1)" em meio de texto seguida de capitalizada
      .replace(/(?<=\.)\s+(\d{1,2}[.)]\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]))/g, '\n$1')
      // Colchete (geralmente mídia/anotação)
      .replace(/(?<=\S)\s+(\[)/g, '\n$1')
      // Limpa quebras triplicadas+
      .replace(/\n{3,}/g, '\n\n')
  );
}

/**
 * Junta linhas que foram quebradas APENAS por largura visual (PDFs).
 *
 * Regra: linha continua a anterior SE:
 *  - Não começa com marker (#/Cenário/Bot:/-/etc.)
 *  - E a anterior NÃO terminou em pontuação forte (.!?:])
 *  - E a anterior não é vazia
 */
export function joinWrappedLines(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  /**
   * Estado pós-separador (___):
   *  0 = normal
   *  1 = próxima linha não-vazia é título de seção → forçar standalone
   *  2 = linha de título acabou de ser empurrada → primeira linha de conteúdo
   *      também não pode ser absorvida pelo título (previne "Título Conteúdo…")
   */
  let afterSectionBreak = 0;

  const isMarker = (line: string) => {
    const trimmed = line.trim();
    // Marcador de quebra de seção (vindo de ________________)
    if (trimmed === '===SECTION_BREAK===') return true;
    return (
      /^(?:#{1,3}\s|cenário\s+\d+|frame\s*:|abertura\s+padrão|encerramento\s+padrão|menu\s+principal|bloco\s+[a-z]|bot|gui|cliente|user|usuário|usuario|você|voce|consumidor|customer|atendente|assistente|chatbot|sac|robô|robo|[-*•▸→]\s|\d+[.)]\s|[a-z][.)]\s|condicional\s*:|se\s+|caso\s+|quando\s+|verifica\s+se|checa\s+se|in[íi]cio\b|https?:\/\/|www\.|get\s+\/|post\s+\/|put\s+\/|patch\s+\/|delete\s+\/|chama\s+(?:a\s+)?api|consulta\s+(?:a\s+)?api|use[a-z]?\s+(?:a\s+)?ia\b|ia\s+generativa|chatgpt|claude\b|atendimento\s+humano|transbordo|falar\s+com\s+(?:um\s+)?atendente|volta(?:r)?\s+(?:ao|pro|para)|vai\s+(?:para|pra)|continua\s+em|encaminha\s+(?:para|pra)|pula\s+(?:para|pra))/i.test(
        trimmed
      ) ||
      // Linha começando com [ (mídia, anotação) é sempre um marker
      trimmed.startsWith('[')
    );
  };

  const endsHard = (line: string) => {
    const t = line.trim();
    if (t === '') return true;
    // Marcador de quebra explícita → sempre "fim de parágrafo"
    if (t === '===SECTION_BREAK===') return true;
    // Pontuação forte
    if (/[.!?:\]\)]\s*$/.test(t)) return true;
    // Linha ANTERIOR é um header de seção → quebra obrigatória
    if (/^(?:#{1,3}\s|cenário\s+\d+|frame\s*:|abertura\s+padrão|encerramento\s+padrão|menu\s+principal|bloco\s+[a-z]|\d{1,2}[.)]\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/i.test(t)) {
      return true;
    }
    return false;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trimEnd();
    if (out.length === 0) {
      out.push(line);
      continue;
    }
    const prev = out[out.length - 1];
    if (line.trim() === '') {
      out.push(line);
      continue;
    }

    // Separador de seção explícito → próxima linha não-vazia = título
    if (line.trim() === '===SECTION_BREAK===') {
      out.push(line);
      afterSectionBreak = 1;
      continue;
    }

    // Linha de título pós-separador: nunca juntar com anterior
    if (afterSectionBreak === 1) {
      out.push(line);
      afterSectionBreak = 2; // próxima linha de conteúdo tb não pode absorver o título
      continue;
    }
    // Primeira linha de conteúdo após título: também standalone (evita "Título Frase…")
    if (afterSectionBreak === 2) {
      afterSectionBreak = 0;
      out.push(line);
      continue;
    }

    if (isMarker(line) || endsHard(prev)) {
      out.push(line);
      continue;
    }
    // Junta com a anterior
    out[out.length - 1] = prev + ' ' + line.trimStart();
  }

  return out.join('\n');
}

/**
 * Pipeline completo de normalização.
 */
export function normalize(text: string): string {
  return joinWrappedLines(splitInlineMarkers(text));
}
