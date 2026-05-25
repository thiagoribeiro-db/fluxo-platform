/**
 * Parser regex v2 — entry point.
 *
 * Pipeline:
 *   text → normalize → tokenize → detectBlocks → buildProjectState
 *
 * Cobre o máximo do que a IA faria, sem chamar Anthropic:
 *  - Cabeçalhos (#, Cenário N:, Frame:, Abertura/Encerramento padrão, "1. X")
 *  - Bot:/Cliente: e variações (Gui, Atendente, SAC, User, Usuário, etc.)
 *  - Listas → btn-long/short/menu (heurística por tamanho + qtd)
 *  - Mídias ([imagem], [pdf], frases tipo "envia foto do X")
 *  - Condicionais ("Se X então Y, senão Z")
 *  - URLs → nó link
 *  - IA generativa ("usar IA", "ChatGPT", "Resume com IA") → iag-saida/entrada
 *  - Integração API (HTTP method, "Chama API", webhook)
 *  - Variáveis ({{x}}, [X], <x>) → trackings input
 *  - Transbordo ("atendimento humano") → atendimento-humano
 *  - Navegação ("Volta ao menu", "Continua em X") → direcionamento clicável
 *    com fuzzy match no frame alvo
 *
 * Usado por `applyEscopoToProject` quando o user escolhe modo regex.
 */

import type { ProjectState } from '@/lib/types';
import { tokenize } from './tokenize';
import { buildProjectState } from './build';

export function parseEscopoText(text: string): ProjectState {
  const sections = tokenize(text);
  return buildProjectState(sections);
}

// Re-exports úteis pra testes externos / debugging
export { tokenize } from './tokenize';
export { buildProjectState } from './build';
export { normalize } from './normalize';
export { detectBlock } from './detect-blocks';
export type { ParsedBlock } from './detect-blocks';
export type { ParsedSection } from './tokenize';
export { extractVariables } from './detect-vars';
