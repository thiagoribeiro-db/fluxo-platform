/**
 * Tracking labels — extração + parsing de rótulos auto-gerados pra trackings.
 *
 * Convenção: o rótulo de um tracking auto-gerado é `{nome} {suffix}`,
 * onde `nome` é extraído do texto do bloco pai (bubble-bot, menu) e
 * `suffix` indica o tipo de evento.
 *
 * Ex:
 *   bubble-bot "Olá! Sou a Gui..." → tracking "ola gui exibicao"
 *   menu "Selecione" → 3 trackings (exibicao, selecao, inesperado)
 *   bubble-user input → tracking "{nome do bot anterior} input" no parent
 *
 * Funções aqui são PURAS — sem dependência de DOM ou React. Testáveis.
 */

/**
 * Sufixos conhecidos dos trackings auto-gerados. Usados pra reconhecer
 * rótulos automáticos (vs customizados pelo usuário) na hora de sincronizar
 * mudanças de texto do bloco pai.
 */
export const TRACKING_SUFFIXES = [
  'exibicao',
  'selecao',
  'inesperado',
  'input',
] as const;
export type TrackingSuffix = (typeof TRACKING_SUFFIXES)[number];

/**
 * Stopwords PT-BR — palavras conectivas/auxiliares que NÃO viram nome de
 * tracking. Lista deliberadamente conservadora: preposições, artigos, pronomes,
 * auxiliares comuns. Verbos significativos (ex: "registrar", "comprar",
 * "agendar") são mantidos.
 */
export const TRACKING_STOPWORDS_PT = new Set([
  // Artigos
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  // Conjunções/conectivos
  'e', 'ou', 'mas', 'porem', 'entao', 'pois',
  'que', 'se', 'como', 'quando', 'onde', 'quem', 'qual',
  // Preposições e contrações
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'para', 'com', 'sem', 'ao', 'aos',
  'pelo', 'pela', 'pelos', 'pelas', 'sob', 'sobre', 'entre', 'ate',
  // Pronomes
  'voce', 'voces', 'eu', 'tu', 'ele', 'ela', 'eles', 'elas',
  'nos', 'vos', 'lhe', 'lhes',
  'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'seus', 'suas',
  'teu', 'tua', 'nosso', 'nossa', 'nossos', 'nossas',
  // Demonstrativos
  'este', 'esta', 'estes', 'estas', 'isto',
  'esse', 'essa', 'esses', 'essas', 'isso',
  'aquele', 'aquela', 'aqueles', 'aquelas', 'aquilo',
  // Auxiliares e verbos genéricos
  'deseja', 'quer', 'precisa', 'pode', 'posso', 'devemos', 'podemos',
  'sou', 'somos', 'foi', 'foram', 'sera', 'serao',
  'tem', 'temos', 'tinha', 'ter', 'estar', 'estao',
  'ha', 'havia', 'haver', 'faz', 'fazer',
  // Saudações
  'ola', 'oi', 'tchau', 'obrigado', 'obrigada',
  // Adverbios genéricos
  'aqui', 'la', 'ali', 'agora', 'hoje', 'ontem', 'amanha',
  'mais', 'menos', 'muito', 'muita', 'muitos', 'muitas', 'pouco', 'pouca',
  'todo', 'toda', 'todos', 'todas', 'cada', 'tao', 'tambem',
  'apenas',
  // Respostas
  'sim', 'nao',
]);

/**
 * Slugify URL-safe (ex: frameId de "Saudação" → "saudacao").
 * NÃO usado pra rótulos de tracking — use `extractTrackingName` pra isso.
 */
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

/**
 * Extrai um NOME CURTO de um texto, pra usar como rótulo de tracking.
 *
 * Algoritmo:
 *  1. Lowercase + remove diacríticos
 *  2. Remove pontuação (mantém só letras/números/espaço)
 *  3. Filtra stopwords PT-BR e palavras com <= 2 chars
 *  4. Retorna as primeiras `maxWords` palavras restantes, separadas por ESPAÇO
 *
 * Exemplo:
 *   "Se você deseja registrar um relato relacionado a conduta..."
 *   → "registrar relato"
 *
 * Diferente de `slugify`, NÃO usa underscore — separador é espaço.
 * E NÃO trunca os primeiros 30 chars literais; pega as palavras significativas.
 */
export function extractTrackingName(text: string, maxWords = 2): string {
  if (!text) return 'sem nome';
  const cleaned = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacríticos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned
    .split(' ')
    .filter((w) => w.length > 2 && !TRACKING_STOPWORDS_PT.has(w));
  if (words.length === 0) return 'sem nome';
  return words.slice(0, maxWords).join(' ');
}

/**
 * Divide um label de tracking em `{name} {suffix}`. Retorna null se o label
 * não termina com um sufixo conhecido — sinal de que foi customizado pelo
 * usuário (e portanto NÃO deve ser sobrescrito por re-sync automático).
 */
export function parseTrackingLabel(
  label: string
): { name: string; suffix: TrackingSuffix } | null {
  for (const suffix of TRACKING_SUFFIXES) {
    if (label.endsWith(` ${suffix}`)) {
      return {
        name: label.slice(0, label.length - suffix.length - 1),
        suffix,
      };
    }
  }
  return null;
}
