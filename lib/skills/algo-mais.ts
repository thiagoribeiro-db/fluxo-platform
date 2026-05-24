/**
 * Skill: Algo Mais
 *
 * Padrão fiel ao dump real do usuário (tmp/state-snapshot.json em 2026-05-22)
 * + memory `padrao_algo_mais.md`.
 *
 * ESTRUTURA (compacta — frame 631 x 207):
 *   Entry → AM001 bot "Posso te ajudar com algo mais?" → 3 direcionamentos
 *     lado a lado:
 *       • Voltar ao menu principal → saudacao
 *       • Falar com atendente       → atendente
 *       • Finalizar                 → encerramento
 *
 * Cenários do bot terminam direcionando pra ESTA skill (nunca duplicam a
 * pergunta inline). Aqui centraliza-se a decisão final do usuário.
 *
 * NÃO TEM menu/user input no meio — bot pergunta e o usuário clica em
 * um dos 3 direcionamentos (pílulas verdes).
 */
import type { Skill, SkillBuildOptions, SkillBuildResult } from './types';
import { SkillBuilder } from './builders';

export const algoMaisSkill: Skill = {
  id: 'algo-mais',
  title: 'Algo Mais',
  description: '3 direcionamentos (menu principal / atendente / finalizar) após pergunta de continuação',
  category: 'pattern',
  emoji: '🔁',
  keywords: ['algo mais', 'continuar', 'voltar menu', 'mais alguma coisa', 'finalizar opção'],
  build(opts: SkillBuildOptions): SkillBuildResult {
    const b = new SkillBuilder(opts.prefix ?? 'AM');
    const { x, y } = opts.origin;

    // Layout do dump real:
    //  entry-point   rel(397, 10)
    //  AM001 bot     rel(397, 50)
    //  AM002 dir     rel(20, 97)   ← coluna esquerda
    //  AM003 dir     rel(221, 97)  ← coluna meio
    //  AM004 dir     rel(422, 97)  ← coluna direita
    const FRAME_W = 631;
    const FRAME_H = 207;

    b.frame({
      title: 'Algo Mais',
      frameId: opts.frameId ?? 'algo-mais',
      x,
      y,
      width: FRAME_W,
      height: FRAME_H,
    });

    // 1. Início
    b.entryPoint({ x: x + 397, y: y + 10 });

    // 2. Bot principal
    const am001 = b.bot('Posso te ajudar com algo mais?', {
      x: x + 397,
      y: y + 50,
    });

    // 3. Três direcionamentos lado a lado (linha 97)
    b.setLastFlowId(null); // os 3 conectam manualmente do AM001
    const dirMenu = b.direcionamento(
      'Voltar ao menu principal',
      'saudacao',
      { x: x + 20, y: y + 97 },
      false
    );
    b.connect(am001, dirMenu);

    const dirAtendente = b.direcionamento(
      'Falar com atendente',
      'atendente',
      { x: x + 221, y: y + 97 },
      false
    );
    b.connect(am001, dirAtendente);

    const dirFinalizar = b.direcionamento(
      'Finalizar',
      'encerramento',
      { x: x + 422, y: y + 97 },
      false
    );
    b.connect(am001, dirFinalizar);

    return {
      nodes: b.nodes,
      edges: b.edges,
      entryNodeId: am001,
      exitNodeId: dirFinalizar, // "saída natural" é o encerramento
    };
  },
};
