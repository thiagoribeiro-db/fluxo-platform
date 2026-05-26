import { describe, it, expect } from 'vitest';
import { buildFlowJson } from './export';
import { createComponent } from './components';
import type { FluxoNodeData, WhatsAppFlowScreen } from '@/lib/types';

function makeData(overrides: Partial<FluxoNodeData> = {}): FluxoNodeData {
  return {
    flowName: 'Test Flow',
    flowCategory: 'OTHER',
    screens: [],
    flowJsonVersion: '7.1',
    dataApiVersion: '3.0',
    ...overrides,
  };
}

describe('buildFlowJson', () => {
  it('inclui version, data_api_version e _meta', () => {
    const json = buildFlowJson(makeData());
    expect(json.version).toBe('7.1');
    expect(json.data_api_version).toBe('3.0');
    expect(json._meta?.flow_name).toBe('Test Flow');
    expect(json._meta?.generator).toBe('fluxo-platform');
  });

  it('produz routing_model vazio quando screens vazias', () => {
    const json = buildFlowJson(makeData());
    expect(json.routing_model).toEqual({});
    expect(json.screens).toEqual([]);
  });

  it('mapeia screens com id, title e terminal', () => {
    const screens: WhatsAppFlowScreen[] = [
      {
        id: 's1',
        title: 'Início',
        components: [],
        isEntry: true,
      },
      {
        id: 's2',
        title: 'Fim',
        components: [],
        isTerminal: true,
      },
    ];
    const json = buildFlowJson(makeData({ screens }));
    expect(json.screens).toHaveLength(2);
    expect(json.screens[0].id).toBe('s1');
    expect(json.screens[1].terminal).toBe(true);
  });

  it('layout sempre é SingleColumnLayout', () => {
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [], isEntry: true },
    ];
    const json = buildFlowJson(makeData({ screens }));
    expect(json.screens[0].layout.type).toBe('SingleColumnLayout');
  });

  it('mapeia TextHeading → { type, text }', () => {
    const heading = createComponent('TextHeading');
    if (heading.type !== 'TextHeading') throw new Error('wrong');
    heading.text = 'Olá';
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [heading], isEntry: true },
    ];
    const json = buildFlowJson(makeData({ screens }));
    expect(json.screens[0].layout.children[0]).toEqual({
      type: 'TextHeading',
      text: 'Olá',
    });
  });

  it('mapeia Footer com action.navigate', () => {
    const footer = createComponent('Footer');
    if (footer.type !== 'Footer') throw new Error('wrong');
    footer.onClickAction = { name: 'navigate', next: { name: 's2' } };
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [footer], isEntry: true },
      { id: 's2', title: 'B', components: [] },
    ];
    const json = buildFlowJson(makeData({ screens }));
    const action = (json.screens[0].layout.children[0] as Record<string, unknown>)[
      'on-click-action'
    ];
    expect(action).toEqual({
      name: 'navigate',
      next: { type: 'screen', name: 's2' },
    });
    // routing_model reflete a edge
    expect(json.routing_model.s1).toContain('s2');
  });

  it('mapeia TextInput com kebab-case nas chaves (helper-text, etc)', () => {
    const input = createComponent('TextInput');
    if (input.type !== 'TextInput') throw new Error('wrong');
    input.name = 'cpf';
    input.label = 'CPF';
    input.helperText = 'Apenas números';
    input.minChars = 11;
    input.maxChars = 11;
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [input], isEntry: true },
    ];
    const json = buildFlowJson(makeData({ screens }));
    const out = json.screens[0].layout.children[0] as Record<string, unknown>;
    expect(out['helper-text']).toBe('Apenas números');
    expect(out['min-chars']).toBe(11);
    expect(out['max-chars']).toBe(11);
  });

  it('inclui data_channel_uri quando preenchido', () => {
    const json = buildFlowJson(
      makeData({ dataChannelUri: 'https://api.empresa.com/flow' })
    );
    expect(json.data_channel_uri).toBe('https://api.empresa.com/flow');
  });

  it('omite data_channel_uri quando vazio (Flow client-only)', () => {
    const json = buildFlowJson(makeData({ dataChannelUri: '' }));
    expect(json.data_channel_uri).toBeUndefined();
  });

  it('omite data_channel_uri quando só whitespace', () => {
    const json = buildFlowJson(makeData({ dataChannelUri: '   ' }));
    expect(json.data_channel_uri).toBeUndefined();
  });

  it('mapeia RadioButtonsGroup com data-source', () => {
    const radio = createComponent('RadioButtonsGroup');
    if (radio.type !== 'RadioButtonsGroup') throw new Error('wrong');
    radio.dataSource = [
      { id: 'a', title: 'Opção A' },
      { id: 'b', title: 'Opção B' },
    ];
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [radio], isEntry: true },
    ];
    const json = buildFlowJson(makeData({ screens }));
    const out = json.screens[0].layout.children[0] as Record<string, unknown>;
    expect(out['data-source']).toEqual([
      { id: 'a', title: 'Opção A' },
      { id: 'b', title: 'Opção B' },
    ]);
  });
});
