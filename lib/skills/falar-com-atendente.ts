/**
 * Skill: Falar com atendente
 *
 * Padrão fiel ao desenho real do usuário (extraído de
 * tmp/state-snapshot.json em 2026-05-22) + memory
 * `padrao_falar_com_atendente.md`.
 *
 * ESTRUTURA:
 *   Entry → FA001 (bot "vou te direcionar") → cascata de 4 condicionais →
 *     - feriado?       TRUE → bot msg feriado          (terminal)
 *     - fim de semana? TRUE → bot msg fim de semana    (terminal)
 *     - fora horário?  TRUE → bot msg fora do horário  (terminal)
 *     - disponível?    TRUE → atendimento-humano       (transbordo real)
 *                      FALSE → bot "aguarde, alguém vai te atender"
 *
 * LAYOUT (3 colunas):
 *   • Coluna esquerda (x≈310):   bots de indisponibilidade (terminais)
 *   • Coluna central (x≈730-790): caminho principal (entry, FA001, condicionais)
 *   • Coluna direita (x≈1150):    "aguarde" (último FALSE)
 *
 * Frame: 1556 x 810
 *
 * Regra crítica da memória: cenários NUNCA usam atendimento-humano inline —
 * sempre direcionam pra ESSA skill. O atendimento-humano só aparece DEPOIS
 * das 4 validações.
 */
import type { Skill, SkillBuildOptions, SkillBuildResult } from './types';
import { SkillBuilder } from './builders';

export const falarComAtendenteSkill: Skill = {
  id: 'falar-com-atendente',
  title: 'Falar com atendente',
  description: 'Cascata de 4 validações (feriado/fds/horário/disponibilidade) antes do transbordo',
  category: 'pattern',
  emoji: '🧑‍💼',
  keywords: ['atendimento', 'humano', 'transbordo', 'fa', 'atendente', 'suporte', 'transferir'],
  build(opts: SkillBuildOptions): SkillBuildResult {
    const b = new SkillBuilder(opts.prefix ?? 'FA');
    const { x, y } = opts.origin;

    // Posições absolutas — mesmas do padrão real (offset relativo ao origin)
    const FRAME_W = 1556;
    const FRAME_H = 810;

    // Colunas
    const colMsg = x + 310; // bots de indisponibilidade (terminais)
    const colMain = x + 730; // caminho principal
    const colCond = x + 750; // condicionais (alinhados ~main, +20px)
    const colAtd = x + 789; // atendimento-humano (alinhado pra ficar coeso)
    const colAguarde = x + 1150; // "aguarde" (último FALSE)

    // Linhas
    const yEntry = y + 10;
    const yBot1 = y + 50; // FA001
    const yCond1 = y + 179; // FA002 feriado
    const yRow2 = y + 297; // FA003 (msg) + FA004 (cond fds)
    const yRow3 = y + 445; // FA005 (msg) + FA006 (cond horário)
    const yRow4 = y + 574; // FA007 (msg) + FA008 (cond disponível)
    const yRow5 = y + 703; // atendimento-humano + FA009 (aguarde)

    // 1. Frame container
    b.frame({
      title: 'Falar com atendente',
      frameId: opts.frameId ?? 'atendente',
      x,
      y,
      width: FRAME_W,
      height: FRAME_H,
    });

    // 2. Entry point (Início)
    const entry = b.entryPoint({ x: colMain, y: yEntry });

    // 3. FA001 — Bot inicial confirmando o direcionamento
    const fa001 = b.bot(
      'Certo! Vou te direcionar para um dos nossos atendentes.',
      { x: colMain, y: yBot1 }
    );
    // edge entry → FA001 já foi criada pelo b.bot() via lastFlowId

    // 4. FA002 — Condicional 1: É feriado?
    const fa002 = b.condicional(
      'É feriado?',
      'Sim',
      'Não',
      { x: colCond, y: yCond1 }
    );

    // 5. FA003 — TRUE de FA002: mensagem indisponibilidade feriado
    b.setLastFlowId(null); // não conecta automaticamente do fluxo principal
    const fa003 = b.bot(
      'Agradecemos seu contato. No momento estamos em feriado e não temos atendimento disponível. Tente novamente em horário comercial.',
      { x: colMsg, y: yRow2 },
      false // sem auto-connect
    );
    b.connect(fa002, fa003, { sourceHandle: 'true' });

    // 6. FA004 — FALSE de FA002: condicional fim de semana
    b.setLastFlowId(null);
    const fa004 = b.condicional(
      'É final de semana?',
      'Sim',
      'Não',
      { x: colCond, y: yRow2 },
      false
    );
    b.connect(fa002, fa004, { sourceHandle: 'false' });

    // 7. FA005 — TRUE de FA004: msg fim de semana
    const fa005 = b.bot(
      'Agradecemos seu contato. Aos finais de semana não temos atendimento. Tente em dias úteis.',
      { x: colMsg, y: yRow3 },
      false
    );
    b.connect(fa004, fa005, { sourceHandle: 'true' });

    // 8. FA006 — FALSE de FA004: condicional fora do horário
    const fa006 = b.condicional(
      'Está fora do horário de atendimento?',
      'Sim',
      'Não',
      { x: colCond, y: yRow3 },
      false
    );
    b.connect(fa004, fa006, { sourceHandle: 'false' });

    // 9. FA007 — TRUE de FA006: msg fora do horário
    const fa007 = b.bot(
      'Agradecemos seu contato. Estamos fora do nosso horário de atendimento.',
      { x: colMsg, y: yRow4 },
      false
    );
    b.connect(fa006, fa007, { sourceHandle: 'true' });

    // 10. FA008 — FALSE de FA006: condicional atendente disponível
    const fa008 = b.condicional(
      'Atendente disponível?',
      'Sim',
      'Não',
      { x: colCond, y: yRow4 },
      false
    );
    b.connect(fa006, fa008, { sourceHandle: 'false' });

    // 11. Atendimento humano — TRUE de FA008 (TRANSBORDO real)
    b.setLastFlowId(null);
    const atd = b.atendimentoHumano(
      'Início do atendimento humanizado',
      { x: colAtd, y: yRow5 },
      false
    );
    b.connect(fa008, atd, { sourceHandle: 'true' });

    // 12. FA009 — FALSE de FA008: bot "aguarde" (cliente fica em fila)
    b.setLastFlowId(null);
    const fa009 = b.bot(
      'Em alguns instantes um atendente fará seu atendimento. Por favor aguarde.',
      { x: colAguarde, y: yRow5 },
      false
    );
    b.connect(fa008, fa009, { sourceHandle: 'false' });

    // suppress unused-var lint for intermediate condicional IDs
    void entry;
    void fa001;
    void fa003;
    void fa005;
    void fa007;
    void fa009;

    return {
      nodes: b.nodes,
      edges: b.edges,
      entryNodeId: fa001, // bot inicial é o ponto de entrada (após o Início)
      exitNodeId: atd, // transbordo é a saída "ideal" (sucesso)
    };
  },
};
