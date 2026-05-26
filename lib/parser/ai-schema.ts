/**
 * Schema do output da IA — formato intermediário semântico que a Claude API
 * produz ao interpretar um escopo (PDF/DOCX/TXT).
 *
 * IMPORTANTE: este é um formato DE ALTO NÍVEL — a IA NÃO emite posições,
 * IDs de node, parentId, trackings ou exceções. Essas coisas são derivadas
 * deterministicamente em `ai-builder.ts`.
 *
 * Por quê: a IA não é boa em coordenadas e códigos sequenciais, e a estrutura
 * de trackings/exceções segue regras fixas. Isolar a IA na camada SEMÂNTICA
 * deixa o output mais robusto e barato (menos tokens de output).
 */
import type { ProjectState } from '@/lib/types';

// =============================================================================
// TIPOS TS DO FORMATO INTERMEDIÁRIO (também documentados via JSON schema abaixo)
// =============================================================================

/**
 * Um bloco semântico — corresponde a uma "ação" do fluxo conversacional.
 *
 * Campos opcionais variam por `kind` (discriminated union pelo `kind`).
 */
export interface AIBlock {
  kind:
    | 'bot'             // bubble-bot (mensagem do bot)
    | 'user'            // bubble-user (input do usuário)
    | 'menu'            // menu modal (4+ opções)
    | 'buttons'         // 2-3 quick-replies curtos lado a lado (após uma pergunta)
    | 'btn-long'        // 1 quick-reply largo (uma única opção/CTA) — mesmo limite Meta de 20 chars
    | 'media'           // mídia (imagem/documento/vídeo) do bot ou user
    | 'link'            // card de link externo (URL)
    | 'direcionamento'  // direcionamento clicável pra outro frame ou destino
    | 'condicional'     // decisão if/else (varal com 2 saídas)
    | 'atendimento-humano' // transbordo: bot → humano (terminal)
    | 'integracao'      // notificação de integração (API ou planilha)
    | 'iag';            // notificação de IA generativa (entrada, reentrada, saída)

  /** Texto da bubble (kind = 'bot' ou 'user') */
  text?: string;

  /** Cabeçalho do menu (kind = 'menu') */
  header?: string;

  /** Opções do menu/buttons (array de strings) */
  options?: string[];

  /** Texto do botão final do menu (kind = 'menu'). Default: "Enviar". */
  footer?: string;

  /** Pergunta opcional que antecede um botão (kind = 'buttons'). Se preenchida, gera um bubble-bot ANTES dos botões. */
  question?: string;

  /** Label do btn-long ou direcionamento */
  label?: string;

  /** Tipo de mídia (kind = 'media') */
  media_kind?: 'imagem' | 'documento' | 'video' | 'audio';

  /** Sender da mídia (kind = 'media'): bot envia ou user envia */
  sender?: 'bot' | 'user';

  /** Caption/legenda da mídia (kind = 'media') */
  caption?: string;

  /** Condição avaliada (kind = 'condicional'). Ex: "Cliente é VIP?", "CPF válido" */
  condition?: string;

  /** Label da saída TRUE (kind = 'condicional'). Default: "Verdadeiro". */
  true_label?: string;

  /** Label da saída FALSE (kind = 'condicional'). Default: "Falso". */
  false_label?: string;

  /** URL alvo (kind = 'link'). Pode ser placeholder em chaves. */
  url?: string;

  /** Título do card de link (kind = 'link'). Default: "Acessar link". */
  link_title?: string;

  /** Descrição opcional do link (kind = 'link'). */
  link_description?: string;

  /** Frame de destino do direcionamento (frame_id do AIFrame) */
  target_frame_id?: string;

  /** Tipo de integração (kind = 'integracao') */
  integracao_type?: 'api' | 'planilha';

  /** Tipo de IAG (kind = 'iag') */
  iag_type?: 'entrada' | 'reentrada' | 'saida';

  /** Título da integração/IAG (kind = 'integracao' ou 'iag') */
  title?: string;

  /** Campos da integração/IAG */
  fields?: Array<{ label: string; key: string; value: string }>;
}

/**
 * Um frame = um agrupamento lógico do fluxo (cenário, seção, etapa).
 */
export interface AIFrame {
  /** Título humano do frame, ex: "Saudação", "Cenário 1: Ofertas" */
  title: string;

