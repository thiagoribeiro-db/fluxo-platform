'use server';

/**
 * Server action: interpreta um escopo (PDF/DOCX/TXT já extraído) usando IA
 * (Anthropic Claude API) e retorna um `ProjectState` pronto pra salvar.
 *
 * Estratégia:
 *  1. Chama Claude (modelo `claude-opus-4-7`) com:
 *     - System prompt longo + prompt caching (cache_control: ephemeral)
 *     - Tool `submit_flow_structure` com schema rico (forçado via tool_choice)
 *     - Adaptive thinking (modelo decide quanto raciocínio precisa)
 *     - Streaming (porque pode demorar 1-2 min — evita timeout)
 *  2. Valida o output do tool (defesa em profundidade)
 *  3. Passa pro builder determinístico (ai-builder.ts)
 *  4. Retorna ProjectState pronto
 *
 * IMPORTANTE: requer `ANTHROPIC_API_KEY` no `.env.local`. Sem ela, lança erro
 * descritivo no try/catch.
 */
import Anthropic from '@anthropic-ai/sdk';
import { AI_SYSTEM_PROMPT } from '@/lib/parser/ai-system-prompt';
import {
  SUBMIT_FLOW_TOOL_SCHEMA,
  validateAIParseResult,
  type AIParseResult,
} from '@/lib/parser/ai-schema';
import { buildStateFromAIResult } from '@/lib/parser/ai-builder';
import type { ProjectState } from '@/lib/types';
import { devLog, devWarn } from '@/lib/utils/logger';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 32000;
const TOOL_NAME = 'submit_flow_structure';

interface ParseInput {
  /** Texto bruto extraído do PDF/DOCX/TXT (vindo do extract-text.ts) */
  text: string;
  /** Nome do arquivo original (pra logging/contexto) */
  fileName?: string;
  /** ID do projeto alvo — usado pra registrar uso na tabela `ia_usage`. */
  projectId?: string;
}

interface ParseResult {
  state: ProjectState;
  meta: {
    framesCount: number;
    blocksCount: number;
    notes: string[];
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    durationMs: number;
  };
}

/**
 * Interpreta um escopo em texto via Claude e retorna o ProjectState construído.
 *
 * Demora normalmente 30s-2min (depende do tamanho do escopo e do "thinking"
 * do modelo). Por isso o cliente deve mostrar um overlay de loading e NÃO
 * pode usar transitions curtas.
 */
