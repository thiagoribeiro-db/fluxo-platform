/**
 * Export visual do canvas (React Flow) em PNG, PDF ou HTML.
 *
 * Estratégia: usa `html2canvas` pra rasterizar o DOM (já com tudo
 * renderizado), e depois empacota no formato escolhido.
 *  - PNG: dataURL direto do canvas → blob → download
 *  - PDF: insere o PNG numa página jsPDF dimensionada pra encaixar
 *  - HTML: HTML estático auto-contido com o PNG embedded em data URL
 *
 * Para captura "página inteira" (todos os frames, mesmo fora da viewport):
 * use `fitToBounds` antes pra ajustar o React Flow, aguarde um RAF, capture,
 * e restaure o viewport original.
 */
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { devWarn } from '@/lib/utils/logger';

export type ExportFormat = 'png' | 'pdf' | 'html';

export interface CaptureOptions {
  /** Escala da captura (1 = tamanho real, 2 = 2x densidade, etc) */
  scale?: number;
  /** Cor de fundo. Default: cinza muito claro pra batizar com o canvas */
  backgroundColor?: string;
}

export interface ExportOptions extends CaptureOptions {
  filename?: string;
  /** Título usado no HTML / no PDF como metadado */
  title?: string;
}

const DEFAULT_BG = '#f5f5f5';

/**
 * Rasteriza um elemento DOM via html2canvas.
 */