  /**
   * Prefixo de 1-3 letras maiúsculas pra IDs dentro do frame.
   *
   * Convenções:
   *  - 1 palavra → primeira letra: "Saudação" → "S"
   *  - 2 palavras → iniciais: "Algo Mais" → "AM", "Falar Atendente" → "FA"
   *  - 3+ palavras → 2-3 iniciais
   *  - Acrônimos preservados: "SAC" → "SAC", "FAQ" → "FAQ"
   *  - DEVE ser único no documento
   */
  prefix: string;

  /**
   * ID slug do frame (lowercase, sem acentos, hífens entre palavras).
   *
   * Ex: "Saudação" → "saudacao", "Comprar no site ou app" → "comprar-site-ou-app"
   *
   * Usado em `target_frame_id` de outros frames pra montar direcionamentos
   * navegáveis (clicar pula pro frame).
   *
   * DEVE ser único no documento.
   */
  frame_id: string;

  /** Blocos sequenciais — em ordem de aparição no fluxo conversacional */
  blocks: AIBlock[];
}

/**
 * Resultado final da IA — o que vai virar ProjectState via `ai-builder.ts`.
 */
export interface AIParseResult {
  frames: AIFrame[];

  /**
   * Observações/orientações encontradas no documento que NÃO devem virar nodes.
   *
   * Exemplos:
   *  - "Todas as mensagens devem ter tom amigável"
   *  - "Esse fluxo é usado em horário comercial"
   *  - "Validar com o time jurídico antes de subir"
   *
   * Mantidas só pra referência — futuramente podem virar comentários
   * automáticos no projeto.
   */
  notes?: string[];
}

// =============================================================================
// JSON SCHEMA — passado pra Claude API como input_schema do tool
// =============================================================================

/**
 * JSON Schema do tool `submit_flow_structure`.
 *
 * Usamos a estratégia: 1 tool com schema rico + `tool_choice: {type: 'tool'}`
 * forçado. Isso garante que Claude SEMPRE chame esse tool com o output válido,
 * sem precisar parsear texto livre.
 */
