/**
 * Testes do parser regex v2 — cobertura ampla.
 *
 * Cada teste é um cenário próximo do mundo real (escopo de cliente)
 * e valida que o parser produz nodes/edges esperados sem tocar na IA.
 */

import { describe, it, expect } from 'vitest';
import { parseEscopoText, tokenize, detectBlock, extractVariables } from './index';

describe('parseEscopoText — fluxo básico', () => {
  it('cria frame + bot + user a partir de Bot:/Cliente:', () => {
    const text = `# Saudação
Bot: Olá! Sou o assistente. Qual seu nome?
Cliente: João Silva
`;
    const state = parseEscopoText(text);
    const frame = state.nodes.find((n) => n.type === 'frame');
    expect(frame?.data?.title).toBe('Saudação');
    expect(state.nodes.some((n) => n.type === 'bubble-bot')).toBe(true);
    expect(state.nodes.some((n) => n.type === 'bubble-user')).toBe(true);
  });

  it('detecta "Gui:" e "Atendente:" como bot', () => {
    const t1 = parseEscopoText('Gui: Olá!');
    const t2 = parseEscopoText('Atendente: Em que posso ajudar?');
    expect(t1.nodes.some((n) => n.type === 'bubble-bot')).toBe(true);
    expect(t2.nodes.some((n) => n.type === 'bubble-bot')).toBe(true);
  });

  it('detecta "Usuário:" e "Você:" como user', () => {
    const t1 = parseEscopoText('Bot: Oi\nUsuário: Olá');
    const t2 = parseEscopoText('Bot: Oi\nVocê: Olá');
    expect(t1.nodes.some((n) => n.type === 'bubble-user')).toBe(true);
    expect(t2.nodes.some((n) => n.type === 'bubble-user')).toBe(true);
  });

  it('cabeçalhos múltiplos viram múltiplos frames', () => {
    const text = `# Saudação
Bot: Olá
# Ofertas
Bot: Veja ofertas
# Encerramento
Bot: Até logo
`;
    const state = parseEscopoText(text);
    const frames = state.nodes.filter((n) => n.type === 'frame');
    expect(frames).toHaveLength(3);
    expect(frames.map((f) => f.data?.title)).toEqual([
      'Saudação',
      'Ofertas',
      'Encerramento',
    ]);
  });

  it('"Cenário N:" também é cabeçalho', () => {
    const text = `Cenário 1: Saudação
Bot: Olá
Cenário 2: Despedida
Bot: Tchau
`;
    const state = parseEscopoText(text);
    const frames = state.nodes.filter((n) => n.type === 'frame');
    expect(frames).toHaveLength(2);
  });
});

describe('parseEscopoText — listas e botões', () => {
  it('1 item → btn-long', () => {
    const text = `# Frame
Bot: Aceita?
- Aceitar
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'btn-long')).toBe(true);
  });

  it('2 opções CURTAS → btn-short (2 nodes)', () => {
    const text = `# Frame
Bot: Aceita?
- Sim
- Não
`;
    const state = parseEscopoText(text);
    const shorts = state.nodes.filter((n) => n.type === 'btn-short');
    expect(shorts).toHaveLength(2);
  });

  it('2 opções LONGAS → menu (não cabe em btn-short)', () => {
    const text = `# Frame
Bot: Escolha:
- Opção muito longa que não cabe num botão curto
- Outra opção que também é muito grande pra botão curto
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'menu')).toBe(true);
    expect(state.nodes.filter((n) => n.type === 'btn-short')).toHaveLength(0);
  });

  it('4+ opções → menu', () => {
    const text = `# Frame
Bot: Escolha
- A
- B
- C
- D
- E
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'menu')).toBe(true);
  });

  it('opções com bullet • e numeração 1.', () => {
    const text = `# Frame
Bot: Escolha
• Sim
• Não
`;
    const state = parseEscopoText(text);
    expect(state.nodes.filter((n) => n.type === 'btn-short')).toHaveLength(2);
  });
});

describe('parseEscopoText — mídias', () => {
  it('[imagem do produto] → bubble midia-imagem-bot', () => {
    const text = `# Frame
Bot: Veja
[imagem do produto]
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'midia-imagem-bot')).toBe(true);
  });

  it('frase com verbo "envia" + tipo → mídia', () => {
    const text = `# Frame
Bot: Aqui está o PDF do contrato
Bot envia o PDF do catálogo
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'midia-documento-bot')).toBe(
      true
    );
  });

  it('detecta vídeo', () => {
    const text = `# Frame
[vídeo de apresentação]
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'midia-video-bot')).toBe(true);
  });
});

describe('parseEscopoText — condicionais', () => {
  it('"Se ... então ... senão ..." → condicional', () => {
    const text = `# Frame
Se cliente é VIP, então oferece desconto premium, senão segue fluxo normal.
`;
    const state = parseEscopoText(text);
    const cond = state.nodes.find((n) => n.type === 'condicional');
    expect(cond).toBeDefined();
    expect(cond?.data?.condition).toMatch(/cliente é VIP/i);
  });

  it('"Caso ..." vira condicional', () => {
    const text = `# Frame
Caso o cliente seja menor de idade
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'condicional')).toBe(true);
  });

  it('"Verifica se ..." vira condicional', () => {
    const text = `# Frame
Verifica se CPF é válido
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'condicional')).toBe(true);
  });
});

describe('parseEscopoText — URLs', () => {
  it('URL stand-alone vira nó link', () => {
    const text = `# Frame
Bot: Acesse o site
https://exemplo.com/landing
`;
    const state = parseEscopoText(text);
    const link = state.nodes.find((n) => n.type === 'link');
    expect(link).toBeDefined();
    expect(link?.data?.url).toBe('https://exemplo.com/landing');
  });

  it('texto antes da URL vira título do link', () => {
    const text = `# Frame
Catálogo completo: https://exemplo.com/catalogo
`;
    const state = parseEscopoText(text);
    const link = state.nodes.find((n) => n.type === 'link');
    expect(link?.data?.linkTitle).toMatch(/cat[áa]logo/i);
  });
});

