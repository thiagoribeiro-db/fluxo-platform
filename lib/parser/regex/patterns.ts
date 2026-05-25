/**
 * Patterns regex usadas pelo parser de escopo — todas centralizadas.
 *
 * Organizadas por categoria pra facilitar manutenção. Cada regex é
 * documentada com exemplos do que casa.
 *
 * Princípios:
 *  - Case-insensitive sempre que faz sentido (`i` flag)
 *  - Aceitar variações de português (com/sem acento, abreviações comuns)
 *  - Tolerar espaços, dois-pontos opcional, abreviações
 */

// =============================================================================
// SEÇÕES — quebram o texto em frames
// =============================================================================

/**
 * Cabeçalhos de seção (frame). Casa:
 *  - `# Saudação` / `## Algo Mais` / `### Encerramento`
 *  - `Cenário 1:` / `Cenário 12:`
 *  - `Frame: Saudação` / `Frame Saudação`
 *  - `Abertura padrão` / `Encerramento padrão`
 *  - `Menu principal padronizado`
 *  - `1. Saudação` / `01. Saudação` (numerado em início, capitalizado)
 */
export const SECTION_HEADER = new RegExp(
  // # / ## / ###
  '^(?:#{1,3}\\s+' +
    // Cenário N (sem dois pontos opcional, mas tira)
    '|cenário\\s+\\d+\\s*:?\\s*' +
    // Frame: X
    '|frame\\s*:?\\s+' +
    // Abertura/Encerramento padrão
    '|abertura\\s+padrão\\b' +
    '|encerramento\\s+padrão\\b' +
    // Menu principal
    '|menu\\s+principal\\b' +
    // Numerado tipo "1. Algo" (tolerante a 1) e 01.)
    '|\\d{1,2}[.)]\\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])' +
    ')',
  'i'
);

// =============================================================================
// PRE-FIXOS DE FALANTE
// =============================================================================

/**
 * Linha começa com "Bot:", "Gui:", "Atendente:" etc → bubble-bot
 *
 * Variações cobertas:
 *  - Bot: / BOT: / Bot diz: / Bot responde:
 *  - Gui: (nome comum de assistente)
 *  - Atendente: / Atendente Virtual: / Assistente:
 *  - Chatbot: / Robô: / Robo:
 *  - SAC: (linha de atendimento)
 *  - Nome custom seguido de `:` quando o texto deixa claro que é bot
 *    (cobertura básica)
 */
export const BOT_PREFIX = new RegExp(
  '^(?:bot|gui|guilherme|atendente\\s*virtual|atendente|assistente|chatbot|rob[ôo]|sac|nome\\s+do\\s+bot)' +
    '\\s*(?:diz|responde|fala|envia|pergunta)?\\s*:\\s*',
  'i'
);

/**
 * Linha começa com "Cliente:", "User:" etc → bubble-user
 */
export const USER_PREFIX = new RegExp(
  '^(?:cliente|user|usuário|usuario|customer|você|voce|consumidor)' +
    '\\s*(?:diz|escolhe|seleciona|envia|responde|digita|escreve)?\\s*:\\s*',
  'i'
);

// =============================================================================
// LISTAS — viram options/btn-short/btn-long/menu
// =============================================================================

/**
 * Item de lista markdown. Casa:
 *  - `- texto`
 *  - `* texto`
 *  - `• texto` (bullet unicode)
 *  - `1. texto` / `1) texto`
 *  - `a) texto` / `A) texto`
 *  - `→ texto` / `▸ texto`
 */
export const LIST_ITEM = /^(?:[-*•▸→]\s+|\d+[.)]\s+|[a-zA-Z][.)]\s+)/;

/**
 * Detecta "Opções: A | B | C" inline (PDFs costumam vir assim).
 * Os separadores aceitos: `|`, `;`, `/`, ` ou `, `, `.
 */
