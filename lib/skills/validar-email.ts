/**
 * Skill: Validar Email
 *
 * Padrão de coleta + validação de formato de email.
 */
import type { Skill, SkillBuildOptions, SkillBuildResult } from './types';
import { SkillBuilder } from './builders';

export const validarEmailSkill: Skill = {
  id: 'validar-email',
  title: 'Validar Email',
  description: 'Pede email, valida formato, reentrada em erro',
  category: 'validation',
  emoji: '📧',
  keywords: ['email', 'e-mail', 'contato', 'validar'],
  build(opts: SkillBuildOptions): SkillBuildResult {
    const b = new SkillBuilder(opts.prefix ?? 'EM');
    const { x, y } = opts.origin;
    const ROW_H = 200;
    let row = 0;

    b.frame({
      title: 'Validar Email',
      frameId: opts.frameId ?? 'validar-email',
      x,
      y,
      width: 540,
      height: 900,
    });

    const entryId = b.bot('Qual seu e-mail? Vou usar pra te enviar a confirmação.', {
      x: x + 80,
      y: y + 80 + row++ * ROW_H,
    });

    const userInput = b.user('joao@exemplo.com', { x: x + 80, y: y + 80 + row++ * ROW_H });
    b.setLastFlowId(userInput);

    const cond = b.condicional(
      'Email tem formato válido?',
      'Sim',
      'Não',
      { x: x + 80, y: y + 80 + row++ * ROW_H }
    );

    const botOk = b.bot('Perfeito! E-mail registrado.', {
      x: x + 80 + 300,
      y: y + 80 + (row - 1) * ROW_H + 30,
    }, false);
    b.connect(cond, botOk, { sourceHandle: 'true' });

    b.setLastFlowId(cond);
    const botErro = b.bot(
      'Esse e-mail não parece válido. Verifica e digita de novo, por favor?',
      { x: x + 80, y: y + 80 + row++ * ROW_H },
      false
    );
    b.connect(cond, botErro, { sourceHandle: 'false' });

    return {
      nodes: b.nodes,
      edges: b.edges,
      entryNodeId: entryId,
      exitNodeId: botOk,
    };
  },
};
