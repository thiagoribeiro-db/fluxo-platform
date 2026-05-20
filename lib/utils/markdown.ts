/**
 * Markdown estilo WhatsApp Business — sintaxe oficial do canal:
 *
 *   *texto*    → negrito          (UM asterisco, abre e fecha)
 *   _texto_    → itálico          (UM underscore, abre e fecha)
 *   ~texto~    → tachado          (UM til, abre e fecha)
 *   `texto`    → monospace        (backtick simples)
 *
 * Extensão local (NÃO oficial do WhatsApp, só pra visualização no editor):
 *
 *   {#RRGGBB:texto}   → cor do texto (perde no export, é decorativo no canvas)
 *
 * Emojis: Unicode direto no texto (não precisa de marcação).
 *
 * Quebras de linha: `\n` literal no markdown vira `<br>` no HTML.
 */

const ESC_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};
function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ESC_MAP[c]);
}

/**
 * Converte texto em markdown WhatsApp pra HTML renderizável.
 * Aplica em ordem: escape HTML → cor → bold → italic → strike → code → \n.
 *
 * Observação: bold/italic/strike são "non-greedy" e param na quebra de linha
 * pra evitar wraps gigantes em texto multi-linha.
 */
export function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = escapeHtml(md);

  // Cor: {#RRGGBB:texto} — valida 3 ou 6 chars hex
  html = html.replace(
    /\{#([0-9a-fA-F]{3,8}):([^{}\n]+)\}/g,
    (_m, hex, txt) => `<span style="color:#${hex}">${txt}</span>`
  );

  // Bold *texto*
  html = html.replace(/\*([^*\n]+?)\*/g, '<strong>$1</strong>');
  // Italic _texto_
  html = html.replace(/_([^_\n]+?)_/g, '<em>$1</em>');
  // Strike ~texto~
  html = html.replace(/~([^~\n]+?)~/g, '<s>$1</s>');
  // Monospace `texto`
  html = html.replace(/`([^`\n]+?)`/g, '<code>$1</code>');

  // Quebras de linha
  html = html.replace(/\n/g, '<br>');

  return html;
}

/**
 * Converte HTML (vindo do contenteditable) de volta pra markdown WhatsApp.
 * Lida com tags comuns que o browser emite ao digitar/formatar:
 *   <strong>/<b>, <em>/<i>, <s>/<strike>, <code>, <span style="color:...">,
 *   <br>, <div>, <p>.
 *
 * NÃO preserva atributos arbitrários — só os marcadores reconhecidos.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let s = html;

  // Normaliza quebras de linha: <div>, <p>, <br> → \n
  // <div> e <p> abrem nova linha; <br> também.
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(div|p)>/gi, '\n');
  s = s.replace(/<(div|p)[^>]*>/gi, '');

  // Cor: <span style="color:#XXX">texto</span> → {#XXX:texto}
  // Aceita "color:#hex" e "color: #hex" (espaço opcional)
  s = s.replace(
    /<span\s+style="[^"]*color\s*:\s*#?([0-9a-fA-F]{3,8})[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_m, hex, inner) => `{#${hex}:${inner}}`
  );

  // <strong> | <b> → *texto*
  s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '*$2*');
  // <em> | <i> → _texto_
  s = s.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '_$2_');
  // <s> | <strike> | <del> → ~texto~
  s = s.replace(/<(s|strike|del)>([\s\S]*?)<\/\1>/gi, '~$2~');
  // <code> → `texto`
  s = s.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');

  // Remove qualquer outra tag remanescente (defensivo)
  s = s.replace(/<[^>]+>/g, '');

  // Decodifica entities básicas
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Colapsa linhas-em-branco no final
  s = s.replace(/\n{3,}/g, '\n\n').replace(/\n+$/g, '');

  return s;
}