export const SUBMIT_FLOW_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    frames: {
      type: 'array',
      description:
        'Lista de frames (agrupamentos lógicos do fluxo). Cada frame contém blocos sequenciais.',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'Título humano do frame. Ex: "Saudação", "Cenário 1: Ofertas", "Encerramento".',
          },
          prefix: {
            type: 'string',
            description:
              'Prefixo de 1-3 letras maiúsculas pra IDs dentro do frame. Ex: "S" (Saudação), "OF" (Ofertas), "SAC" (SAC). DEVE ser único no documento.',
          },
          frame_id: {
            type: 'string',
            description:
              'Slug do frame: lowercase, sem acentos, hífens entre palavras. Ex: "saudacao", "ofertas", "comprar-site-ou-app". DEVE ser único; outros frames usam isso em target_frame_id.',
          },
          blocks: {
            type: 'array',
            description: 'Blocos sequenciais — em ordem de aparição no fluxo conversacional.',
            items: {
              type: 'object',
              properties: {
                kind: {
                  type: 'string',
                  enum: [
                    'bot',
                    'user',
                    'menu',
                    'buttons',
                    'btn-long',
                    'media',
                    'link',
                    'direcionamento',
                    'condicional',
                    'atendimento-humano',
                    'integracao',
                    'iag',
                  ],
                  description:
                    'Tipo de bloco. bot=mensagem do bot, user=input do usuário, menu=menu modal 4+ opções, buttons=2-3 botões curtos, btn-long=1 botão longo, media=imagem/doc/vídeo, link=card de URL externa, direcionamento=salto pra outro frame, condicional=decisão if/else com 2 saídas TRUE/FALSE, atendimento-humano=transbordo terminal pro humano, integracao=card de integração API/planilha, iag=card de IA generativa.',
                },
                text: {
                  type: 'string',
                  description: 'Texto da bubble (apenas para kind=bot ou kind=user).',
                },
                header: {
                  type: 'string',
                  description: 'Cabeçalho do menu (apenas para kind=menu). Ex: "Menu Principal", "Selecione uma opção".',
                },
                options: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Opções de menu ou buttons. Strings com o label de cada opção.',
                },
                footer: {
                  type: 'string',
                  description: 'Texto do botão final do menu (apenas para kind=menu). Default: "Enviar".',
                },
                question: {
                  type: 'string',
                  description:
                    'Pergunta opcional que antecede um botão (apenas para kind=buttons). Se preenchida, gera um bubble-bot ANTES dos botões.',
                },
                label: {
                  type: 'string',
                  description:
                    'Label do btn-long ou direcionamento. Ex: "Algo Mais", "Falar com atendente".',
                },
                media_kind: {
                  type: 'string',
                  enum: ['imagem', 'documento', 'video', 'audio'],
                  description: 'Tipo de mídia (apenas para kind=media).',
                },
                sender: {
                  type: 'string',
                  enum: ['bot', 'user'],
                  description: 'Quem envia a mídia (apenas para kind=media). bot=bot envia, user=usuário envia.',
                },
                caption: {
                  type: 'string',
                  description:
                    'Legenda/descrição da mídia (apenas para kind=media). Ex: "Encarte Pernambuco", "Foto do produto".',
                },
                condition: {
                  type: 'string',
                  description:
                    'Condição avaliada pelo sistema (apenas para kind=condicional). Curta e declarativa. Ex: "Cliente é VIP?", "CPF válido", "Horário comercial".',
                },
                true_label: {
                  type: 'string',
                  description:
                    'Texto da saída TRUE (apenas para kind=condicional). Default "Verdadeiro". Pode ser "Sim", "Válido", "Aprovado", etc.',
                },
                false_label: {
                  type: 'string',
                  description:
                    'Texto da saída FALSE (apenas para kind=condicional). Default "Falso". Pode ser "Não", "Inválido", "Negado", etc.',
                },
                url: {
                  type: 'string',
                  description:
                    'URL alvo (apenas para kind=link). Pode ser placeholder em chaves quando o documento não tem URL real, ex: "{link do site}".',
                },
                link_title: {
                  type: 'string',
                  description:
                    'Título exibido no card de link (apenas para kind=link). Texto curto e direto. Ex: "Acessar site", "Baixar app", "Solicitar cartão". Default: "Acessar link".',
                },
                link_description: {
                  type: 'string',
                  description:
                    'Descrição curta opcional do link (apenas para kind=link). 1-2 linhas.',
                },
                target_frame_id: {
                  type: 'string',
                  description:
                    'Frame de destino do direcionamento (apenas para kind=direcionamento). Use o frame_id de outro frame da lista.',
                },
                integracao_type: {
                  type: 'string',
                  enum: ['api', 'planilha'],
                  description: 'Tipo de integração (apenas para kind=integracao).',
                },
                iag_type: {
                  type: 'string',
                  enum: ['entrada', 'reentrada', 'saida'],
                  description:
                    'Tipo de IAG (apenas para kind=iag). entrada=primeira chamada, reentrada=retorno da IA, saida=encerra com IA.',
                },
                title: {
                  type: 'string',
                  description:
                    'Título do card de integração ou IAG (kind=integracao ou kind=iag). Ex: "Consultar CEP", "Classificar intenção".',
                },
                fields: {
                  type: 'array',
                  description:
                    'Campos do card de integração/IAG (kind=integracao ou kind=iag). Ex: [{label:"Endpoint", key:"url", value:"https://api.exemplo.com"}].',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      key: { type: 'string' },
                      value: { type: 'string' },
                    },
                    required: ['label', 'key', 'value'],
                  },
                },
              },
              required: ['kind'],
            },
          },
        },
        required: ['title', 'prefix', 'frame_id', 'blocks'],
      },
    },
    notes: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Observações/orientações encontradas no documento que NÃO devem virar nodes. Ex: "Tom amigável", "Validar com jurídico". Vazio se nenhuma.',
    },
  },
  required: ['frames'],
} as const;

// =============================================================================
// VALIDAÇÃO — valida o output do tool antes de usar no builder
// =============================================================================

import { AIParseResultSchema } from '@/lib/schemas/ai-output';

/**
 * Valida (defensivamente) o input retornado pelo tool da IA via Zod.
 * Se o output estiver malformado (campo faltando, tipos errados, kind
 * inválido), lança um erro descritivo com TODOS os problemas concatenados.
 *
 * Isso é camada de defesa caso o modelo emita algo fora do schema. Em
 * teoria não deve acontecer (tool com strict schema), mas LLMs ocasionalmente
 * pulam campos required ou inventam valores fora do enum.
 */
export function validateAIParseResult(input: unknown): AIParseResult {
  const result = AIParseResultSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`)
      .join('; ');
    const extra =
      result.error.issues.length > 5
        ? ` (e mais ${result.error.issues.length - 5} problemas)`
        : '';
    throw new Error(`Output da IA inválido — ${issues}${extra}`);
  }
  // O schema retorna o objeto validado — cast simples pra manter os types
  // legacy (AIBlock/AIFrame têm campos extras no TS que o schema permite via passthrough)
  return result.data as AIParseResult;
}

// Re-export pra centralizar uso
export type { ProjectState };
