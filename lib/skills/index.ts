/**
 * Skills registry — catálogo central de todas as skills disponíveis.
 *
 * Adicione novas skills aqui (e no array `SKILLS`). O command palette
 * e a UI de seleção iteram esse array.
 */
export type { Skill, SkillCategory, SkillBuildOptions, SkillBuildResult } from './types';

import type { Skill, SkillCategory } from './types';
import { falarComAtendenteSkill } from './falar-com-atendente';
import { encerramentoSkill } from './encerramento';
import { algoMaisSkill } from './algo-mais';
import { validarCpfSkill } from './validar-cpf';
import { validarEmailSkill } from './validar-email';
import { optInLgpdSkill } from './opt-in-lgpd';

export const SKILLS: Skill[] = [
  falarComAtendenteSkill,
  encerramentoSkill,
  algoMaisSkill,
  validarCpfSkill,
  validarEmailSkill,
  optInLgpdSkill,
];

export const CATEGORY_LABEL: Record<SkillCategory, string> = {
  pattern: 'Padrões clássicos',
  validation: 'Validações',
  compliance: 'Compliance / LGPD',
  utility: 'Utilidades',
};

/** Acha skill pelo id. */
export function getSkillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

/** Agrupa skills por categoria, mantendo a ordem definida em SKILLS. */
export function groupedSkills(): Array<{ category: SkillCategory; items: Skill[] }> {
  const map = new Map<SkillCategory, Skill[]>();
  for (const s of SKILLS) {
    if (!map.has(s.category)) map.set(s.category, []);
    map.get(s.category)!.push(s);
  }
  const order: SkillCategory[] = ['pattern', 'validation', 'compliance', 'utility'];
  return order
    .filter((c) => map.has(c))
    .map((category) => ({ category, items: map.get(category)! }));
}