export async function captureCanvas(
  element: HTMLElement,
  opts: CaptureOptions = {}
): Promise<HTMLCanvasElement> {
  const { scale = 2, backgroundColor = DEFAULT_BG } = opts;
  // `windowWidth`/`windowHeight` forçam o html2canvas a usar as dimensões
  // do elemento (não da janela inteira) — importante quando capturamos
  // um container scrollable como o React Flow.
  return html2canvas(element, {
    scale,
    backgroundColor,
    logging: false,
    useCORS: true,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
}

function triggerDownload(url: string, filename: string): void {
  // Hook DEV-ONLY pra interceptar o download e salvar no server
  // (usado pelo /dev-preview pra eu validar o PDF autonomamente).
  const w = typeof window !== 'undefined' ? window : null;
  const intercept = (w as unknown as { __DEV_INTERCEPT_DOWNLOAD__?: (url: string, filename: string) => unknown })
    ?.__DEV_INTERCEPT_DOWNLOAD__;
  if (intercept) {
    try {
      intercept(url, filename);
      return;
    } catch (e) {
      // eslint-disable-next-line no-console
      devWarn('[visual-exporter] dev intercept falhou, caindo no download:', e);
    }
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function exportAsPng(
  element: HTMLElement,
  opts: ExportOptions = {}
): Promise<void> {
  const canvas = await captureCanvas(element, opts);
  const url = canvas.toDataURL('image/png');
  triggerDownload(url, opts.filename ?? 'fluxo.png');
}

export async function exportAsPdf(
  element: HTMLElement,
  opts: ExportOptions = {}
): Promise<void> {
  const canvas = await captureCanvas(element, opts);
  const scale = opts.scale ?? 2;
  // Dimensões "lógicas" da imagem (em px, antes do scale)
  const w = canvas.width / scale;
  const h = canvas.height / scale;
  // Página dimensionada pra caber a imagem 1:1 (sem letterbox)
  const orientation: 'landscape' | 'portrait' = w >= h ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [Math.max(w, 100), Math.max(h, 100)],
    compress: true,
  });
  if (opts.title) pdf.setProperties({ title: opts.title });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
  // Usa output('blob') + triggerDownload em vez de pdf.save() pra passar
  // pelo hook de intercept DEV (__DEV_INTERCEPT_DOWNLOAD__).
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  triggerDownload(url, opts.filename ?? 'fluxo.pdf');
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportAsHtml(
  element: HTMLElement,
  opts: ExportOptions = {}
): Promise<void> {
  const canvas = await captureCanvas(element, opts);
  const dataUrl = canvas.toDataURL('image/png');
  const title = opts.title ?? 'Fluxo';
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  *,*::before,*::after { box-sizing: border-box }
  body { margin: 0; background: ${DEFAULT_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; }
  header { max-width: 1400px; margin: 0 auto 16px; }
  h1 { font-size: 20px; margin: 0; color: #1f2937; }
  small { color: #6b7280; font-size: 12px; }
  main { max-width: 1400px; margin: 0 auto; }
  img { max-width: 100%; height: auto; display: block; box-shadow: 0 1px 4px rgba(0,0,0,.08); background: white; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <small>Exportado em ${new Date().toLocaleString('pt-BR')}</small>
</header>
<main>
  <img src="${dataUrl}" alt="${escapeHtml(title)}">
</main>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, opts.filename ?? 'fluxo.html');
  // Libera memória depois de um delay (download precisa do URL ainda vivo)
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Dispatcher por formato.
 */
export async function exportVisual(
  element: HTMLElement,
  format: ExportFormat,
  opts: ExportOptions = {}
): Promise<void> {
  switch (format) {
    case 'png':
      return exportAsPng(element, opts);
    case 'pdf':
      return exportAsPdf(element, opts);
    case 'html':
      return exportAsHtml(element, opts);
  }
}

// =============================================================================
// MODO "FRAME POR FRAME"
// =============================================================================
/**
 * Esconde UI do React Flow (Controls, MiniMap, Attribution) durante a captura,
 * pra exportar só o conteúdo (frames + nodes), sem chrome do editor.
 * Retorna uma função pra restaurar o estado original.
 */
function hideEditorChrome(root: HTMLElement): () => void {
  const selectors = [
    '.react-flow__controls',
    '.react-flow__minimap',
    '.react-flow__attribution',
    '.react-flow__panel',
  ];
  const restoreFns: Array<() => void> = [];
  for (const sel of selectors) {
    const els = root.querySelectorAll<HTMLElement>(sel);
    els.forEach((el) => {
      const prev = el.style.visibility;
      el.style.visibility = 'hidden';
      restoreFns.push(() => {
        el.style.visibility = prev;
      });
    });
  }
  return () => restoreFns.forEach((f) => f());
}

/** Espera 2 RAFs + um pequeno delay pra garantir que o transform/zoom do
 * React Flow já foi aplicado antes da próxima captura.
 */
async function waitForRender(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => setTimeout(r, 80));
}

/**
 * Captura o React Flow inteiro e recorta a área do frame especificado.
 *
 * O bbox do crop é o **bounding box que ENGLOBA o frame container + todos
 * os nodes filhos** (nodes cujo `findOwnerFrame` aponta pra este frame),
 * coletando getBoundingClientRect dos DOMs no canvas. Isso garante que
 * bubbles/btns que extrapolaram horizontalmente o retângulo do frame não
 * sejam cortados — o crop expande pra abraçar todos.
 *
 * `paddingPx` é em pixels do CSS (não do canvas) — adiciona folga ao
 * redor do bbox.
 */
async function captureFrameCropped(
  rfRoot: HTMLElement,
  frameId: string,
  contentNodeIds: string[],
  scale: number,
  bg: string,
  paddingPx = 96
): Promise<HTMLCanvasElement> {
  // 1. Esconde temporariamente nodes que NÃO pertencem a este frame.
  // Sem isto, frames vizinhos visualmente adjacentes (quando o fitView
  // deixa parte deles dentro da viewport) acabam aparecendo no PDF como
  // "bubbles vazando" pelo lado da captura. Trackings/exceções desses
  // nodes seguem o pai (renderizados em containers próprios pelo React
  // Flow, mas children compartilham a transform — esconder o pai não
  // esconde o tracking child em todos os casos, daí escondemos todos
  // que não estiverem no set allowed).
  const allowed = new Set<string>([frameId, ...contentNodeIds]);
  // Também mantemos visíveis trackings/exceções cujo parentId está no set.
  // Esses são DOMs com data-id próprio mas posicionados relativos ao parent.
  rfRoot
    .querySelectorAll<HTMLElement>('.react-flow__node[data-id]')
    .forEach((el) => {
      const id = el.getAttribute('data-id');
      if (!id || allowed.has(id)) return;
      // Heurística pra reconhecer children de nodes allowed: o React Flow
      // renderiza children dentro de containers `.react-flow__node-<type>`
      // colocados no mesmo .react-flow__viewport — não há aninhamento DOM.
      // Verificar parent via z-index/CSS é frágil; aceitamos esconder tudo
      // que não está no set explícito. Pra trackings/exceções de nodes
      // allowed, o caller deve incluí-los em contentNodeIds.
    });

  const hidden: Array<{ el: HTMLElement; prev: string }> = [];
  rfRoot
    .querySelectorAll<HTMLElement>('.react-flow__node[data-id]')
    .forEach((el) => {
      const id = el.getAttribute('data-id');
      if (!id || allowed.has(id)) return;
      hidden.push({ el, prev: el.style.visibility });
      el.style.visibility = 'hidden';
    });

  let fullCanvas: HTMLCanvasElement;
  try {
    fullCanvas = await html2canvas(rfRoot, {
      scale,
      backgroundColor: bg,
      logging: false,
      useCORS: true,
      width: rfRoot.clientWidth,
      height: rfRoot.clientHeight,
      windowWidth: rfRoot.clientWidth,
      windowHeight: rfRoot.clientHeight,
    });
  } finally {
    hidden.forEach(({ el, prev }) => {
      el.style.visibility = prev;
    });
  }

  // 2. Coleta bbox UNIÃO do frame container + todos os nodes do frame.
  //    Cada bounding rect é viewport-relative; o crop é em coords do
  //    `.react-flow`, então normalizamos pelo rfRect.left/top.
  const rfRect = rfRoot.getBoundingClientRect();
  const ids = [frameId, ...contentNodeIds];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let found = 0;
  for (const id of ids) {
    const el = rfRoot.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    // Ignora itens completamente fora da viewport (viewport-culled)
    if (r.width === 0 || r.height === 0) continue;
    found++;
    if (r.left < minX) minX = r.left;
    if (r.top < minY) minY = r.top;
    if (r.right > maxX) maxX = r.right;
    if (r.bottom > maxY) maxY = r.bottom;
  }
  if (found === 0) {
    // eslint-disable-next-line no-console
    devWarn(
      `[visual-exporter] nenhum DOM encontrado pro frame ${frameId} — retornando captura inteira`
    );
    return fullCanvas;
  }

  // 3. Calcula coords do crop relativas ao .react-flow, em CSS px
  const cssX = minX - rfRect.left - paddingPx;
  const cssY = minY - rfRect.top - paddingPx;
  const cssW = maxX - minX + paddingPx * 2;
  const cssH = maxY - minY + paddingPx * 2;

  const fullW = fullCanvas.width;
  const fullH = fullCanvas.height;
  const sx = Math.max(0, Math.round(cssX * scale));
  const sy = Math.max(0, Math.round(cssY * scale));
  const sw = Math.min(fullW - sx, Math.round(cssW * scale));
  const sh = Math.min(fullH - sy, Math.round(cssH * scale));

  if (sw <= 0 || sh <= 0) {
    // eslint-disable-next-line no-console
    devWarn(
      `[visual-exporter] crop inválido pro frame ${frameId} (${sw}x${sh})`
    );
    return fullCanvas;
  }

  const cropped = document.createElement('canvas');
  cropped.width = sw;
  cropped.height = sh;
  const ctx = cropped.getContext('2d');
  if (!ctx) return fullCanvas;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return cropped;
}

export interface FrameRef {
  id: string;
  title: string;
  /** Posição absoluta no canvas (data do nó frame) */
  position: { x: number; y: number };
  /** Tamanho do frame em px (data.width/height) */
  width: number;
  height: number;
}

export interface FrameByFrameContext {
  /** Root do React Flow (.react-flow) */
  rfRoot: HTMLElement;
  /** Lista de frames a exportar, na ordem desejada */
  frames: FrameRef[];
  /** Função que faz fitView pra um frame (recebe o id, ajusta a vista) */
  fitFrame: (frameId: string) => void;
  /**
   * IDs dos nodes que pertencem a cada frame (via findOwnerFrame).
   * Usado pra calcular o bbox de crop que ENGLOBA todos os elementos
   * do frame, não só o retângulo do container.
   */
  contentByFrame: Map<string, string[]>;
  /** Restaura o viewport original ao terminar */
  restoreViewport: () => void;
}

/**
 * Gera UM PDF com várias páginas — uma por frame. Cada página é dimensionada
 * pra cabe a captura desse frame (sem letterbox). Adiciona o título do
 * frame como metadado da página (canto superior esquerdo, fonte pequena).
 */
export async function exportFramesAsPdf(
  ctx: FrameByFrameContext,
  opts: ExportOptions = {}
): Promise<void> {
  const { rfRoot, frames, fitFrame, restoreViewport } = ctx;
  if (frames.length === 0) {
    throw new Error('Nenhum frame pra exportar.');
  }
  const scale = opts.scale ?? 2;
  const bg = opts.backgroundColor ?? DEFAULT_BG;
  const restoreChrome = hideEditorChrome(rfRoot);
  // Inicializa PDF com formato da primeira página (será redimensionado por página)
  let pdf: jsPDF | null = null;

  try {
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      fitFrame(frame.id);
      await waitForRender();
      const canvas = await captureFrameCropped(
        rfRoot,
        frame.id,
        ctx.contentByFrame.get(frame.id) ?? [],
        scale,
        bg
      );
      const w = canvas.width / scale;
      const h = canvas.height / scale;
      const orientation: 'landscape' | 'portrait' = w >= h ? 'landscape' : 'portrait';
      if (i === 0) {
        pdf = new jsPDF({
          orientation,
          unit: 'px',
          format: [Math.max(w, 100), Math.max(h, 100)],
          compress: true,
        });
        if (opts.title) pdf.setProperties({ title: opts.title });
      } else {
        pdf!.addPage([Math.max(w, 100), Math.max(h, 100)], orientation);
      }
      // Imagem ocupa a página toda
      pdf!.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
      // Título do frame: pequena legenda no topo
      pdf!.setFontSize(10);
      pdf!.setTextColor(80, 80, 80);
      pdf!.text(frame.title, 16, 18, { baseline: 'top' });
    }
    if (pdf) {
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      triggerDownload(url, opts.filename ?? 'fluxo.pdf');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } finally {
    restoreChrome();
    restoreViewport();
  }
}

/**
 * Gera N PNGs — um por frame. Cada arquivo baixado sequencialmente.
 * Nome inclui prefix do frame pra organização.
 */
export async function exportFramesAsPngs(
  ctx: FrameByFrameContext,
  opts: ExportOptions = {}
): Promise<void> {
  const { rfRoot, frames, fitFrame, restoreViewport } = ctx;
  const scale = opts.scale ?? 2;
  const bg = opts.backgroundColor ?? DEFAULT_BG;
  const restoreChrome = hideEditorChrome(rfRoot);
  const base = (opts.filename ?? 'fluxo').replace(/\.png$/i, '');
  try {
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      fitFrame(frame.id);
      await waitForRender();
      const canvas = await captureFrameCropped(
        rfRoot,
        frame.id,
        ctx.contentByFrame.get(frame.id) ?? [],
        scale,
        bg
      );
      const safeTitle = frame.title
        .replace(/[^a-zA-Z0-9-_\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();
      const fname = `${base}-${String(i + 1).padStart(2, '0')}-${safeTitle || 'frame'}.png`;
      triggerDownload(canvas.toDataURL('image/png'), fname);
      // Espera um pouco entre downloads pra o browser não bloquear
      await new Promise((r) => setTimeout(r, 200));
    }
  } finally {
    restoreChrome();
    restoreViewport();
  }
}

/**
 * Gera UM HTML estático com N seções — uma por frame. Cada seção tem um
 * título e a imagem do frame. Útil pra revisar o fluxo todo num documento
 * compartilhável.
 */
export async function exportFramesAsHtml(
  ctx: FrameByFrameContext,
  opts: ExportOptions = {}
): Promise<void> {
  const { rfRoot, frames, fitFrame, restoreViewport } = ctx;
  const scale = opts.scale ?? 2;
  const bg = opts.backgroundColor ?? DEFAULT_BG;
  const restoreChrome = hideEditorChrome(rfRoot);
  const title = opts.title ?? 'Fluxo';
  const sections: Array<{ title: string; dataUrl: string }> = [];
  try {
    for (const frame of frames) {
      fitFrame(frame.id);
      await waitForRender();
      const canvas = await captureFrameCropped(
        rfRoot,
        frame.id,
        ctx.contentByFrame.get(frame.id) ?? [],
        scale,
        bg
      );
      sections.push({
        title: frame.title,
        dataUrl: canvas.toDataURL('image/png'),
      });
    }
  } finally {
    restoreChrome();
    restoreViewport();
  }

  const sectionsHtml = sections
    .map(
      (s) => `
<section>
  <h2>${escapeHtml(s.title)}</h2>
  <img src="${s.dataUrl}" alt="${escapeHtml(s.title)}">
</section>`
    )
    .join('\n');
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  *,*::before,*::after { box-sizing: border-box }
  body { margin: 0; background: ${bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; }
  header, main { max-width: 1400px; margin: 0 auto; }
  header { margin-bottom: 24px; }
  h1 { font-size: 22px; margin: 0; color: #1f2937; }
  small { color: #6b7280; font-size: 12px; }
  section { margin-bottom: 32px; }
  h2 { font-size: 16px; color: #1f2937; margin: 0 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  img { max-width: 100%; height: auto; display: block; box-shadow: 0 1px 4px rgba(0,0,0,.08); background: white; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <small>${frames.length} frame(s) — exportado em ${new Date().toLocaleString('pt-BR')}</small>
</header>
<main>
${sectionsHtml}
</main>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, opts.filename ?? 'fluxo.html');
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Dispatcher do modo frame-por-frame */
export async function exportFrames(
  ctx: FrameByFrameContext,
  format: ExportFormat,
  opts: ExportOptions = {}
): Promise<void> {
  switch (format) {
    case 'png':
      return exportFramesAsPngs(ctx, opts);
    case 'pdf':
      return exportFramesAsPdf(ctx, opts);
    case 'html':
      return exportFramesAsHtml(ctx, opts);
  }
}
