import { describe, expect, it } from 'vitest';
import {
  extractTrackingName,
  parseTrackingLabel,
  slugify,
  TRACKING_SUFFIXES,
} from './tracking-labels';

describe('slugify', () => {
  it('converte texto comum em slug com underscores', () => {
    expect(slugify('Olá mundo')).toBe('ola_mundo');
  });

  it('remove diacríticos', () => {
    expect(slugify('Saudação Inicial')).toBe('saudacao_inicial');
  });

  it('remove pontuação', () => {
    expect(slugify('Bot: Como posso ajudar?')).toBe('bot_como_posso_ajudar');
  });

  it('respeita maxLen', () => {
    expect(slugify('palavra muito muito muito longa aqui', 10)).toBe(
      'palavra_mu'
    );
  });

  it('retorna sem_texto pra entrada vazia', () => {
    expect(slugify('')).toBe('sem_texto');
    expect(slugify('!!!')).toBe('sem_texto');
  });
});

describe('extractTrackingName', () => {
  it('extrai palavras significativas ignorando stopwords', () => {
    expect(
      extractTrackingName(
        'Se você deseja registrar um relato relacionado a conduta'
      )
    ).toBe('registrar relato');
  });

  it('respeita maxWords', () => {
    expect(
      extractTrackingName('comprar passagem aérea barata urgente', 3)
    ).toBe('comprar passagem aerea');
  });

  it('retorna "sem nome" pra entrada vazia', () => {
    expect(extractTrackingName('')).toBe('sem nome');
    expect(extractTrackingName('a o e')).toBe('sem nome'); // só stopwords
  });

  it('ignora palavras curtas (<=2 chars)', () => {
    expect(extractTrackingName('oi! eu sou a Gui assistente')).toBe(
      'gui assistente'
    );
  });
});

describe('parseTrackingLabel', () => {
  it('separa name + suffix conhecido', () => {
    expect(parseTrackingLabel('saudacao exibicao')).toEqual({
      name: 'saudacao',
      suffix: 'exibicao',
    });
    expect(parseTrackingLabel('menu principal selecao')).toEqual({
      name: 'menu principal',
      suffix: 'selecao',
    });
  });

  it('retorna null pra label sem suffix conhecido (custom user)', () => {
    expect(parseTrackingLabel('algum tracking custom')).toBeNull();
    expect(parseTrackingLabel('saudacao')).toBeNull();
  });

  it('cobre todos os 4 suffixes', () => {
    for (const s of TRACKING_SUFFIXES) {
      const r = parseTrackingLabel(`nome ${s}`);
      expect(r?.suffix).toBe(s);
      expect(r?.name).toBe('nome');
    }
  });
});