export const OPTIONS_INLINE =
  /\b(?:opç(?:ões|oes)|opt[io]ons|caixa\s+de\s+opç(?:ões|oes)|escolhe?\s+entre)\s*:?\s*([^\n]+)/i;

// =============================================================================
// MÍDIAS
// =============================================================================

export const MEDIA_KIND_VIDEO = /\b(?:vídeo|video|reels|reel|story)\b/i;
export const MEDIA_KIND_DOCUMENTO =
  /\b(?:pdf|documento|encarte|catálogo|catalogo|anexo|arquivo|contrato|boleto|relatório|relatorio)\b/i;
export const MEDIA_KIND_IMAGEM =
  /\b(?:imagem|imagens|foto|fotos|fotografia|figura|gif|png|jpg|jpeg|webp|card|cards|ilustração|ilustracao)\b/i;
export const MEDIA_KIND_AUDIO = /\b(?:áudio|audio|voz|gravação|gravacao|música|musica|mp3|wav)\b/i;

/**
 * Frases comuns que indicam o bot enviando mídia (mesmo sem `[...]`).
 *  - "Aqui o bot envia uma imagem de ..."
 *  - "Bot anexa o PDF do contrato"
 *  - "Atendente compartilha o vídeo do produto"
 *  - "Encaminha o catálogo"
 *  - "Manda foto"
 */
export const MEDIA_VERB = /\b(?:envia|anexa|compartilha|encaminha|manda|disponibiliza|exibe|mostra|apresenta)\b/i;

// =============================================================================
// CONDICIONAIS
// =============================================================================

/**
 * Detecta condicional. Casa:
 *  - `Se cliente é VIP` / `Se a resposta for sim`
 *  - `Caso cliente seja menor de idade`
 *  - `Quando o status for aprovado`
 *  - `If/Else` (em escopos bilíngues)
 *  - `Condicional: X é Y?`
 *  - `Verifica se ...`
 */
export const CONDITIONAL_PREFIX =
  /^(?:condicional\s*:?\s*|se\s+|caso\s+|quando\s+|if\s+|verifica\s+se\s+|checa\s+se\s+)/i;

/**
 * Frases típicas de "então X / senão Y" pra capturar branches.
 *  - `, então segue pra X`
 *  - `, senão volta pro menu`
 *  - `\n  Sim: X` / `\n  Não: X` (branches indented)
 */
export const CONDITIONAL_THEN = /[,\.]\s*(?:então|then)\s+/i;
export const CONDITIONAL_ELSE = /[,\.]\s*(?:senão|sen[ãa]o|else)\s+/i;
export const CONDITIONAL_BRANCH_SIM_NAO = /^\s*(sim|não|nao|yes|no|verdadeiro|falso|true|false)\s*:\s*/i;

// =============================================================================
// TRANSBORDO / ATENDIMENTO HUMANO
// =============================================================================

/**
 * Casa qualquer menção de atendimento humano (transbordo). Usado pra:
 *  1. Criar direcionamento → frame "Atendente"
 *  2. Sinalizar pro skill detector que deve injetar a cascata (Falar com atendente)
 */
export const TRANSBORDO =
  /\b(?:atendimento\s+humano|atendimento\s+humanizado|transbordo|falar\s+com\s+(?:um\s+)?atendente|chamar\s+(?:um\s+)?atendente|encaminhar\s+(?:pro|para)\s+(?:um\s+)?atendente|conex[aã]o\s+humana|sair\s+do\s+bot)\b/i;

// =============================================================================
// URLS / LINKS
// =============================================================================

/**
 * URL completa em qualquer lugar do texto. Suporta:
 *  - http(s):// com path/query
 *  - URLs curtas tipo `exemplo.com.br` (com TLD) — opcional via flag
 */
export const URL_FULL = /\b(https?:\/\/[^\s<>\)\]\"]+)/gi;
export const URL_BARE = /\b(?:www\.[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s<>\)\]\"]*)?)/gi;