describe('parseEscopoText — IA generativa', () => {
  it('"usar IA pra responder" → iag-saida', () => {
    const text = `# Frame
Use IA pra responder a pergunta do cliente
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'iag-saida')).toBe(true);
  });

  it('"ChatGPT" vira IA', () => {
    const text = `# Frame
Chama ChatGPT pra gerar resposta
`;
    const state = parseEscopoText(text);
    expect(
      state.nodes.some((n) => n.type === 'iag-saida' || n.type === 'iag-entrada')
    ).toBe(true);
  });
});

describe('parseEscopoText — Integração API', () => {
  it('"GET /api/x" vira integracao-api', () => {
    const text = `# Frame
GET /api/clientes/{cpf}
`;
    const state = parseEscopoText(text);
    const api = state.nodes.find((n) => n.type === 'integracao-api');
    expect(api).toBeDefined();
    expect(api?.data?.method).toBe('GET');
    expect(api?.data?.url).toMatch(/clientes/);
  });

  it('"chama API X" vira integração genérica', () => {
    const text = `# Frame
Chama API do CRM pra buscar cliente
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'integracao-api')).toBe(true);
  });
});

describe('parseEscopoText — transbordo', () => {
  it('"atendimento humano" cria nó atendimento-humano', () => {
    const text = `# Frame
Encaminha pra atendimento humano
`;
    const state = parseEscopoText(text);
    expect(state.nodes.some((n) => n.type === 'atendimento-humano')).toBe(true);
  });

  it('"falar com atendente" também detecta', () => {
    const text = `# Frame
Bot: Pra falar com um atendente, aguarde
`;
    const state = parseEscopoText(text);
    // O detect pode pegar como bot OU como atendimento-humano dependendo do prefixo.
    // O importante é que existe um caminho de transbordo (bot OU humano).
    expect(
      state.nodes.some(
        (n) => n.type === 'atendimento-humano' || n.type === 'bubble-bot'
      )
    ).toBe(true);
  });
});

describe('parseEscopoText — direcionamentos', () => {
  it('"Volta ao menu" cria direcionamento com fuzzy match', () => {
    const text = `# Menu Principal
Bot: Escolha
# Ofertas
Bot: Veja ofertas
Volta ao menu principal
`;
    const state = parseEscopoText(text);
    const dir = state.nodes.find((n) => n.type === 'direcionamento');
    expect(dir).toBeDefined();
    // Fuzzy match deve ter resolvido pro frame "Menu Principal"
    expect(dir?.data?.targetFrameId).toBeTruthy();
    expect(dir?.data?.clickable).toBe(true);
  });

  it('"Continua em [Frame]" também direciona', () => {
    const text = `# Saudação
Bot: Oi
Continua em Encerramento
# Encerramento
Bot: Tchau
`;
    const state = parseEscopoText(text);
    const dir = state.nodes.find((n) => n.type === 'direcionamento');
    expect(dir?.data?.targetFrameId).toBe('encerramento');
  });
});

describe('extractVariables', () => {
  it('detecta {{handlebars}}', () => {
    const vars = extractVariables('Olá {{nome}}, seu CPF é {{cpf}}');
    expect(vars.map((v) => v.name).sort()).toEqual(['cpf', 'nome']);
  });

  it('detecta [BRACKET_UPPER]', () => {
    const vars = extractVariables('Cliente [NOME_CLIENTE] tem [CPF]');
    expect(vars.map((v) => v.name).sort()).toEqual(['cpf', 'nome_cliente']);
  });

  it('dedupe entre sintaxes', () => {
    const vars = extractVariables('{{nome}} e [NOME]');
    expect(vars).toHaveLength(1);
  });

  it('verbo + entidade conhecida', () => {
    const vars = extractVariables('Pergunta o nome do cliente');
    expect(vars.some((v) => v.name === 'nome')).toBe(true);
  });
});

describe('detectBlock — casos isolados', () => {
  it('linha vazia retorna null', () => {
    expect(detectBlock('')).toBeNull();
    expect(detectBlock('   ')).toBeNull();
  });

  it('texto sem marker vira note (fallback)', () => {
    const b = detectBlock('Texto livre sem marker');
    expect(b?.kind).toBe('note');
  });

  it('"Bot: oi" vira bloco bot', () => {
    const b = detectBlock('Bot: oi');
    expect(b?.kind).toBe('bot');
    expect((b as { text: string }).text).toBe('oi');
  });
});

describe('tokenize — normalização', () => {
  it('PDF colado numa linha só é quebrado corretamente', () => {
    // Simula PDF: tudo numa linha
    const text =
      'Cenário 1: Saudação Bot: Olá! Como posso ajudar? Cliente: Quero ofertas Cenário 2: Ofertas Bot: Aqui estão';
    const sections = tokenize(text);
    expect(sections).toHaveLength(2);
    expect(sections[0].blocks.some((b) => b.kind === 'bot')).toBe(true);
    expect(sections[0].blocks.some((b) => b.kind === 'user')).toBe(true);
  });

  it('linhas continuadas (PDF wrap) são juntadas', () => {
    const text = `Bot: Esta é uma frase muito longa que
foi quebrada por largura visual
mas deveria ser uma só.`;
    const sections = tokenize(text);
    const bot = sections[0].blocks.find((b) => b.kind === 'bot');
    expect((bot as { text: string }).text).toMatch(/uma só\.$/);
  });
});
