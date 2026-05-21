'use server';

import { devLog } from '@/lib/utils/logger';

/**
 * Server action que extrai texto de arquivos (PDF, DOCX, MD, TXT).
 *
 * Pra PDF: usa `unpdf` (que usa pdf.js por baixo) pra extrair texto COM
 * coordenadas. Reconstroi as linhas baseado na posição Y de cada item de
 * texto, preservando as quebras visuais do PDF. Sem isso, o texto vem todo
 * em uma linha gigante e o parser não consegue identificar markers.
 *
 * Pra DOCX: usa `mammoth` (já preserva quebras).
 * Pra MD/TXT: leitura direta.
 */

interface ExtractInput {
  fileName: string;
  /** Conteúdo bruto do arquivo em base64. */
  base64: string;
}

interface PdfTextItem {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

export async function extractTextFromFile(
  input: ExtractInput
): Promise<{ text: string; format: string }> {
  const ext = (input.fileName.split('.').pop() || '').toLowerCase();
  const buffer = Buffer.from(input.base64, 'base64');

  if (ext === 'pdf') {
    const finalText = await extractPdfWithLayout(buffer);
    devLog(
      `[extract-text] PDF "${input.fileName}": ${finalText.length} chars, ${finalText.split('\n').length} linhas`
    );
    devLog(
      `[extract-text] Preview (300 chars):`,
      JSON.stringify(finalText.slice(0, 300))
    );
    return { text: finalText, format: 'pdf' };
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, format: 'docx' };
  }

  if (['md', 'markdown', 'txt'].includes(ext)) {
    return { text: buffer.toString('utf-8'), format: ext };
  }

  throw new Error(
    `Formato não suportado: .${ext}. Aceitos: .pdf, .docx, .md, .txt`
  );
}

/**
 * Extrai texto de PDF preservando quebras de linha REAIS (via análise das
 * coordenadas Y de cada item de texto).
 *
 * Como funciona:
 *  1. Pra cada página, pega os "items" de texto (cada glyph/palavra) com
 *     suas coordenadas (transform[4] = x, transform[5] = y).
 *  2. Agrupa items por Y similar (tolerância de 2 pontos) → cada grupo = linha
 *  3. Ordena linhas por Y descendente (PDF: y maior = topo da página)
 *  4. Concatena items de cada linha por X ascendente (esquerda → direita)
 *  5. Junta as linhas com `\n`, separa páginas com `\n\n`
 *
 * Resultado: texto com quebras de linha visualmente fiéis ao PDF original,
 * que o parser consegue tokenizar (markers ficam no início de cada linha).
 */
async function extractPdfWithLayout(buffer: Buffer): Promise<string> {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));

  const Y_TOLERANCE = 2;
  const pageTexts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as unknown as PdfTextItem[]).filter(
      (it) => typeof it.str === 'string'
    );

    // Agrupa items por Y similar
    interface Line {
      y: number;
      items: { x: number; str: string }[];
    }
    const lines: Line[] = [];
    for (const item of items) {
      if (!item.transform || item.transform.length < 6) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const existing = lines.find((l) => Math.abs(l.y - y) <= Y_TOLERANCE);
      if (existing) {
        existing.items.push({ x, str: item.str });
      } else {
        lines.push({ y, items: [{ x, str: item.str }] });
      }
    }

    // Ordena linhas de cima pra baixo (PDF: y maior = topo)
    lines.sort((a, b) => b.y - a.y);

    // Pra cada linha, ordena items por X (esquerda → direita) e junta
    const lineTexts = lines
      .map((line) => {
        line.items.sort((a, b) => a.x - b.x);
        // Junta com espaço se houver gap horizontal grande entre items
        // (heurística simples — assume que items dentro da mesma word ficam
        // colados ou com pouco espaço; items separados por espaço têm gap maior)
        let out = '';
        let lastEndX = -Infinity;
        for (let i = 0; i < line.items.length; i++) {
          const it = line.items[i];
          if (i > 0 && it.x > lastEndX + 2 && !out.endsWith(' ') && !it.str.startsWith(' ')) {
            out += ' ';
          }
          out += it.str;
          // Estima onde esse item termina (sem largura real, aproxima por str.length)
          lastEndX = it.x + it.str.length * 4; // ~4 pts por char (chute conservador)
        }
        return out.trim();
      })
      .filter((s) => s.length > 0);

    pageTexts.push(lineTexts.join('\n'));
  }

  return pageTexts.join('\n\n');
}