// =============================================================================
// IA GENERATIVA
// =============================================================================

/**
 * Identifica intenção de usar IA generativa no fluxo. Casa:
 *  - "Use IA pra responder"
 *  - "Pergunta pro modelo"
 *  - "Geração via IA"
 *  - "IA generativa: X"
 *  - "ChatGPT" / "Claude" / "LLM" / "GPT"
 *  - "Resuma com IA" / "Resumir via IA"
 */
export const IA_GENERATIVA =
  /\b(?:ia\s+generativa|chatgpt|claude|llm|gpt|us(?:a|ar|e|em|amos|aremos)\s+(?:a\s+)?ia\b|pergunt[ae]\s+(?:pra|para|à)\s+ia|resume?\s+com\s+ia|gera\s+via\s+ia|gerar?\s+com\s+ia|consulta\s+(?:a\s+)?ia|chama\s+(?:o\s+)?(?:chatgpt|claude|gpt|llm))/i;

// =============================================================================
// INTEGRAÇÃO API
// =============================================================================

/**
 * Indica chamada de API/endpoint externo. Casa:
 *  - "Consulta API X"
 *  - "Chama endpoint /api/clientes"
 *  - "GET /api/x" / "POST /api/x" / etc.
 *  - "Integração com sistema X"
 *  - "Webhook"
 *  - "API REST"
 *  - "Salva no banco" / "Grava no CRM"
 */
export const API_CALL =
  /\b(?:chama\s+(?:a\s+)?api|consulta\s+(?:a\s+)?api|integraç[aã]o\s+com|integra\s+com|webhook|endpoint|api\s+rest|salva\s+no\s+(?:banco|crm|backoffice)|grava\s+no\s+(?:banco|crm|backoffice)|consulta\s+(?:o\s+)?(?:banco|crm|sistema))\b/i;

/**
 * HTTP method explícito (GET /path, POST /path).
 */
export const HTTP_METHOD = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s]+|https?:\/\/[^\s]+)/i;

// =============================================================================
// VARIÁVEIS — geram trackings automaticamente
// =============================================================================

/**
 * `{{nome}}` — sintaxe Blip / Liquid / Mustache. Mais comum em escopos.
 */
export const VAR_HANDLEBARS = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * `{nome}` — sintaxe simplificada (1 chave).
 * Cuidado: também casa JSON literal, então só usar quando contexto for de placeholder.
 */
export const VAR_SINGLE_BRACE = /\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}/g;

/**
 * `[NOME_CLIENTE]` — maiúsculas/underscore (estilo Blip antigo).
 */
export const VAR_BRACKET_UPPER = /\[([A-Z][A-Z0-9_]{1,30})\]/g;

/**
 * `<nome>` — sintaxe XML-like.
 */
export const VAR_ANGLE = /<([a-z][a-z0-9_]{1,30})>/g;

/**
 * Frases que sugerem captura de dado → vira tracking input nomeado.
 *  - "Pergunta o nome do cliente"
 *  - "Coleta o CPF"
 *  - "Solicita o endereço"
 *  - "Pede o telefone"
 *  - "Pergunta qual o e-mail"
 */
export const CAPTURE_VERB =
  /\b(?:pergunta|coleta|solicita|pede|registra|salva|grava|guarda)(?:\s+(?:o|a|os|as|um|uma|pelo|pela))?\s+(nome|cpf|cnpj|endereço|endereco|telefone|celular|e-?mail|cep|rg|data\s+de\s+nascimento|idade|cidade|estado|bairro|rua|empresa|cargo)\b/i;

// =============================================================================
// SKILLS AUTO-DETECTADAS
// =============================================================================

/**
 * Skill "Algo mais" — final típico de cenários.
 *  - "Posso ajudar com algo mais?"
 *  - "Mais alguma coisa?"
 *  - "Algo mais?"
 *  - "Tem mais alguma dúvida?"
 */
