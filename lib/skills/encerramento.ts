/**
 * Skill: Encerramento
 *
 * Padrão fiel ao dump real do usuário (tmp/state-snapshot.json em 2026-05-22)
 * + memory `padrao_encerramento.md`.
 *
 * ESTRUTURA (compacta — frame 656 x 673):
 *   Entry → EN001 bot agradecimento + pergunta avaliação
 *         → EN002 menu (4 níveis de satisfação)
 *         → EN003 bot opcional pra coletar comentário livre
 *         → bubble-user (placeholder "{feedback livre do cliente}")
 *         → EN004 bot "Agradecemos seu contato." (terminal)
 *
 * Cenários do bot direcionam pra ESTE frame pra centralizar a coleta
 * de NPS/CSAT. Não duplica a pergunta inline.
 *
 * Textos usam placeholder {nome da marca} pra adaptar por projeto.
 */
import type { Skill, SkillBuildOptions, SkillBuildResult } from './types';
import { SkillBuilder } from './builders';

export const encerramentoSkill: Skill = {
  id: 'encerramento',
  title: 'Encerramento',
  description: 'Agradecimento + avaliação (4 níveis) + feedback livre opcional',
  category: 'pattern',
  emoji: '👋',
  keywords: ['encerramento', 'fim', 'nps', 'csat', 'avaliação', 'feedback', 'finalizar', 'tchau'],
  build(opts: SkillBuildOptions): SkillBuildResult {
    const b = new SkillBuilder(opts.prefix ?? 'EN');
    const { x, y } = opts.origin;

    // Layout do dump real:
    //  entry-point     rel(280, 10)
    //  EN001 bot       rel(280, 50)
    //  EN002 menu      rel(432, 136)
    //  EN003 bot       rel(280, 453)
    //  bubble-user     rel(307, 539)
    //  EN004 bot       rel(452, 586)
    const FRAME_W = 656;
    const FRAME_H = 673;

    b.frame({
      title: 'Encerramento',
      frameId: opts.frameId ?? 'encerramento',
      x,
      y,
      width: FRAME_W,
      height: FRAME_H,
    });

    // 1. Início
    b.entryPoint({ x: x + 280, y: y + 10 });

    // 2. Bot agradecimento + pergunta avaliação
    const en001 = b.bot(
      'Obrigada pelo seu contato! Antes de encerrar, como você avalia sua experiência com o WhatsApp da {nome da marca}?',
      { x: x + 280, y: y + 50 }
    );

    // 3. Menu avaliação (4 níveis)
    b.menu(
      'Avaliação do atendimento',
      [
        'Muito satisfeito(a)',
        'Satisfeito(a)',
        'Pouco satisfeito(a)',
        'Muito insatisfeito(a)',
      ],
      { x: x + 432, y: y + 136 }
    );

    // 4. Bot pra coletar comentário livre opcional
    b.bot(
      'Se desejar, você também pode nos contar o que faltou ou o que poderia ter sido diferente no atendimento.',
      { x: x + 280, y: y + 453 }
    );

    // 5. User input livre (placeholder)
    b.user('{feedback livre do cliente}', { x: x + 307, y: y + 539 });

    // 6. Bot final
    const en004 = b.bot('Agradecemos seu contato.', {
      x: x + 452,
      y: y + 586,
    });

    return {
      nodes: b.nodes,
      edges: b.edges,
      entryNodeId: en001,
      exitNodeId: en004, // terminal
    };
  },
};
