/**
 * Skill: Opt-in LGPD
 *
 * Padrão de consentimento LGPD — apresenta política, registra opt-in,
 * branch pra recusa (transbordo ou encerramento).
 */
import type { Skill, SkillBuildOptions, SkillBuildResult } from './types';
import { SkillBuilder } from './builders';

export const optInLgpdSkill: Skill = {
  id: 'opt-in-lgpd',
  title: 'Opt-in LGPD',
  description: 'Consentimento LGPD: política, opt-in/out, registro do aceite',
  category: 'compliance',
  emoji: '🔒',
  keywords: ['lgpd', 'consentimento', 'opt-in', 'privacidade', 'política', 'dados', 'gdpr'],
  build(opts: SkillBuildOptions): SkillBuildResult {
    const b = new SkillBuilder(opts.prefix ?? 'LG');
    const { x, y } = opts.origin;
    const ROW_H = 200;
    let row = 0;

    b.frame({
      title: 'Opt-in LGPD',
      frameId: opts.frameId ?? 'opt-in-lgpd',
      x,
      y,
      width: 540,
      height: 1100,
    });

    const entryId = b.bot(
      'Antes de continuar, preciso do seu consentimento pra tratar seus dados conforme a LGPD.\n\nLeia a política aqui: {link política}\n\nVocê concorda?',
      { x: x + 80, y: y + 80 + row++ * ROW_H }
    );

    b.menu(
      'Você aceita a política?',
      ['Sim, concordo', 'Não concordo', 'Ver política'],
      { x: x + 80, y: y + 80 + row++ * ROW_H }
    );

    const userAceita = b.user('Sim, concordo', { x: x + 80, y: y + 80 + row++ * ROW_H });
    b.setLastFlowId(userAceita);

    const botRegistra = b.bot(
      'Obrigado! Seu consentimento foi registrado. Vamos continuar.',
      { x: x + 80, y: y + 80 + row++ * ROW_H }
    );

    // Branch recusa
    const botRecusa = b.bot(
      'Entendido. Sem consentimento, infelizmente não posso prosseguir com o atendimento.\n\nSe mudar de ideia, é só chamar de novo.',
      { x: x + 80 + 300, y: y + 80 + (row - 2) * ROW_H + 30 },
      false
    );
    b.connect(userAceita, botRecusa); // user pode dizer "não" → cai aqui

    return {
      nodes: b.nodes,
      edges: b.edges,
      entryNodeId: entryId,
      exitNodeId: botRegistra,
    };
  },
};
