/**
 * Skill: Validar CPF
 *
 * Padrão de validação de CPF — pergunta, valida formato/dígitos, recursão
 * em caso de erro (até N tentativas), transbordo se persistir.
 */
import type { Skill, SkillBuildOptions, SkillBuildResult } from './types';
import { SkillBuilder } from './builders';

export const validarCpfSkill: Skill = {
  id: 'validar-cpf',
  title: 'Validar CPF',
  description: 'Pede CPF, valida formato e dígitos, reentrada em erro',
  category: 'validation',
  emoji: '🪪',
  keywords: ['cpf', 'documento', 'identificação', 'validar', 'cadastro'],
  build(opts: SkillBuildOptions): SkillBuildResult {
    const b = new SkillBuilder(opts.prefix ?? 'CPF');
    const { x, y } = opts.origin;
    const ROW_H = 200;
    let row = 0;

    b.frame({
      title: 'Validar CPF',
      frameId: opts.frameId ?? 'validar-cpf',
      x,
      y,
      width: 540,
      height: 900,
    });

    const entryId = b.bot(
      'Pra continuarmos, me informa seu CPF (só números, ex: 12345678900)',
      { x: x + 80, y: y + 80 + row++ * ROW_H }
    );

    const userInput = b.user('123.456.789-00', { x: x + 80, y: y + 80 + row++ * ROW_H });
    b.setLastFlowId(userInput);

    const cond = b.condicional(
      'CPF é válido?',
      'Sim',
      'Não',
      { x: x + 80, y: y + 80 + row++ * ROW_H }
    );

    // TRUE → confirmação
    const botOk = b.bot('CPF válido! Vamos continuar.', {
      x: x + 80 + 300,
      y: y + 80 + (row - 1) * ROW_H + 30,
    }, false);
    b.connect(cond, botOk, { sourceHandle: 'true' });

    // FALSE → erro, pede de novo
    b.setLastFlowId(cond);
    const botErro = b.bot(
      'Hmm, esse CPF parece inválido. Pode confirmar e digitar de novo?',
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