export async function parseEscopoWithAI(input: ParseInput): Promise<ParseResult> {
  const startedAt = Date.now();

  // --- Validações de entrada
  if (!input.text || !input.text.trim()) {
    throw new Error('Texto do escopo vazio — nada a interpretar.');
  }

  // Lê ANTHROPIC_API_KEY do env, com fallback que lê .env.local direto.
  //
  // Por quê o fallback? Em Windows, o Claude Code CLI (e algumas instalações
  // do Anthropic SDK) setam `ANTHROPIC_API_KEY=""` (vazio) no ambiente do
  // sistema. Next.js NÃO sobrescreve env vars já existentes no `process.env`
  // ao carregar `.env.local` — então essa string vazia "ganha" e a chave
  // do .env.local nunca é vista.
  //
  // Solução: se process.env vier vazio, lê do arquivo direto. Só roda quando
  // necessário (não é hot path) e só em dev (em prod não tem .env.local).
  let apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    apiKey = readApiKeyFromEnvFile();
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'ANTHROPIC_API_KEY não configurada. Adicione ao arquivo .env.local (pegue em https://console.anthropic.com/settings/keys).'
    );
  }

  // --- Limita tamanho (sanity) — 300k caracteres ≈ 75k tokens, dentro do limite
  let inputText = input.text;
  if (inputText.length > 300_000) {
    devWarn(
      `[parse-with-ai] Texto muito longo (${inputText.length} chars) — truncando pra 300k.`
    );
    inputText = inputText.slice(0, 300_000) + '\n\n[... documento truncado ...]';
  }

  devLog(
    `[parse-with-ai] Iniciando parsing de "${input.fileName ?? 'texto'}" (${inputText.length} chars)…`
  );

  // --- Inicializa client
  const client = new Anthropic({ apiKey });

  // --- Tool com schema estruturado (forçado via tool_choice)
  // Cast porque SUBMIT_FLOW_TOOL_SCHEMA é um literal `as const` e o SDK
  // espera um shape mais lenient (Tool.InputSchema = { type: 'object', ... }).
  const tool: Anthropic.Tool = {
    name: TOOL_NAME,
    description:
      'Submete a estrutura interpretada do escopo do chatbot. Chame esse tool com a representação JSON dos frames e blocos identificados no documento. NÃO retorne texto livre — só a chamada desse tool.',
    input_schema: SUBMIT_FLOW_TOOL_SCHEMA as unknown as Anthropic.Tool['input_schema'],
  };

  // --- User message com o documento embutido
  const userContent = [
    '<documento_escopo>',
    inputText,
    '</documento_escopo>',
    '',
    'Analise CUIDADOSAMENTE o documento acima e produza a estrutura semântica via tool call.',
    '',
    'Lembre-se:',
    '- Distinguir orientação (vai pra notes) de estrutura (vira blocks)',
    '- Preservar a ordem do documento',
    '- NÃO inventar conteúdo — fidelidade ao escopo original',
    '- Cada bubble do bot é um bloco separado',
    '- Após menus, adicionar direcionamentos pra cada opção',
    '- Garantir unicidade de prefix e frame_id',
    '',
    'Pode raciocinar quanto precisar — qualidade > velocidade.',
  ].join('\n');

  // --- Chama API com streaming (evita timeout em requests longos)
  let toolInput: unknown = null;
  let usage:
    | {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      }
    | undefined;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Adaptive thinking: modelo decide quanto raciocínio precisa.
      // Em opus 4.7, é a única forma "on" — budget_tokens não é aceito aqui.
      thinking: { type: 'adaptive' },
      // System prompt longo com cache_control pra economizar nas próximas
      // chamadas dentro de ~5min.
      system: [
        {
          type: 'text',
          text: AI_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [tool],
      // NOTA: não dá pra usar `tool_choice: { type: 'tool', name }` em conjunto
      // com `thinking` — a API retorna 400. Usamos 'auto' e confiamos no
      // prompt + único tool disponível pra modelo chamar corretamente. Se ele
      // não chamar, capturamos abaixo com erro descritivo.
      tool_choice: { type: 'auto' },
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    });

    const finalMessage = await stream.finalMessage();

    // Pega o bloco tool_use
    const toolUseBlock = finalMessage.content.find(
      (b) => b.type === 'tool_use' && b.name === TOOL_NAME
    );

    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      // Algo deu errado — modelo respondeu sem chamar o tool
      const textBlocks = finalMessage.content
        .filter((b) => b.type === 'text')
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('\n');
      throw new Error(
        `Modelo não chamou o tool ${TOOL_NAME}. Resposta livre:\n${textBlocks.slice(0, 500)}`
      );
    }

    toolInput = toolUseBlock.input;
    usage = finalMessage.usage as typeof usage;
  } catch (err) {
    // Erros específicos PRIMEIRO (mais específicos pra menos), porque
    // AuthenticationError/RateLimitError extendem APIError.
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error(
        'Chave da API Anthropic inválida (401). Verifique ANTHROPIC_API_KEY em .env.local.'
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error(
        'Limite de requisições da Anthropic atingido (429). Tente novamente em alguns segundos.'
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error('[parse-with-ai] Anthropic API error:', err.status, err.message);
      throw new Error(`Erro da API Anthropic (${err.status}): ${err.message}`);
    }
    throw err;
  }

  // --- Valida o output do tool (defensivo)
  let result: AIParseResult;
  try {
    result = validateAIParseResult(toolInput);
  } catch (err) {
    console.error('[parse-with-ai] Output inválido do tool:', toolInput);
    throw new Error(
      `Output da IA malformado: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (result.frames.length === 0) {
    throw new Error(
      'A IA não conseguiu identificar nenhum frame no documento. ' +
        'Verifique se o texto contém conteúdo conversacional (mensagens, menus, etc.) ' +
        (result.notes?.length
          ? `\n\nObservações da IA: ${result.notes.join('; ')}`
          : '')
    );
  }

  // --- Build determinístico → ProjectState
  const state = buildStateFromAIResult(result);

  const blocksCount = result.frames.reduce((acc, f) => acc + f.blocks.length, 0);
  const durationMs = Date.now() - startedAt;

  devLog(
    `[parse-with-ai] ✓ ${result.frames.length} frames, ${blocksCount} blocks, ${state.nodes.length} nodes, ${state.edges.length} edges (${(durationMs / 1000).toFixed(1)}s)`
  );
  if (usage) {
    devLog(
      `[parse-with-ai] Tokens: in=${usage.input_tokens ?? 0}, out=${usage.output_tokens ?? 0}, cache_read=${usage.cache_read_input_tokens ?? 0}, cache_write=${usage.cache_creation_input_tokens ?? 0}`
    );
  }

  // Registra na tabela ia_usage (só se temos projectId — chamada interna em
  // context com projeto). Best-effort, não falha o caller.
  if (input.projectId) {
    const { logIaUsage } = await import('@/lib/actions/ia-usage');
    await logIaUsage({
      projectId: input.projectId,
      feature: 'parse-flow',
      model: MODEL,
      usage: usage
        ? {
            input_tokens: usage.input_tokens ?? 0,
            output_tokens: usage.output_tokens ?? 0,
            cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
          }
        : null,
      latencyMs: durationMs,
    });
  }

  return {
    state,
    meta: {
      framesCount: result.frames.length,
      blocksCount,
      notes: result.notes ?? [],
      inputTokens: usage?.input_tokens,
      outputTokens: usage?.output_tokens,
      cacheReadTokens: usage?.cache_read_input_tokens,
      cacheCreationTokens: usage?.cache_creation_input_tokens,
      durationMs,
    },
  };
}

/**
 * Fallback: lê `.env.local` direto do disco e retorna o valor de
 * ANTHROPIC_API_KEY. Usado quando `process.env.ANTHROPIC_API_KEY` vem vazio
 * porque o env do sistema (Windows + Claude Code CLI) shadowou.
 *
 * Em produção esse arquivo não existe, então retorna undefined silenciosamente.
 */
function readApiKeyFromEnvFile(): string | undefined {
  try {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');

    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return undefined;

    const content = fs.readFileSync(envPath, 'utf-8');
    // Aceita: ANTHROPIC_API_KEY=valor ou ANTHROPIC_API_KEY="valor" ou com 'valor'
    const match = content.match(/^\s*ANTHROPIC_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if (!match) return undefined;

    const value = match[1].trim();
    devLog(
      `[parse-with-ai] Lendo ANTHROPIC_API_KEY do .env.local (process.env estava vazio) — length=${value.length}`
    );
    return value;
  } catch (err) {
    devWarn('[parse-with-ai] Falha ao ler .env.local:', err);
    return undefined;
  }
}
