import { describe, expect, it } from 'vitest';
import { AIBlockSchema, AIParseResultSchema } from './ai-output';
import { ComponentSpecSchema, validateSpec } from './component-spec';
import {
  DialogRequestSchema,
  JumpToFrameDetailSchema,
  ToastDetailSchema,
} from './events';

// =============================================================================
// AI output
// =============================================================================

describe('AIParseResultSchema', () => {
  it('aceita output válido mínimo', () => {
    const r = AIParseResultSchema.safeParse({
      frames: [
        {
          title: 'Saudação',
          prefix: 'S',
          frame_id: 'saudacao',
          blocks: [{ kind: 'bot', text: 'Oi' }],
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.notes).toEqual([]); // default vazio
    }
  });

  it('aceita campos extras nos blocks (passthrough)', () => {
    const r = AIBlockSchema.safeParse({
      kind: 'bot',
      text: 'Oi',
      extra_campo_desconhecido: 'valor',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita kind inválido', () => {
    const r = AIBlockSchema.safeParse({ kind: 'kind-inexistente' });
    expect(r.success).toBe(false);
  });

  it('rejeita frames vazio', () => {
    const r = AIParseResultSchema.safeParse({ frames: [] });
    expect(r.success).toBe(false);
  });

  it('rejeita frame sem prefix', () => {
    const r = AIParseResultSchema.safeParse({
      frames: [
        { title: 'X', frame_id: 'x', blocks: [{ kind: 'bot' }] },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('media_kind precisa ser enum', () => {
    const r = AIBlockSchema.safeParse({ kind: 'media', media_kind: 'mp3' });
    expect(r.success).toBe(false);
  });
});

// =============================================================================
// ComponentSpec
// =============================================================================

describe('ComponentSpecSchema', () => {
  const validSpec = {
    id: 'bot',
    displayName: 'Bot',
    icon: '🤖',
    category: 'messaging',
    nodeType: 'bubble-bot',
    flowControl: 'linear',
    description: 'Mensagem do bot',
  };

  it('aceita spec mínimo válido', () => {
    expect(ComponentSpecSchema.safeParse(validSpec).success).toBe(true);
  });

  it('aceita nodeType como array', () => {
    const r = ComponentSpecSchema.safeParse({
      ...validSpec,
      nodeType: ['midia-imagem-bot', 'midia-documento-bot'],
    });
    expect(r.success).toBe(true);
  });

  it('rejeita category inválida', () => {
    const r = ComponentSpecSchema.safeParse({
      ...validSpec,
      category: 'invalida',
    });
    expect(r.success).toBe(false);
  });

  it('rejeita id vazio', () => {
    const r = ComponentSpecSchema.safeParse({ ...validSpec, id: '' });
    expect(r.success).toBe(false);
  });

  it('validateSpec throws com mensagem útil', () => {
    expect(() => validateSpec({ id: 'x' })).toThrow(/ComponentSpec inválido/);
  });

  it('aceita usageRules e detectionCues opcionais', () => {
    const r = ComponentSpecSchema.safeParse({
      ...validSpec,
      usageRules: ['Regra 1'],
      detectionCues: ['Pista 1'],
      commonMistakes: ['Erro 1'],
    });
    expect(r.success).toBe(true);
  });
});

// =============================================================================
// Events
// =============================================================================

describe('ToastDetailSchema', () => {
  it('aceita level + message', () => {
    expect(
      ToastDetailSchema.safeParse({ level: 'info', message: 'oi' }).success
    ).toBe(true);
  });

  it('rejeita level inválido', () => {
    expect(
      ToastDetailSchema.safeParse({ level: 'debug', message: 'x' }).success
    ).toBe(false);
  });
});

describe('DialogRequestSchema', () => {
  it('aceita confirm request', () => {
    const r = DialogRequestSchema.safeParse({
      id: 1,
      kind: 'confirm',
      opts: { message: 'OK?' },
    });
    expect(r.success).toBe(true);
  });

  it('aceita prompt request', () => {
    const r = DialogRequestSchema.safeParse({
      id: 2,
      kind: 'prompt',
      opts: { message: 'Nome:', defaultValue: 'X' },
    });
    expect(r.success).toBe(true);
  });
});

describe('JumpToFrameDetailSchema', () => {
  it('aceita targetNodeId sozinho', () => {
    expect(JumpToFrameDetailSchema.safeParse({ targetNodeId: 'n1' }).success).toBe(
      true
    );
  });

  it('aceita targetFrameId sozinho', () => {
    expect(
      JumpToFrameDetailSchema.safeParse({ targetFrameId: 'saudacao' }).success
    ).toBe(true);
  });

  it('rejeita objeto sem nenhum target', () => {
    expect(JumpToFrameDetailSchema.safeParse({}).success).toBe(false);
  });
});
