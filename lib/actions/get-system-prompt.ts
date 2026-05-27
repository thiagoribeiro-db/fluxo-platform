'use server';

import { AI_SYSTEM_PROMPT } from '@/lib/parser/ai-system-prompt';

/**
 * Retorna o system prompt usado pelo parser IA (Claude).
 * Exposto como server action pra que componentes client possam exibi-lo
 * sem precisar importar diretamente o módulo (que usa YAML/Node.js).
 */
export async function getAISystemPrompt(): Promise<{ prompt: string; charCount: number }> {
  return {
    prompt: AI_SYSTEM_PROMPT,
    charCount: AI_SYSTEM_PROMPT.length,
  };
}
