/**
 * Skills — sub-fluxos reutilizáveis que podem ser inseridos em qualquer projeto.
 *
 * Cada Skill é um pacote auto-contido com nodes + edges que representam um
 * padrão recorrente em chatbots (ex: "Falar com atendente", "Validar CPF",
 * "Encerramento"). O usuário insere a skill via Cmd+K ou paleta, e o sistema
 * coloca os nodes no canvas, conecta ao bloco selecionado (se houver) e
 * deixa pronto pra edição/customização.
 *
 * Idempotência: cada chamada de `build()` gera IDs únicos novos. Isso evita
 * colisão se a mesma skill for inserida múltiplas vezes no mesmo projeto.
 *
 * Diferença vs Template:
 *  - Template: substitui o projeto inteiro (reset + insert).
 *  - Skill: adiciona um SUB-FLUXO no projeto atual (preservando o resto).
 */
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';

/** Resultado do build de uma skill — pronto pra ser mergeado no estado. */
export interface SkillBuildResult {
  nodes: FluxoNode[];
  edges: Edge[];
  /**
   * ID do "ponto de entrada" da skill — node que deve receber a edge vinda
   * do bloco selecionado quando o usuário insere a skill encadeando.
   * Geralmente é o primeiro bubble/menu do sub-fluxo.
   */
  entryNodeId: string;
  /**
   * ID do "ponto de saída" da skill — node que normalmente sai pra fora
   * (ex: direcionamento pro próximo frame). Pode ser null se a skill
   * é terminal (atendimento-humano, encerramento).
   */
  exitNodeId: string | null;
}

/** Opções passadas pro builder da skill. */
export interface SkillBuildOptions {
  /** Posição base no canvas (top-left do primeiro nó). */
  origin: { x: number; y: number };
  /** Prefixo dos IDs gerados (se a skill tem frame). */
  prefix?: string;
  /** Frame ID slug (se a skill cria seu próprio frame). */
  frameId?: string;
}

export type SkillCategory =
  | 'pattern' // padrões clássicos (atendimento, encerramento, algo mais)
  | 'validation' // validações (CPF, email, telefone)
  | 'compliance' // LGPD, opt-in, opt-out
  | 'utility'; // gerais (typing, espera, mensagem de erro padrão)

export interface Skill {
  /** ID único do skill (slug). Usado em analytics, busca, etc. */
  id: string;
  /** Nome curto exibido no UI (max ~30 chars). */
  title: string;
  /** Descrição curta — 1 frase explicando o que insere. */
  description: string;
  /** Categoria pra agrupar no UI. */
  category: SkillCategory;
  /** Emoji exibido no card (fallback se não quiser ícone Lucide). */
  emoji: string;
  /** Tags pra busca fuzzy no Cmd+K. */
  keywords: string[];
  /** Builder que gera o sub-fluxo (novos IDs a cada chamada). */
  build: (opts: SkillBuildOptions) => SkillBuildResult;
}
