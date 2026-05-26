import { describe, it, expect } from 'vitest';
import {
  FLOW_COMPONENT_CATALOG,
  FLOW_COMPONENT_BY_TYPE,
  FLOW_COMPONENT_LIMITS,
  createComponent,
  genComponentId,
} from './components';
import type { WhatsAppFlowComponentType } from '@/lib/types';

const ALL_TYPES: WhatsAppFlowComponentType[] = [
  'TextHeading',
  'TextSubheading',
  'TextBody',
  'TextCaption',
  'Image',
  'EmbeddedLink',
  'TextInput',
  'TextArea',
  'RadioButtonsGroup',
  'CheckboxGroup',
  'Dropdown',
  'DatePicker',
  'OptIn',
  'Footer',
];

describe('FLOW_COMPONENT_CATALOG', () => {
  it('cobre todos os tipos da discriminated union', () => {
    const catalogTypes = FLOW_COMPONENT_CATALOG.map((e) => e.type);
    for (const t of ALL_TYPES) {
      expect(catalogTypes).toContain(t);
    }
    expect(catalogTypes).toHaveLength(ALL_TYPES.length);
  });

  it('FLOW_COMPONENT_BY_TYPE indexa corretamente', () => {
    for (const t of ALL_TYPES) {
      expect(FLOW_COMPONENT_BY_TYPE[t]?.type).toBe(t);
    }
  });

  it('cada entry tem label, description e icon não vazios', () => {
    for (const entry of FLOW_COMPONENT_CATALOG) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.icon.length).toBeGreaterThan(0);
    }
  });
});

describe('genComponentId', () => {
  it('gera IDs únicos pra cada chamada', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(genComponentId('TextBody'));
    }
    expect(ids.size).toBe(50);
  });

  it('inclui prefix do tipo (4 chars)', () => {
    const id = genComponentId('TextHeading');
    expect(id).toMatch(/^c_text_/);
  });
});

describe('createComponent', () => {
  it('cria instância válida pra cada tipo', () => {
    for (const t of ALL_TYPES) {
      const c = createComponent(t);
      expect(c.type).toBe(t);
      expect(c.id).toMatch(/^c_/);
    }
  });

  it('TextHeading vem com text default não-vazio', () => {
    const c = createComponent('TextHeading');
    if (c.type !== 'TextHeading') throw new Error('wrong type');
    expect(c.text.length).toBeGreaterThan(0);
  });

  it('Footer vem com action.name === complete por default', () => {
    const c = createComponent('Footer');
    if (c.type !== 'Footer') throw new Error('wrong type');
    expect(c.onClickAction.name).toBe('complete');
  });

  it('RadioButtonsGroup vem com 2 opções default', () => {
    const c = createComponent('RadioButtonsGroup');
    if (c.type !== 'RadioButtonsGroup') throw new Error('wrong type');
    expect(c.dataSource).toHaveLength(2);
    expect(c.dataSource[0].id).toBe('op_1');
  });

  it('Dropdown vem com 3 opções default', () => {
    const c = createComponent('Dropdown');
    if (c.type !== 'Dropdown') throw new Error('wrong type');
    expect(c.dataSource).toHaveLength(3);
  });

  it('TextInput default é text + não obrigatório', () => {
    const c = createComponent('TextInput');
    if (c.type !== 'TextInput') throw new Error('wrong type');
    expect(c.inputType).toBe('text');
    expect(c.required).toBe(false);
  });
});

describe('FLOW_COMPONENT_LIMITS', () => {
  it('respeita limites Meta oficiais (Flow JSON v7.1)', () => {
    expect(FLOW_COMPONENT_LIMITS.TextHeading.text).toBe(80);
    expect(FLOW_COMPONENT_LIMITS.TextSubheading.text).toBe(80);
    expect(FLOW_COMPONENT_LIMITS.TextBody.text).toBe(4096);
    expect(FLOW_COMPONENT_LIMITS.TextCaption.text).toBe(409);
    expect(FLOW_COMPONENT_LIMITS.Footer.label).toBe(35);
    expect(FLOW_COMPONENT_LIMITS.EmbeddedLink.text).toBe(35);
  });
});
