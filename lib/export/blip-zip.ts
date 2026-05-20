/**
 * Empacota os arquivos exportados num único .zip pra download.
 *
 * Usa JSZip (client-side) — não precisa de server action porque os dados
 * já estão no state do FlowEditor. Mais simples + economiza round-trip.
 */

import JSZip from 'jszip';
import type { ExportFrameResult } from './blip-exporter';

/**
 * Cria um Blob .zip contendo os JSONs Blip de cada frame.
 * `prettyPrint`: se true, indenta o JSON (mais legível, arquivo maior).
 */
export async function buildBlipZip(
  files: ExportFrameResult[],
  prettyPrint = false
): Promise<Blob> {
  const zip = new JSZip();
  for (const f of files) {
    const json = prettyPrint
      ? JSON.stringify(f.flow, null, 2)
      : JSON.stringify(f.flow);
    zip.file(f.filename, json);
  }
  // Opcional: README com as warnings consolidadas
  const allWarnings = files.flatMap((f) =>
    f.warnings.map((w) => `[${f.filename}] ${w}`)
  );
  if (allWarnings.length > 0) {
    zip.file(
      '_AVISOS.txt',
      [
        'Avisos gerados durante o export Blip:',
        '',
        ...allWarnings,
        '',
        '— Revise os pontos acima antes/depois de importar na Blip.',
      ].join('\n')
    );
  }
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Aciona o download de um Blob com o nome fornecido.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Pequeno delay antes de revogar (alguns browsers precisam)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