export const SKILL_ALGO_MAIS =
  /\b(?:posso\s+(?:te\s+)?ajudar\s+(?:com\s+)?(?:em\s+)?(?:mais\s+)?(?:alguma\s+)?(?:coisa|d[uú]vida)|algo\s+mais|mais\s+alguma\s+coisa|tem\s+mais\s+alguma\s+(?:coisa|d[uú]vida))\??/i;

/**
 * Skill "Encerramento" — NPS / avaliação / feedback.
 *  - "Pede avaliação"
 *  - "NPS"
 *  - "Feedback"
 *  - "Avalia o atendimento"
 *  - "Como foi o atendimento de 1 a 5"
 */
export const SKILL_ENCERRAMENTO =
  /\b(?:nps|avaliação\s+do\s+atendimento|pede\s+avaliação|feedback\s+do\s+(?:cliente|atendimento)|avalia\s+o\s+atendimento|como\s+foi\s+o\s+atendimento|de\s+\d\s+a\s+\d|notas?\s+de\s+\d\s+a\s+\d)\b/i;

/**
 * Skill "Validar CPF".
 */
export const SKILL_VALIDAR_CPF =
  /\b(?:valida(?:r|ção|cao)?\s+(?:o\s+)?cpf|verifica(?:r)?\s+(?:o\s+)?cpf|checa(?:r)?\s+(?:o\s+)?cpf|cpf\s+(?:é\s+)?(?:válido|valido))\b/i;

/**
 * Skill "Validar Email".
 */
export const SKILL_VALIDAR_EMAIL =
  /\b(?:valida(?:r|ção|cao)?\s+(?:o\s+)?(?:e-?mail|email)|verifica(?:r)?\s+(?:o\s+)?(?:e-?mail|email)|formato\s+(?:de\s+)?(?:e-?mail|email))\b/i;

/**
 * Skill "Opt-in LGPD" / consentimento.
 */
export const SKILL_OPTIN =
  /\b(?:opt-?in|consentimento|lgpd|aceita\s+(?:os\s+)?termos|política\s+de\s+privacidade|politica\s+de\s+privacidade|autoriza\s+(?:o\s+)?uso\s+(?:dos\s+)?dados)\b/i;

// =============================================================================
// DIRECIONAMENTOS / NAVEGAÇÃO
// =============================================================================

/**
 * Frases que indicam navegação pra outro frame. Casa:
 *  - "Volta ao menu" / "Voltar pro menu"
 *  - "Vai para X" / "Vá para X" / "Direciona pra X"
 *  - "Continua em X"
 *  - "Encaminha para [X]"
 *  - "Pula pra X"
 */
export const NAVIGATE_VERB =
  /\b(?:volta(?:r)?\s+(?:ao|pro|para\s+o|para\s+a|pra)|vai\s+(?:para|pra)|v[áa]\s+(?:para|pra)|direciona\s+(?:para|pra)|continua\s+em|encaminha\s+(?:para|pra)|pula\s+(?:para|pra)|navega\s+(?:para|pra)|segue\s+(?:para|pra))\s+(?:o\s+|a\s+|os\s+|as\s+)?(?:frame\s+|cen[áa]rio\s+|escopo\s+)?[\"\'\[]?([^.\n\]\"\']+?)[\"\'\]]?\s*(?:[.\n]|$)/i;

// =============================================================================
// ENTRY POINT
// =============================================================================

/**
 * Marca o "Início" do fluxo. Casa:
 *  - "Início"
 *  - "Marcador de início"
 *  - "Ponto de entrada"
 *  - "Entry point"
 *  - "Start"
 *  - "Quando o cliente inicia a conversa"
 */
export const ENTRY_POINT =
  /^(?:in[íi]cio\b|marcador\s+de\s+in[íi]cio|ponto\s+de\s+entrada|entry\s+point|start|quando\s+o\s+cliente\s+inicia)/i;
