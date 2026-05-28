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
 * Caso de uso contextualizado — uma frase exemplo amarrada a uma situação.
 */
export interface VoiceUseCase {
  /** Contexto da situação. Ex: "Saudação inicial", "Confirmação", "Erro/desculpa". */
  context: string;
  /** Exemplo concreto da frase nesse contexto, no tom desejado. */
  example: string;
}

/**
 * Conteúdo estruturado do tom — adicionado em 2026-05 pra enriquecer a UI
 * e o prompt da IA. Os campos viram seções renderizadas em markdown no
 * editor, e também são concatenados em `description` (legacy) pra
 * compatibilidade com analisadores antigos.
 *
 * Todos opcionais — profiles legacy só com `description` continuam funcionando.
 */
export interface VoiceStructuredContent {
  /** Frase curta descrevendo a "persona" do bot nesse tom (ex: "consultor sênior", "amiga divertida"). */
  persona?: string;
  /** Indústrias/situações onde esse tom se encaixa bem. */
  whenToUse?: string[];
  /** Contextos onde esse tom seria errado ou contraproducente. */
  whenNotToUse?: string[];
  /** Coisas a PREFERIR — vocabulário, ritmo, marcadores positivos. */
  dos?: string[];
  /** Coisas a EVITAR — gírias, formalismos, emojis em excesso, etc. */
  donts?: string[];
  /** Frases exemplares amarradas a contextos (saudação, erro, confirmação...). */
  useCases?: VoiceUseCase[];
}

/**
 * Profile salvo (no localStorage por projeto e/ou no DB no perfil global do user).
 * O `preset` indica o template base; `description` é o texto que vai pro system
 * prompt da IA (pode ser editado pelo usuário se quiser customizar um preset).
 *
 * O campo `structured` (adicionado em 2026-05) tem os mesmos dados quebrados
 * em seções — usado pela UI estruturada. `description` permanece como fonte
 * canônica pro prompt da IA (gerada/sincronizada a partir de `structured` quando
 * presente).
 */
export interface VoiceProfile {
  preset: VoicePresetId;
  /** Descrição livre do tom — vai pro system prompt da IA. */
  description: string;
  /** Exemplos de mensagens que representam o tom (1-3 frases). */
  examples?: string[];
  /** Conteúdo estruturado (persona, dos, donts, etc.) — opcional, retrocompatível. */
  structured?: VoiceStructuredContent;
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
