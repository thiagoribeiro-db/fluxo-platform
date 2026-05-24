/**
 * Tipos do sistema de Voice/Tone — checagem semântica de consistência
 * de tom nas mensagens do bot via IA (Claude).
 *
 * Fluxo:
 *  1. Usuário escolhe um preset (formal-técnico, casual-próximo, etc.)
 *     ou cria um custom descrevendo o tom desejado
 *  2. Action `analyzeVoiceTone` envia o profile + textos do fluxo pro
 *     Claude, que retorna sugestões pontuais
 *  3. UI mostra cada sugestão com diff aceitar/recusar
 *  4. Accept → patch no node correspondente
 */

export type VoicePresetId =
  | 'formal-tecnico'
  | 'casual-proximo'
  | 'amigavel-leve'
  | 'corporativo-serio'
  | 'jovem-descontraido'
  | 'custom';

/**
 * Severidade da sugestão — quanto a mensagem destoa do tom escolhido.
 * Pode ser usada pra pintar a UI ou priorizar exibição.
 */
export type VoiceSeverity = 'low' | 'medium' | 'high';

/**
 * Profile salvo (no localStorage por projeto). O `preset` indica o
 * template base; `description` é o texto que vai pro system prompt
 * da IA (pode ser editado pelo usuário se quiser customizar um preset).
 */
export interface VoiceProfile {
  preset: VoicePresetId;
  /** Descrição livre do tom — vai pro system prompt da IA. */
  description: string;
  /** Exemplos de mensagens que representam o tom (1-3 frases). */
  examples?: string[];
}

/**
 * Resultado de uma sugestão de melhoria.
 */
export interface VoiceSuggestion {
  /** ID do node que tem a mensagem. */
  nodeId: string;
  /** Path do campo dentro de node.data (ex: 'text', 'header', 'options[0]'). */
  fieldPath: string;
  /** Texto humano descrevendo o campo (ex: "Mensagem", "Header"). */
  fieldLabel: string;
  /** Frame onde está, pro user se localizar. */
  frameLabel: string;
  /** Code do bloco se houver (ex: S001). */
  code: string | null;
  /** Texto original (que está no node hoje). */
  original: string;
  /** Texto sugerido (reescrito mantendo significado). */
  suggested: string;
  /** Por que destoa do tom — explicação curta. */
  reason: string;
  /** Quão "fora do tom" está. */
  severity: VoiceSeverity;
}

/**
 * Resultado da análise — lista de sugestões + meta.
 */
export interface VoiceAnalysisResult {
  suggestions: VoiceSuggestion[];
  /** Total de mensagens analisadas (antes do filtro de "fora do tom"). */
  analyzedCount: number;
  /** Modelo Claude usado, pra debug. */
  model?: string;
}
